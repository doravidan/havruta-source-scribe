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

const EXAMPLES = ["וואס", "איז", "ענין", "טאקע"];

export function YiddishHelper() {
  const { t, lang } = useLang();
  const [w, setW] = useState("");
  const hit = YIDDISH[w.trim()];

  return (
    <div className="scholar-card scholar-card-hover p-5 sm:p-6 h-full flex flex-col">
      <h3 className="eyebrow mb-3 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sage)]" />
        {t.yiddishHelper}
      </h3>

      <p className="text-sm leading-6 text-muted-foreground mb-4">
        {lang === "he"
          ? "עזר קטן לפענוח מילים שחוזרות במקורות ובשיחות."
          : "A small aid for recurring words in sources and sichos."}
      </p>

      <input
        value={w}
        onChange={(e) => setW(e.target.value)}
        placeholder={t.yiddishPlaceholder}
        className="w-full px-3 h-11 rounded-xl border border-border bg-background/45 outline-none text-base"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setW(ex)}
            className="rounded-full border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-auto pt-5 min-h-[76px] text-sm">
        {w.trim() === "" ? (
          <p className="text-muted-foreground/80">
            {lang === "he" ? "בחר דוגמה או הקלד מילה." : "Choose an example or type a word."}
          </p>
        ) : hit ? (
          <div className="rounded-xl border border-border/70 bg-background/35 p-3 space-y-1">
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
