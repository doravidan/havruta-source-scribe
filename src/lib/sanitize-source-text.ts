/**
 * Cleans legacy Firecrawl-style scraped text so the reader and the
 * segmenter only see the canonical (usually Hebrew) source content.
 *
 * Handles a few specific artifacts found in older Chabad.org ingestions:
 *   - "Title: ...", "URL Source: ...", "Markdown Content:" header lines
 *   - "[](https://...)" bracket-link wrappers around verse numbers
 *   - raw http(s) URLs embedded in the body
 *   - bilingual English translations interleaved with the Hebrew text,
 *     when the source is marked Hebrew
 */
export function sanitizeSourceText(text: string | null | undefined, language?: string | null): string {
  if (!text) return "";
  let s = text;

  // Drop firecrawl scrape headers
  s = s.replace(/^\s*(Title|URL Source|Markdown Content)\s*:.*$/gim, "");
  // Drop "[](url)" link wrappers and raw URLs
  s = s.replace(/\[\]\([^)]*\)/g, "");
  s = s.replace(/https?:\/\/\S+/g, "");

  if (language === "he") {
    // Strip Latin letters, ASCII digits, and the curly quotes used by the
    // English translation column. Hebrew letters, niqqud, cantillation,
    // punctuation and whitespace are preserved.
    s = s.replace(/[A-Za-z0-9“”"']+/g, "");
    // Keep only lines that still contain Hebrew (or are blank separators),
    // then drop whitespace-separated tokens that have no Hebrew letter
    // (orphaned punctuation like ", , ?  -" left over from removed English).
    s = s
      .split("\n")
      .filter((l) => /[\u0590-\u05FF]/.test(l) || l.trim() === "")
      .map((l) =>
        l
          .split(/\s+/)
          .filter((tok) => tok === "" || /[\u0590-\u05FF]/.test(tok))
          .join(" "),
      )
      .join("\n");
    // Collapse runs of the same punctuation mark left adjacent after removal.
    s = s.replace(/([,.;:?!\-־])(\s*\1)+/g, "$1");
    // Remove standalone punctuation tokens sitting between spaces.
    s = s.replace(/(^|\s)[,.;:?!\-־]+(?=\s|$)/g, "$1");
    // Collapse leftover double spaces.
    s = s.replace(/[ \t]{2,}/g, " ");
  }

  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/ ?\n ?/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}
