import { isLearningSource, learningKind, learningPath, sortKey, type SourceLike } from "./source-taxonomy";

export type LibraryLeaf = {
  id: string;
  title: string | null;
  char_count?: number | null;
  language?: string | null;
  tree_parts?: string[] | null;
  learning_path: string[];
  learning_kind?: string;
};

export type LibraryFolder = {
  label: string;
  count: number;
  kind?: string;
};

export type LibraryNode = {
  path: string[];
  children: LibraryFolder[];
  leaves: LibraryLeaf[];
  total: number;
};

export type SequenceNeighbor = {
  id: string;
  label: string;
};

export type SourceSequence = {
  path: string[];
  current: { id: string; label: string; index: number; total: number };
  prev: SequenceNeighbor | null;
  next: SequenceNeighbor | null;
  kind: string;
};

export type EnrichedSource = SourceLike & {
  id: string;
  language?: string | null;
  learning_path: string[];
  learning_kind: string;
};

function hasPrefix(path: string[], prefix: string[]) {
  return prefix.every((part, index) => path[index] === part);
}

export function leafLabel(leaf: Pick<LibraryLeaf, "title" | "learning_path">): string {
  return leaf.learning_path.at(-1) ?? leaf.title ?? "…";
}

export function sortLibraryLeaves<T extends Pick<LibraryLeaf, "title" | "learning_path">>(leaves: T[]): T[] {
  return [...leaves].sort((a, b) =>
    sortKey(leafLabel(a)).localeCompare(sortKey(leafLabel(b)), "he"),
  );
}

export function sortLibraryFolders(children: LibraryFolder[]): LibraryFolder[] {
  return [...children].sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label), "he"));
}

export function enrichLearningSources<T extends SourceLike & { id: string }>(rows: T[]): EnrichedSource[] {
  return rows
    .map((source) => {
      const path = learningPath(source);
      return {
        ...source,
        learning_path: path,
        learning_kind: learningKind(path),
      };
    })
    .filter(isLearningSource) as EnrichedSource[];
}

export function buildLibraryNode(path: string[], learningRows: EnrichedSource[]): LibraryNode {
  const scoped = learningRows.filter((source) => hasPrefix(source.learning_path, path));
  const depth = path.length;
  const childCounts = new Map<string, LibraryFolder>();
  const leaves: LibraryLeaf[] = [];

  for (const source of scoped) {
    const next = source.learning_path[depth];
    if (next) {
      const existing = childCounts.get(next);
      if (existing) existing.count += 1;
      else childCounts.set(next, { label: next, count: 1, kind: depth === 0 ? "book" : "section" });
    } else {
      leaves.push({
        id: source.id,
        title: source.title ?? null,
        char_count: source.char_count ?? null,
        language: source.language ?? null,
        tree_parts: source.tree_parts ?? null,
        learning_path: source.learning_path,
        learning_kind: source.learning_kind,
      });
    }
  }

  return {
    path,
    children: sortLibraryFolders([...childCounts.values()]),
    leaves: sortLibraryLeaves(leaves),
    total: scoped.length,
  };
}

function neighborFromLeaf(leaf: LibraryLeaf | null | undefined): SequenceNeighbor | null {
  if (!leaf) return null;
  return { id: leaf.id, label: leafLabel(leaf) };
}

function siblingGroupKey(path: string[]) {
  return path.join("\u0000");
}

function getSiblingsAtDepth(learningRows: EnrichedSource[], target: EnrichedSource): EnrichedSource[] {
  const parentPrefix = target.learning_path.slice(0, -1);
  return learningRows.filter((row) => {
    if (row.learning_path.length !== target.learning_path.length) return false;
    return parentPrefix.every((part, index) => row.learning_path[index] === part);
  });
}

function sortedSiblingLeaves(siblings: EnrichedSource[]): LibraryLeaf[] {
  return sortLibraryLeaves(
    siblings.map((source) => ({
      id: source.id,
      title: source.title ?? null,
      char_count: source.char_count ?? null,
      language: source.language ?? null,
      tree_parts: source.tree_parts ?? null,
      learning_path: source.learning_path,
      learning_kind: source.learning_kind,
    })),
  );
}

function folderLabel(path: string[]) {
  return path.at(-1) ?? "";
}

function siblingFoldersAtDepth(
  learningRows: EnrichedSource[],
  grandparentPath: string[],
  pathLength: number,
): string[] {
  const folderIndex = grandparentPath.length;
  const folders = new Set<string>();
  for (const row of learningRows) {
    if (row.learning_path.length !== pathLength) continue;
    if (!hasPrefix(row.learning_path, grandparentPath)) continue;
    const folder = row.learning_path[folderIndex];
    if (folder) folders.add(folder);
  }
  return sortLibraryFolders([...folders].map((label) => ({ label, count: 0 }))).map((f) => f.label);
}

/** Resolve prev/next within a folder, crossing into adjacent volumes/sections when needed. */
export function resolveSourceSequence(
  learningRows: EnrichedSource[],
  sourceId: string,
): SourceSequence | null {
  const target = learningRows.find((row) => row.id === sourceId);
  if (!target) return null;

  const siblings = getSiblingsAtDepth(learningRows, target);
  const leaves = sortedSiblingLeaves(siblings);
  const index = leaves.findIndex((leaf) => leaf.id === sourceId);
  if (index < 0) return null;

  const kind = target.learning_kind ?? learningKind(target.learning_path);
  const parentPath = target.learning_path.slice(0, -1);
  let prev = index > 0 ? neighborFromLeaf(leaves[index - 1]) : null;
  let next = index < leaves.length - 1 ? neighborFromLeaf(leaves[index + 1]) : null;

  if (!prev && parentPath.length > 0) {
    const grandparentPath = parentPath.slice(0, -1);
    const folders = siblingFoldersAtDepth(learningRows, grandparentPath, target.learning_path.length);
    const currentFolder = folderLabel(parentPath);
    const folderIndex = folders.indexOf(currentFolder);
    if (folderIndex > 0) {
      const prevFolder = folders[folderIndex - 1];
      const prevFolderPath = [...grandparentPath, prevFolder];
      const prevSiblings = learningRows.filter(
        (row) =>
          row.learning_path.length === target.learning_path.length &&
          siblingGroupKey(row.learning_path.slice(0, -1)) === siblingGroupKey(prevFolderPath),
      );
      prev = neighborFromLeaf(sortedSiblingLeaves(prevSiblings).at(-1) ?? null);
    }
  }

  if (!next && parentPath.length > 0) {
    const grandparentPath = parentPath.slice(0, -1);
    const folders = siblingFoldersAtDepth(learningRows, grandparentPath, target.learning_path.length);
    const currentFolder = folderLabel(parentPath);
    const folderIndex = folders.indexOf(currentFolder);
    if (folderIndex >= 0 && folderIndex < folders.length - 1) {
      const nextFolder = folders[folderIndex + 1];
      const nextFolderPath = [...grandparentPath, nextFolder];
      const nextSiblings = learningRows.filter(
        (row) =>
          row.learning_path.length === target.learning_path.length &&
          siblingGroupKey(row.learning_path.slice(0, -1)) === siblingGroupKey(nextFolderPath),
      );
      next = neighborFromLeaf(sortedSiblingLeaves(nextSiblings)[0] ?? null);
    }
  }

  return {
    path: parentPath,
    current: {
      id: sourceId,
      label: leafLabel({ title: target.title ?? null, learning_path: target.learning_path }),
      index: index + 1,
      total: leaves.length,
    },
    prev,
    next,
    kind,
  };
}

export function resolveSourceSequenceFromLeaves(
  leaves: LibraryLeaf[],
  sourceId: string,
  path: string[] = [],
): SourceSequence | null {
  const sorted = sortLibraryLeaves(leaves);
  const index = sorted.findIndex((leaf) => leaf.id === sourceId);
  if (index < 0) return null;

  const current = sorted[index];
  const kind = current.learning_kind ?? learningKind(current.learning_path);

  return {
    path,
    current: {
      id: sourceId,
      label: leafLabel(current),
      index: index + 1,
      total: sorted.length,
    },
    prev: index > 0 ? neighborFromLeaf(sorted[index - 1]) : null,
    next: index < sorted.length - 1 ? neighborFromLeaf(sorted[index + 1]) : null,
    kind,
  };
}

const NAV_LABELS: Record<string, { he: { prev: string; next: string }; en: { prev: string; next: string } }> = {
  day: {
    he: { prev: "יום קודם", next: "יום הבא" },
    en: { prev: "Previous day", next: "Next day" },
  },
  sicha: {
    he: { prev: "שיחה קודמת", next: "שיחה הבאה" },
    en: { prev: "Previous sicha", next: "Next sicha" },
  },
  maamar: {
    he: { prev: "מאמר קודם", next: "מאמר הבא" },
    en: { prev: "Previous maamar", next: "Next maamar" },
  },
  chapter: {
    he: { prev: "פרק קודם", next: "פרק הבא" },
    en: { prev: "Previous chapter", next: "Next chapter" },
  },
  source: {
    he: { prev: "קודם", next: "הבא" },
    en: { prev: "Previous", next: "Next" },
  },
};

export function sequenceNavLabels(kind: string, lang: "he" | "en") {
  const labels = NAV_LABELS[kind] ?? NAV_LABELS.source;
  return labels[lang];
}
