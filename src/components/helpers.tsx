import { useState } from "react";
import { useLang } from "@/lib/lang-context";

const YIDDISH: Record<string, { he: string; en: string }> = {
  "וואס": { he: "מה", en: "what" },
  "וואָס": { he: "מה", en: "what" },
  "איז": { he: "הוא/היא", en: "is" },
  "דער": { he: "ה- (זכר)", en: "the (masc.)" },
  "די": { he: "ה- (נקבה/רבים)", en: "the (fem./pl.)" },
  "דאס": { he: "זה / ה- (נייטרלי)", en: "this / the (neuter)" },
  "דאָס": { he: "זה / ה- (נייטרלי)", en: "this / the (neuter)" },
  "ענין": { he: "עניין", en: "matter, topic" },
  "ניט": { he: "לא", en: "not" },
  "ניין": { he: "לא", en: "no" },
  "יא": { he: "כן", en: "yes" },
  "א": { he: "אחד / -", en: "a, an" },
  "אַ": { he: "אחד / -", en: "a, an" },
  "און": { he: "ו-", en: "and" },
  "מיט": { he: "עם", en: "with" },
  "אויף": { he: "על", en: "on" },
  "אין": { he: "ב-", en: "in" },
  "פאר": { he: "עבור / לפני", en: "for / before" },
  "פאַר": { he: "עבור / לפני", en: "for / before" },
  "אים": { he: "אותו / לו", en: "him" },
  "זיין": { he: "להיות / שלו", en: "to be / his" },
  "טאקע": { he: "אכן / באמת", en: "indeed" },
  "טאַקע": { he: "אכן / באמת", en: "indeed" },
};

const RASHI: Array<[string, string]> = [
  ["א", "ﬡ"], ["ב", "ﬢ"], ["ג", "ﬣ"], ["ד", "ﬤ"], ["ה", "ﬥ"],
  ["ו", "ﬦ"], ["ז", "ﬧ"], ["ח", "ﬨ"], ["ט", "ם"], ["י", "מ"],
  ["כ", "ן"], ["ל", "ל"], ["מ", "מ"], ["נ", "נ"], ["ס", "ס"],
  ["ע", "ע"], ["פ", "פ"], ["צ", "צ"], ["ק", "ק"], ["ר", "ר"],
  ["ש", "ש"], ["ת", "ת"],
];

const RASHI_NAMES: Record<string, { he: string; en: string }> = {
  "א": { he: "אלף", en: "alef" }, "ב": { he: "בית", en: "bet" }, "ג": { he: "גימל", en: "gimel" },
  "ד": { he: "דלת", en: "dalet" }, "ה": { he: "הא", en: "he" }, "ו": { he: "וו", en: "vav" },
  "ז": { he: "זין", en: "zayin" }, "ח": { he: "חית", en: "chet" }, "ט": { he: "טית", en: "tet" },
  "י": { he: "יוד", en: "yod" }, "כ": { he: "כף", en: "kaf" }, "ל": { he: "למד", en: "lamed" },
  "מ": { he: "מם", en: "mem" }, "נ": { he: "נון", en: "nun" }, "ס": { he: "סמך", en: "samech" },
  "ע": { he: "עין", en: "ayin" }, "פ": { he: "פא", en: "pe" }, "צ": { he: "צדי", en: "tsadi" },
  "ק": { he: "קוף", en: "qof" }, "ר": { he: "ריש", en: "resh" }, "ש": { he: "שין", en: "shin" },
  "ת": { he: "תו", en: "tav" },
};

export function YiddishHelper() {
  const { t, lang } = useLang();
  const [w, setW] = useState("");
  const hit = YIDDISH[w.trim()];
  return (
    <div className="scholar-card p-5">
      <h3 className="text-sm uppercase tracking-widest text-primary/80 mb-3">{t.yiddishHelper}</h3>
      <input
        value={w}
        onChange={(e) => setW(e.target.value)}
        placeholder={t.yiddishPlaceholder}
        className="w-full px-3 h-11 rounded-md border border-border bg-background/50 outline-none text-base"
      />
      <div className="mt-3 min-h-[44px] text-sm">
        {w.trim() === "" ? null : hit ? (
          <div className="space-y-1">
            <div><span className="text-muted-foreground">עברית:</span> {hit.he}</div>
            <div><span className="text-muted-foreground">English:</span> {hit.en}</div>
          </div>
        ) : (
          <p className="text-muted-foreground">{t.yiddishNotFound}</p>
        )}
      </div>
    </div>
  );
}

export function RashiHelper() {
  const { t, lang } = useLang();
  return (
    <div className="scholar-card p-5">
      <h3 className="text-sm uppercase tracking-widest text-primary/80 mb-1">{t.rashiHelper}</h3>
      <p className="text-xs text-muted-foreground mb-4">{t.rashiSubtitle}</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {RASHI.map(([std, rashi]) => (
          <div key={std} className="flex flex-col items-center gap-1 p-2 rounded-md border border-border/60">
            <div className="text-2xl" style={{ fontFamily: "var(--font-serif-he)" }}>{std}</div>
            <div className="text-xl text-primary/90" style={{ fontFamily: "serif" }}>{rashi}</div>
            <div className="text-[10px] text-muted-foreground">
              {RASHI_NAMES[std]?.[lang]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
