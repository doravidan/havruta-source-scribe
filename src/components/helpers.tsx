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

export function YiddishHelper() {
  const { t } = useLang();
  const [w, setW] = useState("");
  const hit = YIDDISH[w.trim()];
  return (
    <div className="scholar-card scholar-card-hover p-5 sm:p-6 relative overflow-hidden h-full">
      <div aria-hidden className="absolute -top-10 -right-10 h-32 w-32 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(75,122,82,0.22), transparent 70%)" }} />
      <h3 className="eyebrow mb-3 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--sage)]" />
        {t.yiddishHelper}
      </h3>
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

