import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEq } from "@/lib/timing-safe-eq.server";

const CHABAD_API = "https://chabadlibrary.org/books/api/main?path=";
const CHABAD_URL = "https://chabadlibrary.org/books/";

/**
 * Background crawl tick. Public endpoint (idempotent — claim_chabad_crawl_batch
 * uses SKIP LOCKED so concurrent calls don't double-process). Each call:
 *   - claims up to N pending items
 *   - fetches each from ChabadLibrary
 *   - enqueues child IDs
 *   - if the node has text, ingests + embeds it
 * Called by pg_cron once per minute until queue empties.
 */
export const Route = createFileRoute("/api/public/hooks/chabad-crawl-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require shared-secret bearer (set as CRAWL_TICK_SECRET; called by pg_cron).
        const expected = process.env.CRAWL_TICK_SECRET;
        if (!expected) {
          return new Response("Server misconfigured", { status: 503 });
        }
        const authz = request.headers.get("authorization") ?? "";
        const provided = authz.toLowerCase().startsWith("bearer ")
          ? authz.slice(7).trim()
          : "";
        if (!provided || !timingSafeEq(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { cleanChabadText, extractChabadNode } = await import("@/lib/chabad-clean");
        const { chunkText, makeExcerpt, sha256 } = await import("@/lib/chunking");
        const { embed } = await import("@/lib/ai-gateway.server");

        let body: any = {};
        try {
          body = await request.json();
        } catch {}
        const batchSize = Math.max(1, Math.min(20, Number(body.batchSize) || 6));

        const { data: batch, error: bErr } = await supabaseAdmin.rpc(
          "claim_chabad_crawl_batch",
          { batch_size: batchSize },
        );
        if (bErr) {
          return Response.json({ error: bErr.message }, { status: 500 });
        }
        if (!batch || (batch as any[]).length === 0) {
          return Response.json({ status: "idle", processed: 0 });
        }

        let processed = 0;
        let queued = 0;
        let ingested = 0;
        let errors = 0;

        for (const item of batch as any[]) {
          try {
            const res = await fetch(CHABAD_API + encodeURIComponent(item.chabad_id), {
              headers: { accept: "application/json" },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const extracted = extractChabadNode(json?.content, item.chabad_id);

            // Enqueue children.
            if (extracted.childIds.length > 0) {
              const rows = extracted.childIds.map((cid) => ({
                chabad_id: String(cid),
                root_id: item.root_id,
                status: "pending",
              }));
              const { error: qErr } = await supabaseAdmin
                .from("chabad_crawl_queue")
                .upsert(rows, { onConflict: "chabad_id", ignoreDuplicates: true });
              if (!qErr) queued += rows.length;
            }

            // Ingest text if present.
            if (extracted.text && extracted.text.length >= 40) {
              const cleaned = extracted.text;
              const hash = await sha256(cleaned);
              const { data: existing } = await supabaseAdmin
                .from("sources")
                .select("id, sha256")
                .eq("source_provider", "chabadlibrary")
                .eq("source_id", item.chabad_id)
                .maybeSingle();

              if (!existing || existing.sha256 !== hash) {
                const payload = {
                  source_provider: "chabadlibrary",
                  source_id: item.chabad_id,
                  title: cleanChabadText(extracted.title) || item.chabad_id,
                  tree: extracted.tree,
                  tree_parts: extracted.treeParts,
                  language: "he",
                  text: cleaned,
                  excerpt: makeExcerpt(cleaned),
                  char_count: cleaned.length,
                  source_url: CHABAD_URL + item.chabad_id,
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
                if (upErr) throw new Error("upsert: " + upErr.message);

                await supabaseAdmin.from("source_chunks").delete().eq("source_id", up!.id);

                const chunks = chunkText(cleaned);
                const embeddings: number[][] = [];
                for (let i = 0; i < chunks.length; i += 8) {
                  const slice = chunks.slice(i, i + 8);
                  try {
                    const vecs = await embed(slice);
                    embeddings.push(...vecs);
                  } catch (e) {
                    console.error("embed batch failed", e);
                    for (const _ of slice) embeddings.push([]);
                  }
                }
                const chunkRows = chunks.map((t, i) => ({
                  source_id: up!.id,
                  chunk_index: i,
                  text: t,
                  token_count: Math.ceil(t.length / 4),
                  embedding:
                    embeddings[i] && embeddings[i].length > 0
                      ? JSON.stringify(embeddings[i])
                      : null,
                }));
                if (chunkRows.length > 0) {
                  const { error: cErr } = await supabaseAdmin
                    .from("source_chunks")
                    .insert(chunkRows as any);
                  if (cErr) throw new Error("chunks: " + cErr.message);
                }
                ingested++;
              }
            }

            await supabaseAdmin
              .from("chabad_crawl_queue")
              .update({ status: "done", processed_at: new Date().toISOString() })
              .eq("id", item.id);
            processed++;
          } catch (e: any) {
            errors++;
            const msg = String(e?.message ?? e).slice(0, 500);
            const finalStatus = (item.attempts ?? 0) >= 4 ? "failed" : "pending";
            await supabaseAdmin
              .from("chabad_crawl_queue")
              .update({ status: finalStatus, last_error: msg })
              .eq("id", item.id);
          }
        }

        return Response.json({
          status: "ok",
          processed,
          queued,
          ingested,
          errors,
          batchSize: (batch as any[]).length,
        });
      },
    },
  },
});
