import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";
import { BookOpen, Database, MessageCircle, Search, ShieldCheck, Users } from "lucide-react";

export function Hero() {
  const { t, lang } = useLang();
  const rtl = lang === "he";
  const metrics =
    lang === "he"
      ? [
          { label: "מקורות מלאים", value: "35k+" },
          { label: "חברותות", value: "חי" },
          { label: "תשובות עם מקור", value: "AI" },
        ]
      : [
          { label: "full sources", value: "35k+" },
          { label: "chavruta network", value: "live" },
          { label: "sourced answers", value: "AI" },
        ];

  return (
    <section className="relative overflow-hidden border-b border-border/40 hero-stage">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hero-aurora" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-20 pb-10 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.82fr)] items-center gap-8 lg:gap-14">
          <div className="text-center lg:text-start">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/50 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sage)] animate-glow-pulse" />
              {lang === "he"
                ? "בית מדרש דיגיטלי · מקורות · חברותות"
                : "digital beit midrash · sources · chavrutot"}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.04 }}
              className="max-w-[21rem] sm:max-w-5xl mx-auto lg:mx-0 text-[2.4rem] sm:text-6xl lg:text-[5.35rem] leading-[1.05] sm:leading-[0.95] gradient-text break-words"
              style={{ fontWeight: 500 }}
            >
              {rtl ? (
                <>
                  חסידות שנפתחת
                  <br />
                  כמו בית מדרש חי.
                </>
              ) : (
                <>
                  Chassidus that feels
                  <br />
                  like a living beit midrash.
                </>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12 }}
              className="mt-6 max-w-2xl text-base sm:text-lg leading-8 text-muted-foreground mx-auto lg:mx-0"
            >
              {rtl
                ? "שאל מקור, פתח טקסט מלא, מצא חברותא בזמן שמתאים לך, והמשך לימוד בלי תחושת כלי AI גנרי."
                : "Ask from sources, open the full text, find a chavruta that matches your time, and keep learning without generic AI-app noise."}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.18 }}
              className="mt-7 flex flex-col sm:flex-row flex-wrap justify-center lg:justify-start gap-3"
            >
              <a
                href="#ask"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_54px_-28px_rgba(215,189,120,0.9)] transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                {rtl ? "שאל על מקור" : "Ask from sources"}
              </a>
              <Link
                to="/chavruta"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border/90 bg-card/55 px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/60"
              >
                <Users className="h-4 w-4 text-primary" />
                {rtl ? "מצא חברותא" : "Find a chavruta"}
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.24 }}
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
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative min-w-0 max-w-full"
          >
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_50%_15%,rgba(215,189,120,0.18),transparent_58%)] blur-xl"
            />
            <div className="scholar-card p-3 sm:p-4 min-w-0 max-w-full hero-orbit-card">
              <div className="rounded-[1.35rem] border border-border/80 bg-[rgba(5,7,13,0.52)] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <div>
                    <div className="eyebrow">{rtl ? "לוח לימוד חי" : "living study board"}</div>
                    <div className="mt-1 text-xl font-medium text-foreground">
                      {rtl ? "תניא · מאמרים · חברותא" : "Tanya · Maamarim · chavruta"}
                    </div>
                  </div>
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>

                <div className="grid gap-3 py-5">
                  <StudySignal
                    icon={<Search className="h-4 w-4" />}
                    title={rtl ? "שאל" : "Ask"}
                    body={
                      rtl
                        ? "שאלה בעברית, תשובה עם מקורות בלבד."
                        : "A question in plain language, answered only from sources."
                    }
                  />
                  <StudySignal
                    icon={<Database className="h-4 w-4" />}
                    title={rtl ? "פתח" : "Open"}
                    body={
                      rtl
                        ? "המקור המלא נפתח בתוך הקורא, עם חיפוש וסיכום."
                        : "The full source opens in the reader with search and summary."
                    }
                  />
                  <StudySignal
                    icon={<Users className="h-4 w-4" />}
                    title={rtl ? "המשך ביחד" : "Continue together"}
                    body={
                      rtl
                        ? "מצא חברותא לפי זמן, שפה ונושא לימוד."
                        : "Match with a chavruta by time, language, and topic."
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Mini
                    label={rtl ? "מקור" : "Source"}
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  />
                  <Mini
                    label={rtl ? "מאגר" : "Corpus"}
                    icon={<Database className="h-3.5 w-3.5" />}
                  />
                  <Mini
                    label={rtl ? "חברותא" : "Chavruta"}
                    icon={<Users className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StudySignal({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-border/70 bg-background/35 p-3.5 transition-colors hover:border-primary/35 hover:bg-secondary/35">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
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
