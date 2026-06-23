import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isLearningSource, learningKind, learningPath, sortKey } from "./source-taxonomy";

const Input = z.object({
  path: z.array(z.string()).max(20).default([]),
});

export type LibraryNode = {
  path: string[];
  children: { label: string; count: number; kind?: string }[];
  leaves: {
    id: string;
    title: string | null;
    char_count: number | null;
    language: string | null;
    tree_parts: string[] | null;
    learning_path?: string[];
    learning_kind?: string;
  }[];
  total: number;
  rawTotal: number;
};

type SourceRow = {
  id: string;
  title: string | null;
  char_count: number | null;
  language: string | null;
  tree: string | null;
  tree_parts: string[] | null;
  text?: string | null;
};

function hasPrefix(path: string[], prefix: string[]) {
  return prefix.every((part, index) => path[index] === part);
}

export const browseLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<LibraryNode> => {
    const { getPublicServerClient } = await import("./supabase-public.server");
    const sb = getPublicServerClient();
    const { data: rows, error } = await sb
      .from("sources")
      .select("id, title, tree, tree_parts, char_count, language")
      .gte("char_count", 250)
      .limit(6000);
    if (error) throw new Error(error.message);

    const all = ((rows ?? []) as SourceRow[]).map((source) => {
      const path = learningPath(source);
      return {
        ...source,
        learning_path: path,
        learning_kind: learningKind(path),
      };
    });
    const learningRows = all.filter(isLearningSource);
    const scoped = learningRows.filter((source) => hasPrefix(source.learning_path, data.path));
    const depth = data.path.length;

    const childCounts = new Map<string, { label: string; count: number; kind?: string }>();
    const leaves: LibraryNode["leaves"] = [];

    for (const source of scoped) {
      const next = source.learning_path[depth];
      if (next) {
        const existing = childCounts.get(next);
        if (existing) existing.count += 1;
        else
          childCounts.set(next, { label: next, count: 1, kind: depth === 0 ? "book" : "section" });
      } else {
        leaves.push({
          id: source.id,
          title: source.title,
          char_count: source.char_count,
          language: source.language,
          tree_parts: source.tree_parts,
          learning_path: source.learning_path,
          learning_kind: source.learning_kind,
        });
      }
    }

    return {
      path: data.path,
      children: [...childCounts.values()].sort((a, b) =>
        sortKey(a.label).localeCompare(sortKey(b.label), "he"),
      ),
      leaves: leaves.sort((a, b) =>
        sortKey(a.learning_path?.at(-1) ?? a.title ?? "").localeCompare(
          sortKey(b.learning_path?.at(-1) ?? b.title ?? ""),
          "he",
        ),
      ),
      total: scoped.length,
      rawTotal: all.length,
    };
  });
