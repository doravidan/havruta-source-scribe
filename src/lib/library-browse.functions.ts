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
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();
    const { data: rows, error } = await sb
      .from("sources")
      .select("id, title, tree, tree_parts, char_count, language, text")
      .gte("char_count", 250)
      .limit(6000);
    if (error) throw new Error(error.message);

    const all = (rows ?? []) as Parameters<typeof enrichLearningSources>[0];
    const learningRows = enrichLearningSources(all);
    const node = buildLibraryNode(data.path, learningRows);

    return {
      ...node,
      rawTotal: all.length,
    };
  });
