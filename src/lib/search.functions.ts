import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeQuery } from "./normalize-query";

const SearchInput = z.object({
  query: z.string().min(1).max(500),
  lang: z.enum(["he", "en"]).default("he"),
  limit: z.number().int().min(1).max(30).default(10),
});

function esc(s: string) {
  return s.replace(/[%_,()]/g, "\\$&");
}

export const searchSources = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }) => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();

    const raw = data.query.trim();
    const { terms } = normalizeQuery(raw);
    const searchTerms = terms.length > 0 ? terms : [raw];

    // Build OR filter: any term may appear in title/tree/text.
    const orParts: string[] = [];
    for (const t of searchTerms) {
      const like = `%${esc(t)}%`;
      orParts.push(`title.ilike.${like}`);
      orParts.push(`tree.ilike.${like}`);
      orParts.push(`text.ilike.${like}`);
    }

    let { data: rows, error } = await sb
      .from("sources")
      .select("id, source_provider, source_id, title, tree, tree_parts, excerpt, char_count, language, source_url")
      .or(orParts.join(","))
      .gte("char_count", 200)
      .limit(data.limit * 4);

    if (error) throw new Error(error.message);

    // Fallback: if nothing meets char_count >= 200, retry without the gate.
    if (!rows || rows.length === 0) {
      const r2 = await sb
        .from("sources")
        .select("id, source_provider, source_id, title, tree, tree_parts, excerpt, char_count, language")
        .or(orParts.join(","))
        .limit(data.limit * 2);
      rows = r2.data ?? [];
    }

    const scored = (rows ?? []).map((r: any) => {
      let score = 0;
      const title = (r.title ?? "").toLowerCase();
      const tree = (r.tree ?? "").toLowerCase();
      const excerpt = (r.excerpt ?? "").toLowerCase();
      for (const t of searchTerms) {
        const tl = t.toLowerCase();
        if (title.includes(tl)) score += 5;       // title weight A
        if (tree.includes(tl)) score += 3;        // tree weight B
        // approximate text-occurrence count via excerpt
        const occ = excerpt.split(tl).length - 1; // text weight C
        score += Math.min(occ, 5);
      }
      if ((r.char_count ?? 0) > 200) score += 1;  // readable-source boost
      score += Math.min((r.char_count ?? 0) / 2000, 1);
      return { ...r, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, data.limit) };
  });

