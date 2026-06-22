// Pure helpers for cleaning ChabadLibrary content + extracting structure.

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function cleanChabadText(input: unknown): string {
  if (input == null) return "";
  let s = String(input);

  // Remove ChabadLibrary footnote/cup markers (with or without content/attrs).
  s = s.replace(/\[\/?cup[^\]]*\]/gi, "");
  s = s.replace(/\[\/?ftnref[^\]]*\]/gi, "");
  s = s.replace(/\[ftn[^\]]*\][\s\S]*?\[\/ftn[^\]]*\]/gi, "");
  s = s.replace(/\[\/?ftn[^\]]*\]/gi, "");
  // Generic remaining bracketed markers like [b], [/b], [hr], [pic ...]
  s = s.replace(/\[[a-zA-Z\/][^\]]{0,80}\]/g, "");

  // Convert <br> and block-level tags to newlines before stripping.
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n\n");
  // Strip remaining HTML tags.
  s = s.replace(/<[^>]+>/g, "");

  // Decode the most common entities.
  s = s.replace(/&[a-zA-Z#0-9]+;/g, (m) => HTML_ENTITIES[m] ?? " ");

  // Normalize whitespace, preserve paragraph breaks.
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  return s.trim();
}

export interface ChabadNode {
  type?: string;
  tree?: Array<{ heading?: string }>;
  data?: unknown;
}

export interface ExtractedNode {
  contentType: string;
  tree: string;
  treeParts: string[];
  title: string;
  childIds: string[];
  text: string;
}

export function extractChabadNode(content: ChabadNode | undefined, fallbackId: string): ExtractedNode {
  const c = content ?? {};
  const contentType = (c.type as string) || "sections";
  const treeParts = Array.isArray(c.tree)
    ? c.tree.map((n) => (n && typeof n.heading === "string" ? n.heading.trim() : "")).filter(Boolean)
    : [];
  const tree = treeParts.join(" > ");
  const title = treeParts[treeParts.length - 1] || fallbackId;

  const childIds: string[] = [];
  const data = c.data as any;

  if (Array.isArray(data)) {
    for (const child of data) {
      if (child && (typeof child.id === "string" || typeof child.id === "number")) {
        childIds.push(String(child.id));
      }
    }
  } else if (data && typeof data === "object" && Array.isArray(data.children)) {
    for (const child of data.children) {
      if (child && (typeof child.id === "string" || typeof child.id === "number")) {
        childIds.push(String(child.id));
      }
    }
  }

  let text = "";
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const t = cleanChabadText(data.text);
    const h = cleanChabadText(data.haoros);
    text = [t, h].filter(Boolean).join("\n\n").trim();
  }

  return { contentType, tree, treeParts, title, childIds, text };
}

export const CHABAD_ROOT_IDS: Array<{ id: string; label_en: string; label_he: string }> = [
  { id: "3400000000", label_en: "Tanya", label_he: "תניא" },
  { id: "1300000000", label_en: "Likkutei Sichos", label_he: "לקוטי שיחות" },
  { id: "1400000000", label_en: "Torat Menachem", label_he: "תורת מנחם" },
  { id: "1500000000", label_en: "Maamarim Melukatim", label_he: "מאמרים מלוקטים" },
  { id: "1200000000", label_en: "Igrot Kodesh of the Rebbe", label_he: "אגרות קודש של הרבי" },
  { id: "1100000000", label_en: "Sifrei the Rebbe", label_he: "ספרי כ״ק אדמו״ר" },
  { id: "500000000", label_en: "Sifrei Admor Hazaken", label_he: "ספרי אדמו״ר הזקן" },
  { id: "6500000000", label_en: "Igrot Kodesh Admor Hazaken", label_he: "אגרות קודש אדמו״ר הזקן" },
];
