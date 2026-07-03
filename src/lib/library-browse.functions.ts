import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildLibraryNode, enrichLearningSources, type LibraryNode } from "./library-sequence";

const Input = z.object({
  path: z.array(z.string()).max(20).default([]),
});

export type { LibraryNode, LibraryLeaf } from "./library-sequence";

export const browseLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<LibraryNode & { rawTotal: number }> => {
    const t0 = performance.now();
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();

    const tQuery = performance.now();
    const { data: rows, error } = await sb
      .from("sources")
      .select("id, title, tree, tree_parts, char_count, language")
      .gte("char_count", 250)
      .limit(6000);
    const queryMs = performance.now() - tQuery;

    if (error) {
      console.error("[library-browse] query failed", {
        path: data.path,
        queryMs: Math.round(queryMs),
        code: (error as { code?: string }).code,
        message: error.message,
      });
      throw new Error(error.message);
    }

    const all = (rows ?? []) as Parameters<typeof enrichLearningSources>[0];

    const tEnrich = performance.now();
    const learningRows = enrichLearningSources(all);
    const enrichMs = performance.now() - tEnrich;

    const tBuild = performance.now();
    const node = buildLibraryNode(data.path, learningRows);
    const buildMs = performance.now() - tBuild;

    const totalMs = performance.now() - t0;
    const log = {
      path: data.path,
      pathDepth: data.path.length,
      rawRows: all.length,
      learningRows: learningRows.length,
      children: node.children.length,
      leaves: node.leaves.length,
      queryMs: Math.round(queryMs),
      enrichMs: Math.round(enrichMs),
      buildMs: Math.round(buildMs),
      totalMs: Math.round(totalMs),
    };
    if (totalMs > 1500 || queryMs > 1000) {
      console.warn("[library-browse] SLOW", log);
    } else {
      console.log("[library-browse] ok", log);
    }

    return { ...node, rawTotal: all.length };
  });
