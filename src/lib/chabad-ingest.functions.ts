import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  rootIds: z.array(z.string().regex(/^\d+$/)).min(1).max(20),
  maxPages: z.number().int().min(1).max(120).optional().default(40),
  embed: z.boolean().optional().default(true),
  language: z.enum(["he", "en"]).optional().default("he"),
});

const CHABAD_API = "https://chabadlibrary.org/books/api/main?path=";
const CHABAD_URL = "https://chabadlibrary.org/books/";

async function fetchNode(id: string): Promise<{ raw: string; json: any } | null> {
  try {
    const res = await fetch(CHABAD_API + encodeURIComponent(id), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const raw = await res.text();
    return { raw, json: JSON.parse(raw) };
  } catch (e) {
    console.error("chabad fetch failed", id, e);
    return null;
  }
}

/**
 * Breadth-first crawl of ChabadLibrary starting from the given root IDs.
 * Caps work per invocation so the Worker doesn't time out — admin can
 * re-run with the same roots; already-ingested IDs with the same hash
 * are skipped, so it resumes effectively.
 */
export const crawlChabadLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, makeExcerpt, sha256 } = await import("./chunking");
    const { embed } = await import("./ai-gateway.server");
    const { cleanChabadText, extractChabadNode } = await import("./chabad-clean");

    const queue: string[] = [...data.rootIds];
    const seen = new Set<string>();
    let visited = 0;
    let savedNew = 0;
    let savedUpdated = 0;
    let skippedUnchanged = 0;
    let textPages = 0;
    let chunkTotal = 0;
    let embedded = 0;
    let fetchFailures = 0;

    while (queue.length > 0 && visited < data.maxPages) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      visited++;

      const node = await fetchNode(id);
      if (!node) {
        fetchFailures++;
        continue;
      }

      const extracted = extractChabadNode(node.json?.content, id);

      // Enqueue children for BFS.
      for (const childId of extracted.childIds) {
        if (!seen.has(childId)) queue.push(childId);
      }

      // Only save real text pages.
      if (!extracted.text || extracted.text.length < 40) continue;
      textPages++;

      const cleaned = extracted.text;
      const hash = await sha256(cleaned);

      const { data: existing } = await supabaseAdmin
        .from("sources")
        .select("id, sha256")
        .eq("source_provider", "chabadlibrary")
        .eq("source_id", id)
        .maybeSingle();

      if (existing && existing.sha256 === hash) {
        skippedUnchanged++;
        continue;
      }

      const payload = {
        source_provider: "chabadlibrary",
        source_id: id,
        title: cleanChabadText(extracted.title) || id,
        tree: extracted.tree,
        tree_parts: extracted.treeParts,
        language: data.language,
        text: cleaned,
        excerpt: makeExcerpt(cleaned),
        char_count: cleaned.length,
        source_url: CHABAD_URL + id,
        raw_payload: null,
        sha256: hash,
        fetched_at: new Date().toISOString(),
        content_type: extracted.contentType,
      };

      const { data: up, error: upErr } = await supabaseAdmin
        .from("sources")
        .upsert(payload, { onConflict: "source_provider,source_id" })
        .select("id")
        .single();
      if (upErr) {
        console.error("upsert source failed", id, upErr.message);
        continue;
      }
      if (existing) savedUpdated++; else savedNew++;

      // Replace chunks.
      await supabaseAdmin.from("source_chunks").delete().eq("source_id", up!.id);

      const chunks = chunkText(cleaned);
      chunkTotal += chunks.length;

      let embeddings: number[][] = [];
      if (data.embed && chunks.length > 0) {
        for (let i = 0; i < chunks.length; i += 8) {
          const slice = chunks.slice(i, i + 8);
          try {
            const vecs = await embed(slice);
            embeddings.push(...vecs);
            embedded += vecs.length;
          } catch (e) {
            console.error("embed batch failed", e);
            for (const _ of slice) embeddings.push([]);
          }
        }
      }

      const rows = chunks.map((t, i) => ({
        source_id: up!.id,
        chunk_index: i,
        text: t,
        token_count: Math.ceil(t.length / 4),
        embedding: embeddings[i] && embeddings[i].length > 0 ? JSON.stringify(embeddings[i]) : null,
      }));
      if (rows.length > 0) {
        const { error: cErr } = await supabaseAdmin.from("source_chunks").insert(rows as any);
        if (cErr) console.error("insert chunks failed", id, cErr.message);
      }
    }

    return {
      visited,
      textPages,
      savedNew,
      savedUpdated,
      skippedUnchanged,
      chunks: chunkTotal,
      embedded,
      fetchFailures,
      queueRemaining: queue.length,
    };
  });
