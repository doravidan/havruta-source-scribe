import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";
import { BookOpen, Database, Search, ShieldCheck } from "lucide-react";

export function Hero() {
  const { t, lang } = useLang();
  const metrics =
    lang === "he"
      ? [
          { label: "מקורות מלאים", value: "35k+" },
          { label: "חיפוש במאגר", value: "FTS" },
          { label: "קריאה מקומית", value: "DB" },
        ]
      : [
          { label: "full sources", value: "35k+" },
          { label: "corpus search", value: "FTS" },
          { label: "database reader", value: "DB" },
        ];

  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(720px 380px at 18% 8%, rgba(215,189,120,0.16), transparent 66%), radial-gradient(620px 360px at 82% 12%, rgba(131,183,162,0.08), transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-18 pb-9 sm:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.72fr)] items-center gap-8 lg:gap-14">
          <div className="text-center lg:text-start">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/50 px-3.5 py-2"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sage)]" />
              {lang === "he" ? "מאגר חסידות · תשובות עם מקורות" : "Chassidus corpus · sourced answers"}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.04 }}
              className="max-w-[19rem] sm:max-w-4xl mx-auto lg:mx-0 text-[2rem] sm:text-6xl lg:text-7xl leading-[1.12] sm:leading-[0.98] gradient-text break-words"
              style={{ fontWeight: 500 }}
            >
              <span className="block sm:hidden">
                {lang === "he" ? (
                  <>
                    חסידות עם מקורות
                    <br />
                    לימוד בלי רעש.
                  </>
                ) : (
                  <>
                    Chassidus with sources
                    <br />
                    Study without noise.
                  </>
                )}
              </span>
              <span className="hidden sm:inline">{t.tagline}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12 }}
              className="mt-6 max-w-2xl text-base sm:text-lg leading-8 text-muted-foreground mx-auto lg:mx-0"
            >
              {t.heroSubtext}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.18 }}
              className="mt-7 flex flex-wrap justify-center lg:justify-start gap-2.5"
            >
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-full border border-border/80 bg-card/45 px-4 py-2 text-sm text-muted-foreground"
                >
                  <span className="text-foreground font-medium tabular-nums">{m.value}</span>
                  <span className="mx-2 text-border">/</span>
                  {m.label}
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="scholar-card p-4 sm:p-5 min-w-0 max-w-full"
          >
            <div className="rounded-2xl border border-border/80 bg-[rgba(5,7,13,0.38)] p-4">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div>
                  <div className="eyebrow">{lang === "he" ? "תצוגת מקור" : "source preview"}</div>
                  <div className="mt-1 text-lg font-medium text-foreground">
                    {lang === "he" ? "תניא · ליקוטי אמרים" : "Tanya · Likkutei Amarim"}
                  </div>
                </div>
                <BookOpen className="h-5 w-5 text-primary" />
              </div>

              <div className="space-y-3 py-5 text-sm leading-7 text-muted-foreground">
                <p className="text-foreground/90">
                  {lang === "he"
                    ? "כל תשובה מתחילה במקור שנשמר במאגר, לא בזיכרון כללי של מודל."
                    : "Every answer starts from a saved source, not generic model memory."}
                </p>
                <div className="h-px bg-border/70" />
                <p>
                  {lang === "he"
                    ? "פתח פרק מלא, חפש בתוכו, שנה גודל אות, והמשך ללמוד בלי לצאת לאתר חיצוני."
                    : "Open the full chapter, search inside it, tune the text size, and keep learning without leaving the app."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Mini label={lang === "he" ? "חיפוש" : "Search"} icon={<Search className="h-3.5 w-3.5" />} />
                <Mini label={lang === "he" ? "מאגר" : "Corpus"} icon={<Database className="h-3.5 w-3.5" />} />
                <Mini label={lang === "he" ? "מקור" : "Grounded"} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Mini({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}
