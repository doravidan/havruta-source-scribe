// Query normalization for hybrid keyword search.

const TRANSLIT: Record<string, string> = {
  dirah: "דירה",
  dira: "דירה",
  betachtonim: "בתחתונים",
  "b'tachtonim": "בתחתונים",
  tachtonim: "בתחתונים",
  bittul: "ביטול",
  bitul: "ביטול",
  hashem: "השם",
  chassidus: "חסידות",
  chasidus: "חסידות",
  tanya: "תניא",
  rebbe: "רבי",
  moshiach: "משיח",
  mashiach: "משיח",
  neshama: "נשמה",
  neshamah: "נשמה",
};

const STOP_HE = new Set([
  "מה","מי","של","את","עם","על","איך","למה","זה","זו","הוא","היא","הם","הן","הפירוש","פירוש","בחסידות",
]);
const STOP_EN = new Set([
  "explain","what","does","mean","in","english","the","is","a","an","of","to","and","for","on","by",
]);

// Strip Hebrew niqqud (U+0591–U+05C7) and cantillation.
function stripNiqqud(s: string) {
  return s.replace(/[\u0591-\u05C7]/g, "");
}
function normalizeQuotes(s: string) {
  return s
    .replace(/[\u2018\u2019\u05F3]/g, "'")
    .replace(/[\u201C\u201D\u05F4]/g, '"');
}

export function normalizeQuery(raw: string): { terms: string[]; normalized: string } {
  let q = (raw ?? "").toLowerCase();
  q = normalizeQuotes(q);
  q = stripNiqqud(q);

  // Transliterate whole-word matches
  q = q.replace(/[a-z']+/g, (w) => TRANSLIT[w] ?? w);

  const parts = q.split(/[\s,.;:!?()[\]{}<>"'`/\\|+=*&^%$#@~]+/u).filter(Boolean);
  const terms: string[] = [];
  for (const p of parts) {
    if (p.length < 2) continue;
    if (STOP_HE.has(p) || STOP_EN.has(p)) continue;
    terms.push(p);
    if (terms.length >= 8) break;
  }

  return { terms, normalized: terms.join(" ") };
}
