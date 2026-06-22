import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Daily study fetcher backed by Sefaria's open APIs.
 * Returns Hebrew text by default (English when lang === "en").
 *
 * Why Sefaria and not Chabad.org scraping:
 *  - Chabad.org's WAF blocks server-side fetches (HTTP 403) and the
 *    Hebrew variant is not consistently exposed at a stable URL, so
 *    the previous implementation kept falling back to English HTML.
 *  - Sefaria has a structured, free API with proper Hebrew versions.
 */

type FeatureKey =
  | "chumash"
  | "tehillim"
  | "tanya"
  | "rambam3"
  | "rambam1";

const SEFARIA_CAL: Record<
  Exclude<FeatureKey, "tehillim">,
  { calendarTitleEn: string; titleHe: string; titleEn: string; section: string }
> = {
  chumash: {
    calendarTitleEn: "Parashat Hashavua",
    titleHe: "חומש — פרשת השבוע",
    titleEn: "Chumash — Weekly Parsha",
    section: "חת״ת",
  },
  tanya: {
    calendarTitleEn: "Tanya Yomi",
    titleHe: "תניא — שיעור יומי",
    titleEn: "Tanya — daily lesson",
    section: "חת״ת",
  },
  rambam3: {
    calendarTitleEn: "Daily Rambam (3 Chapters)",
    titleHe: 'רמב"ם — ג׳ פרקים ליום',
    titleEn: "Rambam — 3 chapters/day",
    section: 'רמב"ם',
  },
  rambam1: {
    calendarTitleEn: "Daily Rambam",
    titleHe: 'רמב"ם — פרק אחד ליום',
    titleEn: "Rambam — 1 chapter/day",
    section: 'רמב"ם',
  },
};

const TEHILLIM_META = {
  titleHe: "תהלים — לפי ימי החודש",
  titleEn: "Tehillim — monthly cycle",
  section: "חת״ת",
};

const Input = z.object({
  feature: z.enum(["chumash", "tehillim", "tanya", "rambam3", "rambam1"]),
  lang: z.enum(["he", "en"]).optional().default("he"),
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function stripHtml(s: string): string {
  return s
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&thinsp;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/** Recursively flatten Sefaria's (possibly nested) text array into lines. */
function flattenText(node: unknown, depth = 0): string {
  if (node == null) return "";
  if (typeof node === "string") return stripHtml(node).trim();
  if (Array.isArray(node)) {
    const joiner = depth === 0 ? "\n\n" : "\n";
    return node
      .map((n) => flattenText(n, depth + 1))
      .filter(Boolean)
      .join(joiner);
  }
  return "";
}

/** Hebrew day-of-month (1-30) for `now`, as a number. */
function hebrewDayOfMonth(now: Date): number {
  const s = new Intl.DateTimeFormat("en-u-ca-hebrew-nu-latn", {
    day: "numeric",
  }).format(now);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 1;
}

/** Standard Chabad/monthly Tehillim cycle: Hebrew day → Sefaria ref. */
function tehillimRefForHebrewDay(day: number): string {
  const table: Record<number, string> = {
    1: "Psalms 1-9",
    2: "Psalms 10-17",
    3: "Psalms 18-22",
    4: "Psalms 23-28",
    5: "Psalms 29-34",
    6: "Psalms 35-38",
    7: "Psalms 39-43",
    8: "Psalms 44-48",
    9: "Psalms 49-54",
    10: "Psalms 55-59",
    11: "Psalms 60-65",
    12: "Psalms 66-68",
    13: "Psalms 69-71",
    14: "Psalms 72-76",
    15: "Psalms 77-78",
    16: "Psalms 79-82",
    17: "Psalms 83-87",
    18: "Psalms 88-89",
    19: "Psalms 90-96",
    20: "Psalms 97-103",
    21: "Psalms 104-105",
    22: "Psalms 106-107",
    23: "Psalms 108-112",
    24: "Psalms 113-118",
    25: "Psalms 119:1-96",
    26: "Psalms 119:97-176",
    27: "Psalms 120-134",
    28: "Psalms 135-139",
    29: "Psalms 140-144",
    30: "Psalms 145-150",
  };
  return table[day] ?? table[1];
}

type CalendarItem = {
  title: { en: string; he?: string };
  ref?: string;
  heRef?: string;
  displayValue?: { en?: string; he?: string };
};

async function getCalendarRef(
  calendarTitleEn: string,
): Promise<{ ref: string; heRef: string; displayHe: string; displayEn: string }> {
  const res = await fetch("https://www.sefaria.org/api/calendars", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`calendars fetch ${res.status}`);
  const json = (await res.json()) as { calendar_items: CalendarItem[] };
  const item = json.calendar_items.find((c) => c.title?.en === calendarTitleEn);
  if (!item?.ref) throw new Error(`Calendar item not found: ${calendarTitleEn}`);
  return {
    ref: item.ref,
    heRef: item.heRef ?? item.ref,
    displayHe: item.displayValue?.he ?? item.heRef ?? item.ref,
    displayEn: item.displayValue?.en ?? item.title?.en ?? item.ref,
  };
}

async function fetchSefariaText(
  ref: string,
  lang: "he" | "en",
): Promise<string> {
  const version = lang === "he" ? "hebrew" : "english";
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${version}&return_format=text_only`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`text fetch ${res.status}`);
  const json = (await res.json()) as {
    versions?: Array<{ text: unknown; language?: string }>;
  };
  const versions = json.versions ?? [];
  // Prefer the requested language; fall back to whatever is returned.
  const preferred =
    versions.find((v) => v.language === (lang === "he" ? "he" : "en")) ??
    versions[0];
  const text = flattenText(preferred?.text);
  return text;
}

export const getDailyStudySource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const day = todayIso();
    const cacheKey = `${data.feature}:${data.lang}:${day}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("sources")
      .select("id, char_count")
      .eq("source_provider", "sefaria-daily")
      .eq("source_id", cacheKey)
      .maybeSingle();

    if (existing?.id && (existing.char_count ?? 0) > 50) {
      return { id: existing.id as string, cached: true };
    }

    // Resolve ref + labels per feature.
    let ref: string;
    let displayHe: string;
    let displayEn: string;
    let section: string;
    let baseTitleHe: string;
    let baseTitleEn: string;

    if (data.feature === "tehillim") {
      const hDay = hebrewDayOfMonth(new Date());
      ref = tehillimRefForHebrewDay(hDay);
      displayHe = ref.replace(/^Psalms\s+/, "תהלים ");
      displayEn = ref;
      section = TEHILLIM_META.section;
      baseTitleHe = TEHILLIM_META.titleHe;
      baseTitleEn = TEHILLIM_META.titleEn;
    } else {
      const meta = SEFARIA_CAL[data.feature];
      const cal = await getCalendarRef(meta.calendarTitleEn);
      ref = cal.ref;
      displayHe = cal.displayHe;
      displayEn = cal.displayEn;
      section = meta.section;
      baseTitleHe = meta.titleHe;
      baseTitleEn = meta.titleEn;
    }

    let text = await fetchSefariaText(ref, data.lang);

    // If Hebrew version is empty for some reason, fall back to English.
    if ((!text || text.length < 30) && data.lang === "he") {
      text = await fetchSefariaText(ref, "en");
    }

    if (!text || text.length < 30) {
      throw new Error(`No text returned from Sefaria for ${ref}`);
    }

    const dateLabel = new Intl.DateTimeFormat(
      data.lang === "he" ? "he-u-ca-hebrew" : "en-u-ca-hebrew",
      { day: "numeric", month: "long", year: "numeric" },
    ).format(new Date());

    const baseTitle = data.lang === "he" ? baseTitleHe : baseTitleEn;
    const refLabel = data.lang === "he" ? displayHe : displayEn;
    const title = `${baseTitle} · ${refLabel}`;
    const treeParts = [
      data.lang === "he" ? "לימוד יומי" : "Daily Study",
      section,
      refLabel,
      dateLabel,
    ];

    const sourceUrl = `https://www.sefaria.org/${encodeURIComponent(
      ref.replace(/\s+/g, "_"),
    )}?lang=${data.lang === "he" ? "he" : "en"}`;

    const payload = {
      source_provider: "sefaria-daily",
      source_id: cacheKey,
      title,
      tree: treeParts.join(" > "),
      tree_parts: treeParts,
      language: data.lang,
      text,
      excerpt: text.slice(0, 280),
      char_count: text.length,
      source_url: sourceUrl,
      raw_payload: null,
      sha256: null,
      fetched_at: new Date().toISOString(),
      content_type: "daily-study",
    };

    const { data: up, error } = await supabaseAdmin
      .from("sources")
      .upsert(payload, { onConflict: "source_provider,source_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: up!.id as string, cached: false };
  });
