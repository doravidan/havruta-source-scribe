import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FEATURES = {
  chumash: {
    url: "https://www.chabad.org/dailystudy/torahreading.asp",
    titleHe: "חומש — שיעור יומי",
    titleEn: "Chumash — daily Aliyah",
    section: "חת״ת",
  },
  tehillim: {
    url: "https://www.chabad.org/dailystudy/tehillim.asp",
    titleHe: "תהלים — לפי ימי החודש",
    titleEn: "Tehillim — monthly cycle",
    section: "חת״ת",
  },
  tanya: {
    url: "https://www.chabad.org/dailystudy/tanya.asp",
    titleHe: "תניא — שיעור יומי",
    titleEn: "Tanya — daily lesson",
    section: "חת״ת",
  },
  rambam3: {
    url: "https://www.chabad.org/dailystudy/rambam.asp",
    titleHe: 'רמב"ם — ג׳ פרקים ליום',
    titleEn: "Rambam — 3 chapters/day",
    section: 'רמב"ם',
  },
  rambam1: {
    url: "https://www.chabad.org/dailystudy/rambam.asp?rambamChapters=1",
    titleHe: 'רמב"ם — פרק אחד ליום',
    titleEn: "Rambam — 1 chapter/day",
    section: 'רמב"ם',
  },
  sm: {
    url: "https://www.chabad.org/dailystudy/seferHamitzvos.asp",
    titleHe: "ספר המצוות — שיעור יומי",
    titleEn: "Sefer Hamitzvos — daily",
    section: 'רמב"ם',
  },
  sh1: {
    url: "https://www.chabad.org/dailystudy/shulchanAruchHarav.asp",
    titleHe: 'שו"ע הרב — סימן אחד ליום',
    titleEn: "Shulchan Aruch HaRav — 1 siman/day",
    section: 'שו"ע הרב',
  },
  sh2: {
    url: "https://www.chabad.org/dailystudy/shulchanAruchHarav.asp?shulchanAruchHarav=2",
    titleHe: 'שו"ע הרב — שני סימנים ליום',
    titleEn: "Shulchan Aruch HaRav — 2 simanim/day",
    section: 'שו"ע הרב',
  },
} as const;

type FeatureKey = keyof typeof FEATURES;

const Input = z.object({
  feature: z.enum(Object.keys(FEATURES) as [FeatureKey, ...FeatureKey[]]),
  lang: z.enum(["he", "en"]).optional().default("he"),
});

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function htmlToText(html: string): { title: string; text: string } {
  const noScript = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const titleMatch = noScript.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  // Try common Chabad.org content containers, then fallbacks.
  const candidates: RegExp[] = [
    /<div[^>]*id="Co_Content"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*\/Co_Content\s*-->/i,
    /<div[^>]*class="[^"]*\bco_content\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  ];

  let inner = noScript;
  for (const re of candidates) {
    const m = noScript.match(re);
    if (m && m[1] && m[1].length > 200) {
      inner = m[1];
      break;
    }
  }

  // Strip obviously non-content blocks by class hints.
  inner = inner
    .replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<div[^>]*class="[^"]*(menu|nav|footer|share|social|comment|related|ad-|advert|sidebar)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

  const text = inner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => decodeEntities(l).replace(/[ \t\u00A0]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const title = decodeEntities((titleMatch?.[1] ?? "").trim())
    .replace(/\s*-\s*Chabad\.org\s*$/i, "")
    .trim();

  return { title: title || "Daily Study", text };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch today's portion of a daily-study feature from chabad.org,
 * cache it as a row in `public.sources`, and return its id so the
 * existing SourceReader can preview it in-app.
 *
 * Idempotent per (feature, day): re-runs reuse the cached row.
 */
export const getDailyStudySource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const meta = FEATURES[data.feature];
    const day = todayIso();
    const cacheKey = `${data.feature}:${day}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("sources")
      .select("id, char_count")
      .eq("source_provider", "chabad-daily")
      .eq("source_id", cacheKey)
      .maybeSingle();

    if (existing?.id && (existing.char_count ?? 0) > 200) {
      return { id: existing.id as string, cached: true };
    }

    const browserHeaders = {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": data.lang === "he" ? "he-IL,he;q=0.9,en;q=0.8" : "en-US,en;q=0.9,he;q=0.8",
      "cache-control": "no-cache",
    } as const;

    async function tryFetch(url: string): Promise<string> {
      const res = await fetch(url, { headers: browserHeaders, redirect: "follow" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      return res.text();
    }

    let html = "";
    const attempts: string[] = [];
    try {
      html = await tryFetch(meta.url);
    } catch (e) {
      attempts.push(`direct: ${(e as Error).message}`);
      // Fallback to Jina reader proxy, which returns readable text/HTML.
      try {
        html = await tryFetch(`https://r.jina.ai/${meta.url}`);
      } catch (e2) {
        attempts.push(`r.jina.ai: ${(e2 as Error).message}`);
        throw new Error(
          `Failed to fetch daily study (${data.feature}) — ${attempts.join("; ")}`,
        );
      }
    }

    const { title: rawTitle, text } = htmlToText(html);
    if (!text || text.length < 50) {
      throw new Error("Daily study page had no extractable text");
    }

    const baseTitle = data.lang === "he" ? meta.titleHe : meta.titleEn;
    const dateLabel = new Intl.DateTimeFormat(
      data.lang === "he" ? "he-u-ca-hebrew" : "en-u-ca-hebrew",
      { day: "numeric", month: "long", year: "numeric" },
    ).format(new Date());
    const title = `${baseTitle} · ${dateLabel}`;
    const treeParts = [
      data.lang === "he" ? "לימוד יומי" : "Daily Study",
      meta.section,
      rawTitle || baseTitle,
    ];

    const payload = {
      source_provider: "chabad-daily",
      source_id: cacheKey,
      title,
      tree: treeParts.join(" > "),
      tree_parts: treeParts,
      language: data.lang,
      text,
      excerpt: text.slice(0, 280),
      char_count: text.length,
      source_url: meta.url,
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
