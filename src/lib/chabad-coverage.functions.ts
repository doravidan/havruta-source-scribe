import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHABAD_ROOT_IDS } from "./chabad-clean";

const CHABAD_API = "https://chabadlibrary.org/books/api/main?path=";

async function fetchChildIds(id: string): Promise<string[]> {
  try {
    const res = await fetch(CHABAD_API + encodeURIComponent(id), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    const j: any = await res.json();
    const data = j?.content?.data;
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.children)
      ? data.children
      : [];
    return arr
      .filter((c: any) => c && (typeof c.id === "string" || typeof c.id === "number"))
      .map((c: any) => String(c.id));
  } catch {
    return [];
  }
}

/**
 * Coverage report for ChabadLibrary roots.
 * - ingestedSources/totalChunks/embeddedChunks: exact, from DB.
 * - estimatedPages: rough BFS estimate up to maxFetchesPerRoot HTTP calls.
 *   When depth=1, returns top-level section count. depth=2 (default) sums
 *   grandchildren — usually a closer floor on real page count.
 */
export const chabadCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d ?? {}) as { depth?: number; maxFetchesPerRoot?: number };
    return {
      depth: Math.max(1, Math.min(3, x.depth ?? 2)),
      maxFetchesPerRoot: Math.max(1, Math.min(200, x.maxFetchesPerRoot ?? 60)),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // DB: all chabadlibrary sources.
    const { data: sources, error: srcErr } = await supabaseAdmin
      .from("sources")
      .select("id, tree_parts, char_count")
      .eq("source_provider", "chabadlibrary");
    if (srcErr) throw new Error(srcErr.message);

    // DB: chunk totals + embedded counts, batched.
    const chunkBySource = new Map<string, { total: number; embedded: number }>();
    const ids = (sources ?? []).map((s: any) => s.id);
    const BATCH = 400;
    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH);
      const { data: chunks, error } = await supabaseAdmin
        .from("source_chunks")
        .select("source_id, embedding")
        .in("source_id", slice);
      if (error) throw new Error(error.message);
      for (const c of chunks ?? []) {
        const e = chunkBySource.get(c.source_id) ?? { total: 0, embedded: 0 };
        e.total++;
        if (c.embedding != null) e.embedded++;
        chunkBySource.set(c.source_id, e);
      }
    }

    // Per-root rows.
    const rows = await Promise.all(
      CHABAD_ROOT_IDS.map(async (r) => {
        // Match ingested sources by tree_parts[0] label.
        const matched = (sources ?? []).filter((s: any) => {
          const tp = Array.isArray(s.tree_parts) ? s.tree_parts : [];
          return tp[0] === r.label_he || tp[0] === r.label_en;
        });
        let totalChunks = 0;
        let embeddedChunks = 0;
        let chars = 0;
        for (const s of matched as any[]) {
          const cs = chunkBySource.get(s.id);
          if (cs) {
            totalChunks += cs.total;
            embeddedChunks += cs.embedded;
          }
          chars += s.char_count ?? 0;
        }

        // BFS estimate of pages.
        let fetches = 0;
        let estimatedPages = 0;
        const seen = new Set<string>([r.id]);
        let frontier: string[] = [r.id];
        for (let d = 0; d < data.depth; d++) {
          const next: string[] = [];
          for (const node of frontier) {
            if (fetches >= data.maxFetchesPerRoot) break;
            fetches++;
            const children = await fetchChildIds(node);
            if (children.length === 0) {
              // Leaf — count as 1 page.
              if (d > 0) estimatedPages++;
            } else {
              for (const c of children) {
                if (!seen.has(c)) {
                  seen.add(c);
                  next.push(c);
                }
              }
              // At the final depth, treat children as pages.
              if (d === data.depth - 1) estimatedPages += children.length;
            }
          }
          frontier = next;
          if (frontier.length === 0) break;
        }

        const truncated = fetches >= data.maxFetchesPerRoot && frontier.length > 0;
        const ingestedSources = matched.length;
        const coveragePct =
          estimatedPages > 0
            ? Math.min(100, Math.round((ingestedSources / estimatedPages) * 100))
            : null;
        const embeddedPct =
          totalChunks > 0 ? Math.round((embeddedChunks / totalChunks) * 100) : null;

        return {
          id: r.id,
          label_he: r.label_he,
          label_en: r.label_en,
          ingestedSources,
          totalChunks,
          embeddedChunks,
          chars,
          estimatedPages,
          estimateTruncated: truncated,
          coveragePct,
          embeddedPct,
        };
      }),
    );

    return {
      depth: data.depth,
      rows,
      generatedAt: new Date().toISOString(),
    };
  });
