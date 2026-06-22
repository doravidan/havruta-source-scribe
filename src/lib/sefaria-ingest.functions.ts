import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only ingest job that pulls curated text slices from Sefaria's
 * public API into our `sources` + `source_chunks` tables.
 *
 * Each "slice" is one self-contained work (e.g. a Torah book, Tehillim,
 * a Tanya part). The job iterates chapter-by-chapter and upserts one
 * row per chapter so progress is resumable: re-run with the returned
 * `nextChapter` to continue.
 *
 * NOTE: we hit Sefaria's live API rather than the ~26 GB Hugging Face
 * mirror because the Cloudflare Worker runtime has no filesystem to
 * unpack the mirror into.
 */

type Slice = {
  key: string;
  baseRef: string;              // Sefaria English ref base, e.g. "Genesis", "Psalms", "Likutei Amarim"
  chapters: number;             // total chapter count
  titleHe: string;
  titleEn: string;
  tree_parts: string[];
};

export const SEFARIA_SLICES: Slice[] = [
  // ── Torah ────────────────────────────────────────────────────────
  { key: "torah-genesis",     baseRef: "Genesis",     chapters: 50, titleHe: "בראשית", titleEn: "Genesis",     tree_parts: ['תנ"ך', "תורה", "בראשית"] },
  { key: "torah-exodus",      baseRef: "Exodus",      chapters: 40, titleHe: "שמות",   titleEn: "Exodus",      tree_parts: ['תנ"ך', "תורה", "שמות"] },
  { key: "torah-leviticus",   baseRef: "Leviticus",   chapters: 27, titleHe: "ויקרא",  titleEn: "Leviticus",   tree_parts: ['תנ"ך', "תורה", "ויקרא"] },
  { key: "torah-numbers",     baseRef: "Numbers",     chapters: 36, titleHe: "במדבר",  titleEn: "Numbers",     tree_parts: ['תנ"ך', "תורה", "במדבר"] },
  { key: "torah-deuteronomy", baseRef: "Deuteronomy", chapters: 34, titleHe: "דברים",  titleEn: "Deuteronomy", tree_parts: ['תנ"ך', "תורה", "דברים"] },

  // ── Tehillim ─────────────────────────────────────────────────────
  { key: "tehillim", baseRef: "Psalms", chapters: 150, titleHe: "תהלים", titleEn: "Psalms", tree_parts: ['תנ"ך', "כתובים", "תהלים"] },

  // ── Tanya (5 parts) ──────────────────────────────────────────────
  { key: "tanya-likkutei-amarim",  baseRef: "Likutei Amarim",                chapters: 53, titleHe: "ליקוטי אמרים", titleEn: "Likkutei Amarim",   tree_parts: ["חסידות", 'חב"ד', "תניא", "ליקוטי אמרים"] },
  { key: "tanya-shaar-hayichud",   baseRef: "Shaar HaYichud VehaEmunah",     chapters: 12, titleHe: "שער הייחוד והאמונה", titleEn: "Shaar HaYichud VehaEmunah", tree_parts: ["חסידות", 'חב"ד', "תניא", "שער הייחוד והאמונה"] },
  { key: "tanya-iggeret-hateshuvah", baseRef: "Iggeret HaTeshuvah",          chapters: 12, titleHe: "אגרת התשובה", titleEn: "Iggeret HaTeshuvah", tree_parts: ["חסידות", 'חב"ד', "תניא", "אגרת התשובה"] },
  { key: "tanya-iggeret-hakodesh", baseRef: "Iggeret HaKodesh",              chapters: 32, titleHe: "אגרת הקודש",  titleEn: "Iggeret HaKodesh",   tree_parts: ["חסידות", 'חב"ד', "תניא", "אגרת הקודש"] },
  { key: "tanya-kuntres-acharon",  baseRef: "Kuntres Acharon",               chapters: 9,  titleHe: "קונטרס אחרון", titleEn: "Kuntres Acharon",   tree_parts: ["חסידות", 'חב"ד', "תניא", "קונטרס אחרון"] },

  // ── Shulchan Aruch HaRav (Orach Chayim) ──────────────────────────
  { key: "shu-orach-chayim", baseRef: "Shulchan Arukh HaRav, Orach Chayim", chapters: 489, titleHe: 'שולחן ערוך הרב — אורח חיים', titleEn: "Shulchan Aruch HaRav — Orach Chayim", tree_parts: ["הלכה", "שולחן ערוך הרב", "אורח חיים"] },
];

const Input = z.object({
  sliceKey: z.string().min(1),
  startChapter: z.number().int().min(1).default(1),
  maxChapters: z.number().int().min(1).max(50).default(20),
  language: z.enum(["he", "en"]).default("he"),
  embed: z.boolean().default(true),
});

/* ─── small helpers (duplicated from daily-study.functions for isolation) ─── */

function stripHtml(s: string): string {
  return s
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<i[^>]*class="footnote"[^>]*>[\s\S]*?<\/i>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function flattenVerses(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === "string") {
    const s = stripHtml(node).replace(/\s+/g, " ").trim();
    return s ? [s] : [];
  }
  if (Array.isArray(node)) return node.flatMap((n) => flattenVerses(n));
  return [];
}

function heNumeral(n: number): string {
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  if (n <= 0) return String(n);
  if (n === 15) return "ט״ו";
  if (n === 16) return "ט״ז";
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    const letters = (tens[t] ?? "") + (ones[o] ?? "");
    return letters.length > 1 ? `${letters.slice(0, -1)}״${letters.slice(-1)}` : `${letters}׳`;
  }
  // 100s — rough but readable
  return String(n);
}

type SefariaV3 = {
  versions?: Array<{ text: unknown; language?: string }>;
  heRef?: string;
  ref?: string;
  book?: string;
  sections?: string[];
  sectionNames?: string[];
};

async function fetchChapter(ref: string, lang: "he" | "en"): Promise<SefariaV3> {
  const version = lang === "he" ? "hebrew" : "english";
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${version}&return_format=text_only`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`sefaria ${res.status} ${ref}`);
  return (await res.json()) as SefariaV3;
}

function pickText(json: SefariaV3, lang: "he" | "en"): unknown {
  const versions = json.versions ?? [];
  return (versions.find((v) => v.language === (lang === "he" ? "he" : "en")) ?? versions[0])?.text;
}

function formatChapter(json: SefariaV3, lang: "he" | "en", slice: Slice, chapterNum: number): string {
  const raw = pickText(json, lang);
  const verses = flattenVerses(raw);
  const isHe = lang === "he";
  const isPsalms = slice.baseRef === "Psalms";
  const isHalacha = slice.baseRef.startsWith("Shulchan Arukh") || slice.baseRef.startsWith("Mishneh Torah");
  const chapterWord = isHe ? (isPsalms ? "מזמור" : isHalacha ? "סימן" : "פרק") : isPsalms ? "Psalm" : isHalacha ? "Siman" : "Chapter";
  const verseWord = isHe ? (isHalacha ? "סעיף" : "פסוק") : isHalacha ? "Paragraph" : "Verse";

  const title = isHe ? slice.titleHe : slice.titleEn;
  const chapLabel = isHe ? `${chapterWord} ${heNumeral(chapterNum)}` : `${chapterWord} ${chapterNum}`;
  const parts: string[] = [`# ${title}`, `## ${chapLabel}`, "---"];

  verses.forEach((v, i) => {
    const n = i + 1;
    const label = isHe ? `${verseWord} ${heNumeral(n)}.` : `${verseWord} ${chapterNum}:${n}.`;
    parts.push(`${label} ${v}`);
  });
  return parts.join("\n\n");
}

/* ─── main ingest fn ─── */

export const ingestSefariaSlice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // admin check
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error("role_check_failed: " + roleErr.message);
    if (!isAdmin) throw new Error("forbidden");

    const slice = SEFARIA_SLICES.find((s) => s.key === data.sliceKey);
    if (!slice) throw new Error("unknown_slice");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, makeExcerpt, sha256 } = await import("./chunking");
    const { embed } = await import("./ai-gateway.server");

    const endChapter = Math.min(slice.chapters, data.startChapter + data.maxChapters - 1);

    let fetched = 0, savedNew = 0, savedUpdated = 0, skippedUnchanged = 0;
    let chunkTotal = 0, embedded = 0, failures = 0;
    const errors: string[] = [];

    for (let ch = data.startChapter; ch <= endChapter; ch++) {
      const ref = `${slice.baseRef} ${ch}`;
      try {
        const json = await fetchChapter(ref, data.language);
        fetched++;
        const text = formatChapter(json, data.language, slice, ch);
        if (!text || text.length < 40) {
          failures++;
          errors.push(`${ref}: empty text`);
          continue;
        }

        const hash = await sha256(text);
        const source_id = `${slice.key}:${ch}:${data.language}`;
        const labelHe = json.heRef ?? `${slice.titleHe} ${heNumeral(ch)}`;
        const labelEn = json.ref ?? ref;
        const title = data.language === "he"
          ? `${slice.titleHe} · ${labelHe.split(" ").slice(-1).join(" ")}`
          : labelEn;
        const treeParts = [...slice.tree_parts, data.language === "he" ? `${slice.titleHe.includes("מזמור") ? "מזמור" : "פרק"} ${heNumeral(ch)}` : `Chapter ${ch}`];

        const { data: existing } = await supabaseAdmin
          .from("sources")
          .select("id, sha256")
          .eq("source_provider", "sefaria")
          .eq("source_id", source_id)
          .maybeSingle();

        const payload = {
          source_provider: "sefaria",
          source_id,
          title,
          tree: treeParts.join(" > "),
          tree_parts: treeParts,
          language: data.language,
          text,
          excerpt: makeExcerpt(text.replace(/^#+\s.*$/gm, "")),
          char_count: text.length,
          source_url: `https://www.sefaria.org/${encodeURIComponent(ref.replace(/\s+/g, "_"))}?lang=${data.language}`,
          raw_payload: null,
          sha256: hash,
          fetched_at: new Date().toISOString(),
          content_type: "text",
        };

        const { data: up, error: upErr } = await supabaseAdmin
          .from("sources")
          .upsert(payload, { onConflict: "source_provider,source_id" })
          .select("id")
          .single();
        if (upErr) throw new Error("upsert: " + upErr.message);

        if (existing) {
          if (existing.sha256 === hash) {
            skippedUnchanged++;
            continue;
          }
          savedUpdated++;
        } else {
          savedNew++;
        }

        // (Re)chunk + embed
        await supabaseAdmin.from("source_chunks").delete().eq("source_id", up!.id);
        const chunks = chunkText(text);
        chunkTotal += chunks.length;

        const embeddings: number[][] = [];
        if (data.embed && chunks.length > 0) {
          for (let i = 0; i < chunks.length; i += 8) {
            const slc = chunks.slice(i, i + 8);
            try {
              const vecs = await embed(slc);
              embeddings.push(...vecs);
              embedded += vecs.length;
            } catch (e) {
              console.error("embed batch", e);
              for (const _ of slc) embeddings.push([]);
            }
          }
        }

        const rows = chunks.map((t, i) => ({
          source_id: up!.id,
          chunk_index: i,
          text: t,
          token_count: Math.ceil(t.length / 4),
          embedding: embeddings[i] && embeddings[i].length > 0 ? JSON.stringify(embeddings[i]) : null,
        }));
        if (rows.length > 0) {
          const { error: cErr } = await supabaseAdmin.from("source_chunks").insert(rows as any);
          if (cErr) throw new Error("chunks: " + cErr.message);
        }
      } catch (e: any) {
        failures++;
        errors.push(`${ref}: ${e?.message ?? String(e)}`);
      }
    }

    const nextChapter = endChapter < slice.chapters ? endChapter + 1 : null;
    return {
      slice: slice.key,
      fetched, savedNew, savedUpdated, skippedUnchanged,
      chunks: chunkTotal, embedded, failures,
      processedRange: [data.startChapter, endChapter] as [number, number],
      totalChapters: slice.chapters,
      nextChapter,
      errors: errors.slice(0, 5),
    };
  });

/** Lightweight listing for the admin UI. No auth — read-only static data. */
export const listSefariaSlices = createServerFn({ method: "GET" }).handler(async () => {
  return SEFARIA_SLICES.map((s) => ({
    key: s.key,
    titleHe: s.titleHe,
    titleEn: s.titleEn,
    chapters: s.chapters,
    tree: s.tree_parts.join(" > "),
  }));
});
