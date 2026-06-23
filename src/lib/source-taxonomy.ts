export type SourceLike = {
  id?: string;
  title?: string | null;
  tree?: string | null;
  tree_parts?: string[] | null;
  char_count?: number | null;
  text?: string | null;
};

const PUBLISHER_ROOT_RE = /^(ספרי|מאגר|חב["״]?ד|chabad|rebbe|אוצר|כתבי)/i;
const NOISE_RE =
  /(תוכן\s*ענינים|תוכן העניינים|מפתח|לוח|שער הספר|שער|הקדמת המו["״]?ל|פתח דבר|עמוד\s*\d+|^עמוד$|^page\b|contents|index|table of contents|title page)/i;

function cleanPart(part: string) {
  return part.replace(/\s+/g, " ").trim();
}

export function sourceParts(source: SourceLike) {
  const raw =
    source.tree_parts && source.tree_parts.length > 0
      ? source.tree_parts
      : source.tree
        ? source.tree.split(/\s*>\s*/)
        : [];
  return raw.map(cleanPart).filter(Boolean);
}

export function isLearningSource(source: SourceLike) {
  const title = source.title ?? "";
  const tree = source.tree ?? sourceParts(source).join(" ");
  const text = source.text ?? "";
  const charCount = source.char_count ?? text.length;
  if (charCount < 250) return false;
  if (NOISE_RE.test(title) || NOISE_RE.test(tree)) return false;
  return true;
}

export function learningPath(source: SourceLike) {
  let parts = sourceParts(source);
  while (parts.length > 1 && PUBLISHER_ROOT_RE.test(parts[0])) parts = parts.slice(1);

  if (parts.length === 0) return [source.title || "מקור ללא כותרת"];
  if (parts.length === 1) return [parts[0]];

  const last = parts[parts.length - 1];
  const title = cleanPart(source.title ?? "");
  const unit = title && title !== last && !parts.includes(title) ? title : last;
  return [...parts.slice(0, -1), unit];
}

export function learningKind(path: string[]) {
  const unit = path[path.length - 1] ?? "";
  if (/שיחה|sicha|sichah|לקוטי שיחות|ליקוטי שיחות/i.test(path.join(" "))) return "sicha";
  if (/מאמר|maamar|באתי לגני/i.test(path.join(" "))) return "maamar";
  if (/פרק|chapter|תניא|שער היחוד|אגרת/i.test(unit + " " + path.join(" "))) return "chapter";
  return "source";
}

export function sortKey(label: string) {
  const normalized = label
    .replace(/^חלק\s+/, "")
    .replace(/^כרך\s+/, "")
    .replace(/^פרק\s+/, "")
    .replace(/^שיחה\s+/, "")
    .trim();
  const hebrewNums: Record<string, number> = {
    א: 1,
    ב: 2,
    ג: 3,
    ד: 4,
    ה: 5,
    ו: 6,
    ז: 7,
    ח: 8,
    ט: 9,
    י: 10,
    יא: 11,
    יב: 12,
    יג: 13,
    יד: 14,
    טו: 15,
    טז: 16,
    יז: 17,
    יח: 18,
    יט: 19,
    כ: 20,
  };
  const n = Number(normalized.match(/\d+/)?.[0] ?? hebrewNums[normalized]);
  return Number.isFinite(n) ? String(n).padStart(4, "0") + label : "9999" + label;
}
