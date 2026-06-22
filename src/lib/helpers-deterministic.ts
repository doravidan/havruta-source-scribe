// Deterministic, no-AI helper for Yiddish translation.

const YIDDISH_DICT: Array<{ yi: string; he: string; en: string }> = [
  { yi: "וואס", he: "מה", en: "what" },
  { yi: "איז", he: "הוא", en: "is" },
  { yi: "דער ענין", he: "העניין / הנקודה הפנימית", en: "the matter / the inner point" },
  { yi: "א איד", he: "יהודי", en: "a Jew" },
  { yi: "דער אויבערשטער", he: "הקב\"ה", en: "the Almighty" },
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

export function deterministicHelper(q: string, lang: "he" | "en"): string | null {
  return tryYiddishHelper(q, lang);
}
