import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";
import {
  ArrowDown,
  Flame,
  Library,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

const AVATARS = ["🦁", "🕊️", "🌿", "🔥", "📖", "✨"];

export function Hero() {
  const { lang } = useLang();
  const rtl = lang === "he";
  const proof = rtl
    ? [
        ["35k+", "מקורות מלאים"],
        ["יומי", "חת״ת ורמב״ם"],
        ["מיידי", "חברותא בלחיצה"],
      ]
    : [
        ["35k+", "full sources"],
        ["daily", "Chitas & Rambam"],
        ["instant", "one-click chavruta"],
      ];

  const tickerLines = rtl
    ? [
        "מ׳ סיימה עכשיו תניא פרק כ״ה 🎉",
        "י׳ ול׳ לומדים המשך תרס״ו ביחד",
        "ד׳ פתח חדר לימוד — מצפה לחברותא",
        "ש׳ ברצף של 6 ימי לימוד 🔥",
      ]
    : [
        "M. just finished Tanya ch. 25 🎉",
        "Y. & L. are learning Hemshech 5666 together",
        "D. opened a study room — waiting for a chavruta",
        "S. is on a 6-day learning streak 🔥",
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
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--oxide)] backdrop-blur"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--moss)] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--moss)]" />
              </span>
              {rtl
                ? "בית מדרש חי — לומדים מחוברים עכשיו"
                : "A living study hall — learners online now"}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, delay: 0.04 }}
              className="max-w-5xl text-[2.55rem] leading-[1.02] tracking-[-0.045em] text-[var(--ink)] min-[380px]:text-[3rem] sm:text-7xl sm:leading-[0.98] sm:tracking-[-0.055em] lg:text-[6.2rem]"
            >
              {rtl ? (
                <>
                  לומדים <span className="flow-text">ביחד</span>.
                  <br />
                  מקור פתוח. חברותא חיה.
                </>
              ) : (
                <>
                  Learn <span className="flow-text">together</span>.
                  <br />
                  Open source. Living chavruta.
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
                ? "שאלה קטנה מחזירה אל הלשון בפנים — ומשם ממשיכים ביחד: קריאה מלאה, קול נקי, סדר יומי, וחברותא חיה בלחיצה אחת."
                : "A small question brings you back to the words inside — and from there you keep going together: full reading, clean voice, daily seder, and a live chavruta in one click."}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, delay: 0.18 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                to="/learn-now"
                className="flow-button group inline-flex h-13 items-center justify-center gap-2 rounded-full px-7 text-sm font-bold shadow-[0_22px_54px_-28px_rgba(136,57,47,0.9)] transition-transform hover:-translate-y-0.5"
              >
                <Zap className="h-4 w-4 transition-transform group-hover:rotate-12" />
                {rtl ? "חברותא עכשיו" : "Chavruta now"}
                <span className="ms-1 inline-flex h-2 w-2 animate-glow-pulse rounded-full bg-white/90" />
              </Link>
              <a
                href="#ask"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_18px_46px_-32px_rgba(92,37,31,0.8)] transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                {rtl ? "פתח שאלה" : "Ask a question"}
              </a>
              <Link
                to="/library"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-border bg-[rgba(255,250,239,0.72)] px-6 text-sm font-semibold text-foreground transition-colors hover:border-[var(--oxide)]/40 hover:bg-white/70"
              >
                <Library className="h-4 w-4 text-primary" />
                {rtl ? "לספרייה" : "Library"}
              </Link>
            </motion.div>

            {/* Live community pulse strip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, delay: 0.26 }}
              className="glass-panel mt-9 flex max-w-2xl items-center gap-3 rounded-2xl px-4 py-3"
            >
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {AVATARS.slice(0, 4).map((emoji, i) => (
                  <motion.span
                    key={emoji}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.3 + i * 0.08,
                      type: "spring",
                      stiffness: 300,
                      damping: 18,
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-white/90 to-[var(--paper-1)] text-base shadow-sm"
                  >
                    {emoji}
                  </motion.span>
                ))}
              </div>
              <HeroTicker lines={tickerLines} />
              <Link
                to="/community"
                className="ms-auto hidden shrink-0 items-center gap-1 rounded-full border border-[var(--moss)]/40 bg-[var(--moss)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--moss)] transition-colors hover:bg-[var(--moss)]/20 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {rtl ? "לפיד" : "Feed"}
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.62, delay: 0.32 }}
              className="mt-6 grid max-w-2xl grid-cols-3 divide-x divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-[rgba(255,250,239,0.56)] rtl:divide-x-reverse"
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
            {/* Floating companion chips */}
            <motion.div
              aria-hidden
              className="animate-float-y absolute -top-5 -start-3 z-10 hidden sm:block"
            >
              <div className="flow-ring rounded-full p-0.5 shadow-lg">
                <div className="flex items-center gap-2 rounded-full bg-[var(--panel-strong)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)]">
                  <Users className="h-3.5 w-3.5 text-[var(--teal)]" />
                  {rtl ? "חברותא חיה" : "Live chavruta"}
                </div>
              </div>
            </motion.div>
            <motion.div
              aria-hidden
              className="animate-float-y absolute -bottom-4 -end-2 z-10 hidden sm:block [animation-delay:1.6s]"
            >
              <div className="flow-ring rounded-full p-0.5 shadow-lg">
                <div className="flex items-center gap-2 rounded-full bg-[var(--panel-strong)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)]">
                  <Flame className="h-3.5 w-3.5 text-[var(--amber)]" />
                  {rtl ? "רצף 6 ימים" : "6-day streak"}
                </div>
              </div>
            </motion.div>

            <div className="paper-card glow-card p-3 sm:p-4">
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
                    title={rtl ? "חברותא חיה בלחיצה" : "Live chavruta in one click"}
                    body={
                      rtl
                        ? "התאמה מיידית, קול ומקור משותף."
                        : "Instant pairing, voice, shared source."
                    }
                  />
                </div>

                <div className="flow-wash mt-5 flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3 text-sm">
                  <span className="font-medium text-[var(--ink)]">
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

function HeroTicker({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), 3600);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  return (
    <div className="relative h-5 min-w-0 flex-1 overflow-hidden text-sm text-muted-foreground">
      <span key={index} className="ticker-line absolute inset-0 truncate">
        {lines[index]}
      </span>
    </div>
  );
}

function Row({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/30 p-3.5 transition-colors hover:border-[var(--oxide)]/30 hover:bg-white/50">
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
