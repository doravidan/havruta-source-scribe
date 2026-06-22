import { ExternalLink, BookOpen, ScrollText, Sparkles, Crown, Scale } from "lucide-react";
import { motion } from "framer-motion";
import { useLang } from "@/lib/lang-context";

type Item = {
  key: string;
  he: string;
  en: string;
  subHe: string;
  subEn: string;
  url: string;
  icon: React.ReactNode;
  accent: "saffron" | "ruby" | "indigo" | "sage";
};

const CHITAS: Item[] = [
  {
    key: "chumash",
    he: 'חומש — שיעור יומי',
    en: "Chumash — daily Aliyah",
    subHe: "פרשת השבוע לפי יום",
    subEn: "Today's aliyah of the weekly parsha",
    url: "https://www.chabad.org/dailystudy/torahreading.asp",
    icon: <ScrollText className="h-4 w-4" />,
    accent: "saffron",
  },
  {
    key: "tehillim",
    he: 'תהלים — לפי ימי החודש',
    en: "Tehillim — monthly cycle",
    subHe: "חלוקת המזמורים היומית",
    subEn: "Daily psalms portion",
    url: "https://www.chabad.org/dailystudy/tehillim.asp",
    icon: <Sparkles className="h-4 w-4" />,
    accent: "indigo",
  },
  {
    key: "tanya",
    he: 'תניא — שיעור יומי',
    en: "Tanya — daily lesson",
    subHe: "לפי לוח השיעורים",
    subEn: "Per the daily study calendar",
    url: "https://www.chabad.org/dailystudy/tanya.asp",
    icon: <BookOpen className="h-4 w-4" />,
    accent: "ruby",
  },
];

const RAMBAM: Item[] = [
  {
    key: "rambam3",
    he: 'רמב"ם — ג׳ פרקים ליום',
    en: "Rambam — 3 chapters/day",
    subHe: "המחזור הראשי של הרבי",
    subEn: "The Rebbe's primary cycle",
    url: "https://www.chabad.org/dailystudy/rambam.asp",
    icon: <Crown className="h-4 w-4" />,
    accent: "saffron",
  },
  {
    key: "rambam1",
    he: 'רמב"ם — פרק אחד ליום',
    en: "Rambam — 1 chapter/day",
    subHe: "לקצב לימוד מתון יותר",
    subEn: "A gentler pace",
    url: "https://www.chabad.org/dailystudy/rambam.asp?rambamChapters=1",
    icon: <Crown className="h-4 w-4" />,
    accent: "indigo",
  },
  {
    key: "sm",
    he: "ספר המצוות — שיעור יומי",
    en: "Sefer Hamitzvos — daily",
    subHe: "למסיימים פרק אחד ליום",
    subEn: "Companion to the 1-chapter cycle",
    url: "https://www.chabad.org/dailystudy/seferHamitzvos.asp",
    icon: <ScrollText className="h-4 w-4" />,
    accent: "sage",
  },
];

const SHULCHAN_ARUCH_HARAV: Item[] = [
  {
    key: "sh1",
    he: 'שו"ע הרב — סימן אחד ליום',
    en: "Shulchan Aruch HaRav — 1 siman/day",
    subHe: "מחזור בן שנה",
    subEn: "One-year cycle",
    url: "https://www.chabad.org/dailystudy/shulchanAruchHarav.asp",
    icon: <Scale className="h-4 w-4" />,
    accent: "saffron",
  },
  {
    key: "sh2",
    he: 'שו"ע הרב — שני סימנים ליום',
    en: "Shulchan Aruch HaRav — 2 simanim/day",
    subHe: "מחזור בן שנתיים",
    subEn: "Two-year cycle",
    url: "https://www.chabad.org/dailystudy/shulchanAruchHarav.asp?shulchanAruchHarav=2",
    icon: <Scale className="h-4 w-4" />,
    accent: "indigo",
  },
];

const ACCENT: Record<Item["accent"], { bar: string; bg: string; border: string }> = {
  saffron: { bar: "var(--saffron)", bg: "rgba(232,169,58,0.10)", border: "rgba(232,169,58,0.45)" },
  ruby:    { bar: "var(--ruby)", bg: "rgba(192,57,43,0.08)", border: "rgba(192,57,43,0.40)" },
  indigo:  { bar: "var(--indigo-deep)", bg: "rgba(30,42,120,0.08)", border: "rgba(30,42,120,0.40)" },
  sage:    { bar: "var(--sage)", bg: "rgba(75,122,82,0.10)", border: "rgba(75,122,82,0.45)" },
};

function hebrewToday(lang: "he" | "en") {
  try {
    const fmt = new Intl.DateTimeFormat(
      lang === "he" ? "he-u-ca-hebrew" : "en-u-ca-hebrew",
      { day: "numeric", month: "long", year: "numeric" },
    );
    return fmt.format(new Date());
  } catch {
    return "";
  }
}

export function DailyStudyPanel() {
  const { lang } = useLang();
  const hebDate = hebrewToday(lang);

  return (
    <section className="scholar-card p-5 sm:p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 h-44 w-44 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(232,169,58,0.30), transparent 70%)" }}
      />
      <div className="flex items-start justify-between gap-3 mb-4 relative">
        <div>
          <h3 className="eyebrow mb-1 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--saffron)] animate-glow-pulse" />
            {lang === "he" ? "לימוד יומי" : "Daily Study"}
          </h3>
          <p className="serif text-xl sm:text-2xl text-[var(--indigo-deep)]">
            {lang === "he" ? 'חת"ת ורמב"ם' : "Chitas & Rambam"}
          </p>
        </div>
        {hebDate && (
          <span
            className="shrink-0 text-[11px] sm:text-xs px-2.5 py-1 rounded-full border tabular-nums"
            style={{
              background: "rgba(232,169,58,0.12)",
              borderColor: "rgba(232,169,58,0.45)",
              color: "var(--ink)",
            }}
            title={lang === "he" ? "התאריך העברי" : "Hebrew date"}
          >
            {hebDate}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative">
        <Group
          title={lang === "he" ? 'חת"ת — חומש · תהלים · תניא' : "Chitas — Chumash · Tehillim · Tanya"}
          items={CHITAS}
          lang={lang}
        />
        <Group
          title={lang === "he" ? 'רמב"ם יומי' : "Daily Rambam"}
          items={RAMBAM}
          lang={lang}
        />
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground relative">
        {lang === "he"
          ? "הקישורים נפתחים בלוח השיעורים הרשמי של chabad.org, ומחושבים לפי היום הנוכחי."
          : "Links open the official chabad.org daily-study calendar, computed for today."}
      </p>
    </section>
  );
}

function Group({
  title, items, lang,
}: { title: string; items: Item[]; lang: "he" | "en" }) {
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <ul className="space-y-2">
        {items.map((it, i) => {
          const a = ACCENT[it.accent];
          return (
            <motion.li
              key={it.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04 * i }}
            >
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: a.bg, borderColor: a.border }}
              >
                <span
                  className="grid place-items-center h-9 w-9 rounded-lg shrink-0"
                  style={{ background: "rgba(255,255,255,0.7)", color: a.bar }}
                >
                  {it.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--ink)] truncate">
                    {lang === "he" ? it.he : it.en}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {lang === "he" ? it.subHe : it.subEn}
                  </span>
                </span>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[var(--saffron)]"
                />
              </a>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
