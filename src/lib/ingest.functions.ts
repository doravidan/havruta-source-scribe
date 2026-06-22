import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SourceInput = z.object({
  source_provider: z.string().min(1).default("manual"),
  source_id: z.string().min(1),
  title: z.string().min(1),
  tree: z.string().optional().default(""),
  tree_parts: z.array(z.string()).optional().default([]),
  language: z.enum(["he", "en"]).optional().default("he"),
  text: z.string().min(1),
  source_url: z.string().url().optional().nullable(),
  raw_payload: z.any().optional().nullable(),
});

const Input = z.object({
  sources: z.array(SourceInput).min(1).max(50),
  embed: z.boolean().optional().default(true),
});

export const ingestSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // Verify admin
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("role_check_failed: " + roleErr.message);
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, makeExcerpt, sha256 } = await import("./chunking");
    const { embed } = await import("./ai-gateway.server");

    let inserted = 0, updated = 0, chunkTotal = 0, embedded = 0;

    for (const src of data.sources) {
      const cleaned = src.text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
      const hash = await sha256(cleaned);
      const excerpt = makeExcerpt(cleaned);
      const payload = {
        source_provider: src.source_provider,
        source_id: src.source_id,
        title: src.title,
        tree: src.tree ?? "",
        tree_parts: src.tree_parts ?? [],
        language: src.language ?? "he",
        text: cleaned,
        excerpt,
        char_count: cleaned.length,
        source_url: src.source_url ?? null,
        raw_payload: src.raw_payload ?? null,
        sha256: hash,
        fetched_at: new Date().toISOString(),
        content_type: "text",
      };

      // Check if exists
      const { data: existing } = await supabaseAdmin
        .from("sources")
        .select("id, sha256")
        .eq("source_provider", src.source_provider)
        .eq("source_id", src.source_id)
        .maybeSingle();

      const { data: up, error: upErr } = await supabaseAdmin
        .from("sources")
        .upsert(payload, { onConflict: "source_provider,source_id" })
        .select("id")
        .single();
      if (upErr) throw new Error("upsert_source: " + upErr.message);

      const sourceId = up!.id;
      if (existing) updated++; else inserted++;

      // Skip rechunking if same hash
      if (existing && existing.sha256 === hash) continue;

      // Delete old chunks
      await supabaseAdmin.from("source_chunks").delete().eq("source_id", sourceId);

      const chunks = chunkText(cleaned);
      chunkTotal += chunks.length;

      // Embed in batches
      let embeddings: number[][] = [];
      if (data.embed && chunks.length > 0) {
        const batchSize = 8;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const slice = chunks.slice(i, i + batchSize);
          try {
            const vecs = await embed(slice);
            embeddings.push(...vecs);
            embedded += vecs.length;
          } catch (e) {
            console.error("embed batch failed", e);
            // pad with nulls
            for (const _ of slice) embeddings.push([]);
          }
        }
      }

      const rows = chunks.map((t, i) => ({
        source_id: sourceId,
        chunk_index: i,
        text: t,
        token_count: Math.ceil(t.length / 4),
        embedding: embeddings[i] && embeddings[i].length > 0 ? JSON.stringify(embeddings[i]) : null,
      }));

      if (rows.length > 0) {
        const { error: cErr } = await supabaseAdmin.from("source_chunks").insert(rows as any);
        if (cErr) throw new Error("insert_chunks: " + cErr.message);
      }
    }

    return { inserted, updated, chunks: chunkTotal, embedded };
  });

export const seedCorpus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const seed = (await import("@/data/seed-sources.json")).default as any[];
    // Call ingestSources logic directly by re-invoking server fn would re-check auth; just import handler logic by duplicating minimal call.
    // Easier: re-use by inlining the same flow via direct admin client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, makeExcerpt, sha256 } = await import("./chunking");
    const { embed } = await import("./ai-gateway.server");

    let inserted = 0, updated = 0, chunkTotal = 0, embedded = 0;
    for (const src of seed) {
      const cleaned = String(src.text).trim();
      const hash = await sha256(cleaned);
      const { data: existing } = await supabaseAdmin
        .from("sources")
        .select("id, sha256")
        .eq("source_provider", src.source_provider)
        .eq("source_id", src.source_id)
        .maybeSingle();

      const { data: up, error } = await supabaseAdmin.from("sources").upsert({
        source_provider: src.source_provider,
        source_id: src.source_id,
        title: src.title,
        tree: src.tree ?? "",
        tree_parts: src.tree_parts ?? [],
        language: src.language ?? "he",
        text: cleaned,
        excerpt: makeExcerpt(cleaned),
        char_count: cleaned.length,
        sha256: hash,
        fetched_at: new Date().toISOString(),
        content_type: "text",
      }, { onConflict: "source_provider,source_id" }).select("id").single();
      if (error) throw new Error(error.message);
      if (existing) updated++; else inserted++;
      if (existing && existing.sha256 === hash) continue;

      await supabaseAdmin.from("source_chunks").delete().eq("source_id", up!.id);
      const chunks = chunkText(cleaned);
      chunkTotal += chunks.length;
      let embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += 8) {
        const slice = chunks.slice(i, i + 8);
        try {
          const vecs = await embed(slice);
          embeddings.push(...vecs);
          embedded += vecs.length;
        } catch (e) {
          console.error("embed", e);
          for (const _ of slice) embeddings.push([]);
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
        await supabaseAdmin.from("source_chunks").insert(rows as any);
      }
    }
    return { inserted, updated, chunks: chunkTotal, embedded };
  });
