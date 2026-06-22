// Deterministic, no-AI helpers for Yiddish translation and Rashi script.

const YIDDISH_DICT: Array<{ yi: string; he: string; en: string }> = [
  { yi: "וואס", he: "מה", en: "what" },
  { yi: "איז", he: "הוא", en: "is" },
  { yi: "דער ענין", he: "העניין / הנקודה הפנימית", en: "the matter / the inner point" },
  { yi: "א איד", he: "יהודי", en: "a Jew" },
  { yi: "דער אויבערשטער", he: "הקב\"ה", en: "the Almighty" },
];

const RASHI_PAIRS = [
  { pair: "ד / ר", he: "ד׳ – פינה חדה / זווית קטנה. ר׳ – פינה מעוגלת.", en: "Dalet has a sharp corner / small extension. Resh is rounder." },
  { pair: "ב / כ", he: "ב׳ – סגורה יותר. כ׳ – פתוחה יותר.", en: "Bet is more closed; Kaf is more open." },
  { pair: "ה / ח", he: "ה׳ – פתח פנימי בצד שמאל. ח׳ – סגורה למעלה.", en: "Hei has an inner opening; Chet is closed on top." },
];

export function tryYiddishHelper(q: string, lang: "he" | "en"): string | null {
  const lower = q.toLowerCase();
  if (!/(yiddish|יידיש|אידיש|translate|תרגם|תרגום)/.test(lower)) return null;
  const lines = YIDDISH_DICT.map((d) =>
    lang === "he" ? `• ${d.yi} = ${d.he}` : `• ${d.yi} = ${d.en}`,
  );
  const head = lang === "he"
    ? "מילון מיני יידיש→עברית (דטרמיניסטי, ללא AI):"
    : "Mini Yiddish→English glossary (deterministic, no AI):";
  return [head, ...lines].join("\n");
}

export function tryRashiHelper(q: string, lang: "he" | "en"): string | null {
  if (!/(rashi|רש״י|רשי|כתב\s*רש)/i.test(q)) return null;
  const head = lang === "he"
    ? "הבחנה בין אותיות בכתב רש״י:"
    : "How to tell confusing Rashi-script letters apart:";
  const lines = RASHI_PAIRS.map((r) =>
    lang === "he" ? `• ${r.pair} — ${r.he}` : `• ${r.pair} — ${r.en}`,
  );
  return [head, ...lines].join("\n");
}

export function deterministicHelper(q: string, lang: "he" | "en"): string | null {
  return tryYiddishHelper(q, lang) ?? tryRashiHelper(q, lang);
}
