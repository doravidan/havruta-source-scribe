// Chunking helper, server-only side effects only (pure functions).
const TARGET = 800;
const OVERLAP = 100;

export function chunkText(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
  if (!text) return [];
  // Paragraph-first split
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (!buf) { buf = p; continue; }
    if (buf.length + p.length + 1 <= TARGET * 1.4) {
      buf += "\n\n" + p;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf) chunks.push(buf);

  // Split oversize chunks at sentence/punctuation boundaries
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= TARGET * 1.6) { out.push(c); continue; }
    let i = 0;
    while (i < c.length) {
      const end = Math.min(i + TARGET, c.length);
      let cut = end;
      if (end < c.length) {
        // try to find a punctuation break in the last 200 chars
        const slice = c.slice(i, end);
        const m = slice.match(/[.!?…׃׀\u05c3]\s|[\.!?]\s/g);
        if (m) {
          const last = slice.lastIndexOf(m[m.length - 1]);
          if (last > TARGET / 2) cut = i + last + m[m.length - 1].length;
        }
      }
      const piece = c.slice(i, cut).trim();
      if (piece) out.push(piece);
      if (cut >= c.length) break;
      i = Math.max(cut - OVERLAP, i + 1);
    }
  }
  return out;
}

export function makeExcerpt(text: string, n = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= n ? clean : clean.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
