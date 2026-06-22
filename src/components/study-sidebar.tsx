import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Flame, BookCheck, BookOpen, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { getStudySummary } from "@/lib/study-progress.functions";

export function StudySidebar() {
  const { session } = useAuth();
  const { t, lang } = useLang();
  const fn = useServerFn(getStudySummary);

  const { data, isLoading } = useQuery({
    queryKey: ["study-summary", session?.user?.id ?? "anon"],
    queryFn: () => fn(),
    enabled: !!session,
    staleTime: 30_000,
  });

  if (!session) {
    return (
      <aside className="scholar-card p-5 sm:p-6">
        <h3 className="eyebrow mb-2 flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[var(--saffron)]" />
          {lang === "he" ? "התקדמות לימוד" : "Study Progress"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {lang === "he"
            ? "התחבר כדי לעקוב אחרי רצף ימי לימוד ולסמן מקורות שלמדת."
            : "Sign in to track your study streak and mark sources you\u2019ve learned."}
        </p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-95"
        >
          {t.signIn}
        </Link>
      </aside>
    );
  }

  return (
    <aside className="scholar-card p-5 sm:p-6">
      <h3 className="eyebrow mb-4 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--saffron)] animate-glow-pulse" />
        {lang === "he" ? "התקדמות לימוד" : "Study Progress"}
      </h3>

      {/* Streak + totals */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatTile
          icon={<Flame className="h-4 w-4" />}
          label={lang === "he" ? "רצף נוכחי" : "Current streak"}
          value={data ? `${data.streak.current}` : "—"}
          suffix={lang === "he" ? "ימים" : data?.streak.current === 1 ? "day" : "days"}
          accent="saffron"
          loading={isLoading}
        />
        <StatTile
          icon={<Trophy className="h-4 w-4" />}
          label={lang === "he" ? "שיא" : "Longest"}
          value={data ? `${data.streak.longest}` : "—"}
          suffix={lang === "he" ? "ימים" : data?.streak.longest === 1 ? "day" : "days"}
          accent="ruby"
          loading={isLoading}
        />
      </div>

      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
            <BookCheck className="h-3.5 w-3.5" />
            {lang === "he" ? "סה״כ נלמדו" : "Total studied"}
          </span>
          <span className="text-sm font-semibold text-[var(--indigo-deep)]">
            {data ? `${data.totals.done} / ${data.totals.total}` : "—"}
          </span>
        </div>
        <ProgressBar value={data ? data.totals.done : 0} max={data?.totals.total ?? 1} accent="indigo" />
      </div>

      <div>
        <div className="eyebrow mb-3">{lang === "he" ? "לפי סקציה" : "By section"}</div>
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-md bg-[color:var(--parchment-warm)] animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && data && (
          <ul className="space-y-3 max-h-[420px] overflow-y-auto pe-1">
            {data.sections.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {lang === "he" ? "אין מקורות במאגר." : "No sources in the library yet."}
              </li>
            )}
            {data.sections.map((s, idx) => (
              <motion.li
                key={s.section}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * idx, duration: 0.3 }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--ink)] truncate" title={s.section}>
                    {s.section}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                    {s.done}/{s.total}
                  </span>
                </div>
                <ProgressBar value={s.done} max={s.total} accent={accentForIndex(idx)} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 text-[11px] text-muted-foreground/80">
        {lang === "he"
          ? "פתח מקור וסמן \u201Cלמדתי\u201D כדי לעדכן התקדמות."
          : "Open a source and tap \u201CMark studied\u201D to update progress."}
      </p>
    </aside>
  );
}

type Accent = "saffron" | "ruby" | "indigo" | "sage";
const ACCENT: Record<Accent, { bar: string; bg: string; chip: string }> = {
  saffron: { bar: "var(--saffron)", bg: "rgba(232,169,58,0.18)", chip: "rgba(232,169,58,0.30)" },
  ruby:    { bar: "var(--ruby)",    bg: "rgba(192,57,43,0.14)",  chip: "rgba(192,57,43,0.22)" },
  indigo:  { bar: "var(--indigo-deep)", bg: "rgba(30,42,120,0.12)", chip: "rgba(30,42,120,0.20)" },
  sage:    { bar: "var(--sage)",    bg: "rgba(75,122,82,0.16)",  chip: "rgba(75,122,82,0.26)" },
};

function accentForIndex(i: number): Accent {
  return (["saffron", "indigo", "ruby", "sage"] as Accent[])[i % 4];
}

function ProgressBar({ value, max, accent }: { value: number; max: number; accent: Accent }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const a = ACCENT[accent];
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: a.bg }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: a.bar }}
      />
    </div>
  );
}

function StatTile({
  icon, label, value, suffix, accent, loading,
}: {
  icon: React.ReactNode; label: string; value: string; suffix?: string; accent: Accent; loading?: boolean;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className="rounded-xl p-3 border"
      style={{ background: a.bg, borderColor: a.chip }}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span style={{ color: a.bar }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="serif text-2xl font-semibold" style={{ color: a.bar }}>
          {loading ? "…" : value}
        </span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
