// Parser for Sefaria-style Hebrew text into clean HTML.
// Handles HTML entities, inline tags ({פ}, {ס}, {ש}), verse markers, and bracketed notes.

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: "\u00A0", thinsp: "\u2009", ensp: "\u2002", emsp: "\u2003",
  hairsp: "\u200A", zwj: "\u200D", zwnj: "\u200C", lrm: "\u200E", rlm: "\u200F",
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  ldquo: "\u201C", rdquo: "\u201D", lsquo: "\u2018", rsquo: "\u2019",
  hellip: "\u2026", ndash: "\u2013", mdash: "\u2014", middot: "\u00B7",
  sup1: "\u00B9", sup2: "\u00B2", sup3: "\u00B3",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (Number.isFinite(code)) {
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return m;
    }
    return NAMED_ENTITIES[body] ?? m;
  });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Normalize spacing/punctuation without touching Hebrew letters/niqqud/te'amim.
function normalizeWhitespace(s: string): string {
  return s
    // Strip soft hyphens
    .replace(/\u00AD/g, "")
    // Tabs and runs of non-newline whitespace → single space
    .replace(/[ \t\u2000-\u200A\u202F\u205F\u3000]+/g, " ")
    // Trim spaces around sof pasuq and maqaf
    .replace(/ *׃ */g, "׃ ")
    .replace(/ *־ */g, "־")
    // Spaces before common punctuation
    .replace(/ +([,.;:!?])/g, "$1")
    // Collapse 3+ newlines → 2
    .replace(/\n{3,}/g, "\n\n");
}

// Convert Sefaria's inline section tags into paragraph breaks.
//   {פ} → petucha (open, blank line)
//   {ס} → setuma (closed, single break)
//   {ש} → shirah marker, treat as break
//   {פ׳ X} / {ס׳ X} variants handled too.
function stripSectionTags(s: string): string {
  return s
    .replace(/\s*\{\s*פ[^}]*\}\s*/g, "\n\n")
    .replace(/\s*\{\s*ס[^}]*\}\s*/g, "\n")
    .replace(/\s*\{\s*ש[^}]*\}\s*/g, "\n\n")
    // Strip any other lone curly-brace annotations like {1}, {a}
    .replace(/\{[^}{\n]{1,40}\}/g, "");
}

// Strip bracketed footnote markers like [1], [א], (פירוש: …)
function stripStrayMarkers(s: string): string {
  return s.replace(/\[\s*\d+\s*\]/g, "");
}

export type ParseOptions = {
  highlight?: string;
};

export type ParseResult = {
  html: string;
  matchCount: number;
};

export function parseSefariaText(raw: string, opts: ParseOptions = {}): ParseResult {
  if (!raw) return { html: "", matchCount: 0 };
  let text = decodeEntities(raw);
  text = stripSectionTags(text);
  text = stripStrayMarkers(text);
  text = normalizeWhitespace(text);
  text = text.replace(/\r\n/g, "\n").trim();

  const needle = opts.highlight?.trim() ?? "";
  const re = needle ? new RegExp(escapeReg(needle), "gi") : null;
  let matchCount = 0;

  const highlight = (s: string): string => {
    const esc = escapeHtml(s);
    if (!re) return esc;
    return esc.replace(re, (m) => {
      matchCount++;
      return `<mark class="rounded px-0.5" style="background:oklch(0.80 0.13 80 / 0.35);color:inherit">${m}</mark>`;
    });
  };

  // Wrap "פסוק X." prefix in a styled badge and keep the verse on its own line.
  const renderVerse = (line: string): string => {
    const m = line.match(/^(פסוק\s+[^\.\s]+\.?)\s*(.*)$/);
    if (!m) return highlight(line);
    return (
      `<span class="inline-block me-2 px-1.5 py-0.5 rounded text-[0.75em] font-semibold ` +
      `bg-[color:var(--saffron-soft,#fff7e0)] text-[var(--indigo-deep)] border border-[var(--saffron)]/40 align-middle">` +
      `${highlight(m[1])}</span>${highlight(m[2])}`
    );
  };

  const parts: string[] = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    const rendered: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // markdown-ish headers preserved from the previous renderer
      let m: RegExpMatchArray | null;
      if (/^---+$/.test(line)) {
        rendered.push('<hr class="my-4 border-[var(--saffron)]/30" />');
        continue;
      }
      if ((m = line.match(/^#\s+(.*)$/))) {
        rendered.push(`<div class="mt-5 mb-2 text-[1.25em] font-bold text-[var(--indigo-deep)]">${highlight(m[1])}</div>`);
        continue;
      }
      if ((m = line.match(/^##\s+(.*)$/))) {
        rendered.push(`<div class="mt-4 mb-2 text-[1.1em] font-semibold text-[var(--indigo-deep)] border-b border-[var(--saffron)]/40 pb-1">${highlight(m[1])}</div>`);
        continue;
      }
      if ((m = line.match(/^###\s+(.*)$/))) {
        rendered.push(`<div class="mt-3 mb-1 text-[0.95em] font-semibold text-[var(--saffron)] uppercase tracking-wide">${highlight(m[1])}</div>`);
        continue;
      }
      rendered.push(renderVerse(line));
    }
    if (rendered.length) {
      parts.push(`<p class="mb-4 leading-loose">${rendered.join("<br/>")}</p>`);
    }
  }

  return { html: parts.join("\n"), matchCount };
}
