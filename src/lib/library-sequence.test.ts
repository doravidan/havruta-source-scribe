import { describe, expect, it } from "vitest";
import {
  buildLibraryNode,
  enrichLearningSources,
  resolveSourceSequence,
  resolveSourceSequenceFromLeaves,
  sortLibraryLeaves,
} from "./library-sequence";

const rows = enrichLearningSources([
  {
    id: "a1",
    title: "שיחה א",
    tree: "לקוטי שיחות > כרך א > שיחה א",
    tree_parts: ["לקוטי שיחות", "כרך א", "שיחה א"],
    char_count: 500,
    text: "x".repeat(500),
  },
  {
    id: "a2",
    title: "שיחה ב",
    tree: "לקוטי שיחות > כרך א > שיחה ב",
    tree_parts: ["לקוטי שיחות", "כרך א", "שיחה ב"],
    char_count: 500,
    text: "x".repeat(500),
  },
  {
    id: "b1",
    title: "שיחה א",
    tree: "לקוטי שיחות > כרך ב > שיחה א",
    tree_parts: ["לקוטי שיחות", "כרך ב", "שיחה א"],
    char_count: 500,
    text: "x".repeat(500),
  },
  {
    id: "c1",
    title: "פרק א",
    tree: "תניא > פרק א",
    tree_parts: ["תניא", "פרק א"],
    char_count: 800,
    text: "x".repeat(800),
  },
  {
    id: "c2",
    title: "פרק ב",
    tree: "תניא > פרק ב",
    tree_parts: ["תניא", "פרק ב"],
    char_count: 800,
    text: "x".repeat(800),
  },
]);

describe("buildLibraryNode", () => {
  it("groups volume folders under a book", () => {
    const node = buildLibraryNode(["לקוטי שיחות"], rows);
    expect(node.children.map((child) => child.label)).toEqual(["כרך א", "כרך ב"]);
  });
});

describe("resolveSourceSequence", () => {
  it("returns next and prev within the same folder", () => {
    const seq = resolveSourceSequence(rows, "a1");
    expect(seq?.next?.id).toBe("a2");
    expect(seq?.prev).toBeNull();
    expect(seq?.current.index).toBe(1);
    expect(seq?.current.total).toBe(2);
  });

  it("crosses into the next volume at the last leaf", () => {
    const seq = resolveSourceSequence(rows, "a2");
    expect(seq?.next?.id).toBe("b1");
  });

  it("crosses into the previous volume at the first leaf", () => {
    const seq = resolveSourceSequence(rows, "b1");
    expect(seq?.prev?.id).toBe("a2");
  });
});

describe("resolveSourceSequenceFromLeaves", () => {
  it("orders chapter leaves in a sibling list", () => {
    const tanyaRows = rows.filter((row) => row.learning_path[0] === "תניא");
    const leaves = sortLibraryLeaves(
      tanyaRows.map((row) => ({
        id: row.id,
        title: row.title ?? null,
        learning_path: row.learning_path,
      })),
    );
    const seq = resolveSourceSequenceFromLeaves(leaves, "c2");
    expect(seq?.prev?.id).toBe("c1");
  });
});

describe("sortLibraryLeaves", () => {
  it("sorts Hebrew chapter labels", () => {
    const leaves = sortLibraryLeaves([
      { id: "2", title: "פרק ב", learning_path: ["תניא", "פרק ב"] },
      { id: "1", title: "פרק א", learning_path: ["תניא", "פרק א"] },
    ]);
    expect(leaves.map((leaf) => leaf.id)).toEqual(["1", "2"]);
  });
});
