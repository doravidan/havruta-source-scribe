export type StudySegment = {
  index: number;
  title: string;
  text: string;
  charCount: number;
};

function stripHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function splitLongParagraph(paragraph: string, targetMax: number) {
  if (paragraph.length <= targetMax) return [paragraph];
  const parts = paragraph
    .split(/(?<=[.!?؟;:׃])\s+|(?<=[。！？])\s*/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length <= 1)
    return paragraph.match(new RegExp(`.{1,${targetMax}}`, "gs")) ?? [paragraph];

  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    const next = current ? `${current} ${part}` : part;
    if (next.length > targetMax && current) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function segmentSourceText(text: string, title = "קטע"): StudySegment[] {
  const clean = stripHtml(text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!clean) return [];

  const targetMin = 420;
  const targetMax = 900;
  const paragraphs = clean
    .split(/\n\s*\n/g)
    .flatMap((p) => splitLongParagraph(p.trim(), targetMax))
    .filter(Boolean);

  const segments: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > targetMax && current.length >= targetMin) {
      segments.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) segments.push(current);

  return segments.map((text, index) => ({
    index,
    title: `${title} ${index + 1}`,
    text,
    charCount: text.length,
  }));
}
