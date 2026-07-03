import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  enrichLearningSources,
  resolveSourceSequence,
  type SourceSequence,
} from "./library-sequence";

const Input = z.object({
  sourceId: z.string().uuid(),
});

export type AdjacentSourcesResult = SourceSequence;

export const getAdjacentSources = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<AdjacentSourcesResult> => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();
    const { data: rows, error } = await sb
      .from("sources")
      .select("id, title, tree, tree_parts, char_count, language, text")
      .gte("char_count", 250)
      .limit(6000);
    if (error) throw new Error(error.message);

    const learningRows = enrichLearningSources((rows ?? []) as Parameters<typeof enrichLearningSources>[0]);
    const sequence = resolveSourceSequence(learningRows, data.sourceId);
    if (!sequence) throw new Error("not_in_library_sequence");
    return sequence;
  });
