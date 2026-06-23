import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";
import {
  ArrowDown,
  BookOpen,
  Library,
  MessageCircle,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

export function Hero() {
  const { lang } = useLang();
  const rtl = lang === "he";
  const proof = rtl
    ? [
        ["35k+", "מקורות מלאים"],
        ["יומי", "חת״ת ורמב״ם"],
        ["חי", "התאמת חברותא"],
      ]
    : [
        ["35k+", "full sources"],
        ["daily", "Chitas & Rambam"],
        ["live", "chavruta matching"],
      ];

  return (
    <section className="hero-stage relative isolate overflow-hidden border-b border-border/70">
      <div aria-hidden className="hero-aurora pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-8 sm:pb-18 sm:pt-16">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.8fr)] lg:gap-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-5 inline-flex items-center gap-2 border-y border-border/80 bg-transparent px-1 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--oxide)]"
            >
              <span className="h-2 w-2 rounded-full bg-[var(--moss)]" />
              {rtl ? "בית מדרש מקוון לחסידות חב״ד" : "A digital study hall for Chabad Chassidus"}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, delay: 0.04 }}
              className="max-w-5xl text-[3.15rem] leading-[0.94] tracking-[-0.055em] text-[var(--ink)] sm:text-7xl lg:text-[6.6rem]"
            >
              {rtl ? (
                <>
                  ללמוד חסידות
                  <br />
                  עם מקור, קול וחברותא.
                </>
              ) : (
                <>
                  Study Chassidus
                  <br />
                  with source, voice, and chavruta.
                </>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, delay: 0.12 }}
              className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground"
            >
              {rtl
                ? "לא עוד מסך AI נוצץ. שולחן לימוד נקי: שאלה עם מקורות, קורא מלא, שיעורים יומיים, וחיבור לחברותא אמיתית."
                : "Not another shiny AI screen. A calm study table: sourced answers, a full reader, daily study, and real chavruta connection."}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, delay: 0.18 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <a
                href="#ask"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_18px_46px_-32px_rgba(92,37,31,0.8)] transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                {rtl ? "פתח שאלה" : "Ask a question"}
              </a>
              <Link
                to="/beit-midrash"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-[rgba(255,250,239,0.72)] px-6 text-sm font-semibold text-foreground transition-colors hover:border-[var(--oxide)]/40 hover:bg-white/70"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                {rtl ? "בית המדרש שלי" : "My study room"}
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.62, delay: 0.24 }}
              className="mt-9 grid max-w-2xl grid-cols-3 divide-x divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-[rgba(255,250,239,0.56)] rtl:divide-x-reverse"
            >
              {proof.map(([value, label]) => (
                <div key={label} className="p-3 sm:p-4">
                  <div className="font-sans text-xl font-semibold tabular-nums text-[var(--oxide-deep)]">
                    {value}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="relative"
          >
            <div className="paper-card p-3 sm:p-4">
              <div className="rounded-[1.4rem] border border-border/80 bg-[rgba(255,250,239,0.88)] p-4 sm:p-5">
                <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/70 pb-4">
                  <div>
                    <div className="eyebrow">{rtl ? "שולחן לימוד" : "study table"}</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                      {rtl ? "תניא · לקוטי אמרים" : "Tanya · Likkutei Amarim"}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {rtl ? "מקור, שאלה, לימוד המשך" : "source, question, continued learning"}
                    </p>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--oxide-soft)] text-primary">
                    <Library className="h-5 w-5" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Row
                    icon={<Search className="h-4 w-4" />}
                    title={rtl ? "חפש בתוך המאגר" : "Search the corpus"}
                    body={rtl ? "כותרת, נתיב וטקסט מלא." : "Title, path, and full text."}
                  />
                  <Row
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title={rtl ? "קבל תשובה עם מקורות" : "Get a sourced answer"}
                    body={rtl ? "התשובה מחזירה אותך לטקסט." : "The answer points back to the text."}
                  />
                  <Row
                    icon={<Users className="h-4 w-4" />}
                    title={rtl ? "המשך עם חברותא" : "Continue with chavruta"}
                    body={rtl ? "שלח מקור כפתיח לשיחה." : "Use a source as the chat opener."}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between rounded-2xl border border-border/70 bg-[var(--moss-soft)] px-4 py-3 text-sm">
                  <span className="font-medium text-[var(--moss)]">
                    {rtl ? "קריאה שקטה. בלי רעש." : "Quiet reading. No noise."}
                  </span>
                  <ArrowDown className="h-4 w-4 text-[var(--moss)]" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Row({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/30 p-3.5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--saffron-soft)] text-[var(--oxide)]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
