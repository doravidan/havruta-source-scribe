import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SearchInput = z.object({
  query: z.string().min(1).max(500),
  lang: z.enum(["he", "en"]).default("he"),
  limit: z.number().int().min(1).max(30).default(12),
});

export const searchSources = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }) => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();

    const q = data.query.trim();
    // Sanitize for websearch_to_tsquery — it's safe with arbitrary strings.
    // Run FTS via RPC-style filter using `text` ilike fallback plus trigram on title/tree.
    const escaped = q.replace(/[%_]/g, "\\$&");
    const like = `%${escaped}%`;

    const { data: rows, error } = await sb
      .from("sources")
      .select("id, title, tree, tree_parts, excerpt, char_count, language")
      .or(`title.ilike.${like},tree.ilike.${like},text.ilike.${like}`)
      .gte("char_count", 100)
      .order("char_count", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);

    // Light scoring: title match > tree match > body match
    const ql = q.toLowerCase();
    const scored = (rows ?? []).map((r: any) => {
      let score = 0;
      if (r.title?.toLowerCase().includes(ql)) score += 3;
      if (r.tree?.toLowerCase().includes(ql)) score += 2;
      score += Math.min(r.char_count / 2000, 1);
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);

    return { results: scored };
  });
