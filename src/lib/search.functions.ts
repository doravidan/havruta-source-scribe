import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isLearningSource, learningKind, learningPath } from "./source-taxonomy";

const SearchInput = z.object({
  query: z.string().min(1).max(500),
  lang: z.enum(["he", "en"]).default("he"),
  limit: z.number().int().min(1).max(30).default(10),
});

function esc(s: string) {
  return s.replace(/[%_,()]/g, "\\$&");
}

type SourceSearchRow = {
  id: string;
  source_provider: string | null;
  source_id: string | null;
  title: string | null;
  tree: string | null;
  tree_parts: string[] | null;
  excerpt: string | null;
  char_count: number | null;
  language: string | null;
  source_url: string | null;
};

export const searchSources = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }) => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();

    const raw = data.query.trim();
    // Exact phrase search: match the full query string as a single substring,
    // not individual words. Normalize quotes/niqqud but keep the phrase intact.
    const normalized = raw
      .replace(/[\u2018\u2019\u05F3]/g, "'")
      .replace(/[\u201C\u201D\u05F4]/g, '"')
      .replace(/[\u0591-\u05C7]/g, "")
      .trim();
    const phrase = normalized.length > 0 ? normalized : raw;

    const like = `%${esc(phrase)}%`;
    const orFilter = [`title.ilike.${like}`, `tree.ilike.${like}`, `text.ilike.${like}`].join(",");

    const first = await sb
      .from("sources")
      .select(
        "id, source_provider, source_id, title, tree, tree_parts, excerpt, char_count, language, source_url",
      )
      .or(orFilter)
      .gte("char_count", 200)
      .limit(data.limit * 4);

    if (first.error) throw new Error(first.error.message);
    let rows = (first.data ?? []) as unknown as SourceSearchRow[];

    // Fallback: if nothing meets char_count >= 200, retry without the gate.
    if (!rows || rows.length === 0) {
      const r2 = await sb
        .from("sources")
        .select(
          "id, source_provider, source_id, title, tree, tree_parts, excerpt, char_count, language, source_url",
        )
        .or(orFilter)
        .limit(data.limit * 2);
      rows = (r2.data ?? []) as unknown as SourceSearchRow[];
    }

    const needle = phrase.toLowerCase();
    const scored = rows.filter(isLearningSource).map((r) => {
      const path = learningPath(r);
      const kind = learningKind(path);
      let score = 0;
      const title = (r.title ?? "").toLowerCase();
      const tree = (r.tree ?? "").toLowerCase();
      const excerpt = (r.excerpt ?? "").toLowerCase();
      const pathText = path.join(" ").toLowerCase();
      if (title.includes(needle)) score += 12;
      if (pathText.includes(needle)) score += 8;
      if (tree.includes(needle)) score += 4;
      if (kind === "sicha" || kind === "maamar") score += 3;
      const occ = excerpt.split(needle).length - 1;
      score += Math.min(occ * 2, 10);
      if ((r.char_count ?? 0) > 450) score += 2;
      score += Math.min((r.char_count ?? 0) / 2500, 1);
      return { ...r, learning_path: path, learning_kind: kind, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, data.limit) };
  });
