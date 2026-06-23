import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, CalendarClock, Flame, MessageCircle, Search, Users } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { DailyStudyPanel } from "@/components/daily-study";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { getStudySummary } from "@/lib/study-progress.functions";
import { supabase } from "@/integrations/supabase/client";

type AskSession = {
  id: string;
  question: string;
  mode: string | null;
  created_at: string;
};

type MatchRow = {
  id: string;
  requester_id: string;
  suggested_user_id: string;
  status: string;
  overlap_day: number | null;
  overlap_start: string | null;
  overlap_end: string | null;
  created_at: string;
};

export const Route = createFileRoute("/beit-midrash")({
  head: () => ({
    meta: [
      { title: "בית המדרש שלי — חסידותא" },
      {
        name: "description",
        content: "לוח לימוד אישי: לימוד יומי, התקדמות, שאלות אחרונות וחברותות פעילות.",
      },
    ],
  }),
  component: BeitMidrashPage,
});

const daysHe = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbat"];

function BeitMidrashPage() {
  const { session, loading } = useAuth();
  const { lang, dir } = useLang();
  const summaryFn = useServerFn(getStudySummary);
  const days = lang === "he" ? daysHe : daysEn;

  const summaryQ = useQuery({
    queryKey: ["study-summary", session?.user?.id],
    enabled: !!session,
    queryFn: () => summaryFn(),
  });

  const recentQ = useQuery({
    queryKey: ["beit-recent", session?.user?.id],
    enabled: !!session,
    queryFn: async () => {
      const [{ data: asks }, { data: matches }] = await Promise.all([
        supabase
          .from("ask_sessions")
          .select("id, question, mode, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("chavruta_matches")
          .select(
            "id, requester_id, suggested_user_id, status, overlap_day, overlap_start, overlap_end, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        asks: (asks ?? []) as AskSession[],
        matches: (matches ?? []) as MatchRow[],
      };
    },
  });

  if (loading) return <div className="min-h-screen" />;

  if (!session) {
    return (
      <div className="min-h-screen" dir={dir}>
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="scholar-card p-8">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h1 className="gold-text text-3xl">
              {lang === "he" ? "בית המדרש שלי" : "My Beit Midrash"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "he"
                ? "צריך להתחבר כדי לראות התקדמות, שאלות וחברותות."
                : "Sign in to see progress, questions, and chavruta activity."}
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-primary-foreground"
            >
              {lang === "he" ? "התחברות" : "Sign in"}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const summary = summaryQ.data;
  const progress = summary
    ? Math.round((summary.totals.done / Math.max(1, summary.totals.total)) * 100)
    : 0;

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <header className="mb-8">
          <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-3 py-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            {lang === "he" ? "לוח לימוד אישי" : "personal study room"}
          </div>
          <h1 className="gradient-text max-w-3xl text-4xl leading-tight sm:text-6xl">
            {lang === "he" ? "בית המדרש שלי" : "My Beit Midrash"}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
            {lang === "he"
              ? "כל מה שצריך כדי לחזור ללמוד: שיעור יומי, התקדמות, שאלות אחרונות וחברותות פעילות."
              : "A return loop for learning: daily study, progress, recent questions, and active chavrutot."}
          </p>
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          <Metric
            icon={<Flame className="h-4 w-4" />}
            label={lang === "he" ? "רצף נוכחי" : "Current streak"}
            value={summary ? String(summary.streak.current) : "—"}
          />
          <Metric
            icon={<BookOpen className="h-4 w-4" />}
            label={lang === "he" ? "מקורות שנלמדו" : "Sources studied"}
            value={summary ? String(summary.totals.done) : "—"}
          />
          <Metric
            icon={<Search className="h-4 w-4" />}
            label={lang === "he" ? "התקדמות מאגר" : "Corpus progress"}
            value={`${progress}%`}
          />
          <Metric
            icon={<Users className="h-4 w-4" />}
            label={lang === "he" ? "חברותות פעילות" : "Active chavrutot"}
            value={String(
              recentQ.data?.matches.filter(
                (m) => m.status !== "declined" && m.status !== "cancelled",
              ).length ?? "—",
            )}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6 min-w-0">
            <DailyStudyPanel />
            <section className="scholar-card p-5 sm:p-6">
              <h2 className="eyebrow mb-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                {lang === "he" ? "שאלות אחרונות" : "Recent questions"}
              </h2>
              {recentQ.data?.asks.length ? (
                <div className="space-y-2">
                  {recentQ.data.asks.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-border/70 bg-background/30 p-3"
                    >
                      <div className="line-clamp-2 text-sm text-foreground">{q.question}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{q.mode ?? "ok"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lang === "he" ? "עוד אין שאלות שמורות." : "No saved questions yet."}
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-6 min-w-0">
            <section className="scholar-card p-5 sm:p-6">
              <h2 className="eyebrow mb-4 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                {lang === "he" ? "חברותות קרובות" : "Upcoming chavrutot"}
              </h2>
              {recentQ.data?.matches.length ? (
                <div className="space-y-2">
                  {recentQ.data.matches.map((m) => (
                    <Link
                      key={m.id}
                      to="/chavruta"
                      className="block rounded-xl border border-border/70 bg-background/30 p-3 hover:border-primary/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{m.status}</span>
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {m.overlap_day != null
                          ? `${days[m.overlap_day]} · ${m.overlap_start?.slice(0, 5)}–${m.overlap_end?.slice(0, 5)}`
                          : lang === "he"
                            ? "שיחה פתוחה"
                            : "Open chat"}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    {lang === "he"
                      ? "עדיין אין חברותות. עבור לעמוד החברותות כדי למצוא התאמה."
                      : "No chavrutot yet. Go to the chavruta page to find a match."}
                  </p>
                  <Link
                    to="/chavruta"
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    {lang === "he" ? "מצא חברותא" : "Find chavruta"}
                  </Link>
                </div>
              )}
            </section>

            <section className="scholar-card p-5 sm:p-6">
              <h2 className="eyebrow mb-4">
                {lang === "he" ? "התקדמות לפי חלק" : "Progress by section"}
              </h2>
              <div className="space-y-3">
                {(summary?.sections ?? []).slice(0, 5).map((s) => {
                  const pct = Math.round((s.done / Math.max(1, s.total)) * 100);
                  return (
                    <div key={s.section}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{s.section}</span>
                        <span className="tabular-nums text-primary">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background/60">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="scholar-card p-4">
      <div className="mb-3 inline-grid h-9 w-9 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
