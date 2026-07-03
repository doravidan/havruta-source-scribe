import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Flame,
  GraduationCap,
  Loader2,
  PartyPopper,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { AppFooter, EmptyState, PageLoader } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import { getCommunityFeed, toggleCheer, type FeedItem } from "@/lib/social.functions";
import { createAiStudySession } from "@/lib/chavruta-study.functions";
import { useAuthRedirectSearch } from "@/lib/auth-redirect";
import { toast } from "sonner";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "קהילה — חסידותא · Chassiduta" },
      {
        name: "description",
        content: "פיד הלימוד של הקהילה: מי לומד מה עכשיו, חגיגות סיום, ועידוד הדדי.",
      },
    ],
  }),
  component: CommunityPage,
});

function timeAgo(iso: string, lang: "he" | "en"): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return lang === "he" ? "ממש עכשיו" : "just now";
  if (minutes < 60) return lang === "he" ? `לפני ${minutes} דק׳` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "he" ? `לפני ${hours} שע׳` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === "he" ? `לפני ${days} ימים` : `${days}d ago`;
}

function kindLabel(item: FeedItem, lang: "he" | "en") {
  const ai = item.meta?.companion === "ai";
  switch (item.kind) {
    case "session_started":
      return lang === "he"
        ? ai
          ? "פתח לימוד עם חברותא AI"
          : "פתח חדר לימוד בחברותא"
        : ai
          ? "started learning with an AI chavruta"
          : "opened a chavruta study room";
    case "session_completed":
      return lang === "he" ? "סיים לימוד!" : "completed a study session!";
    case "source_studied":
      return lang === "he" ? "סיים ללמוד מקור" : "finished studying a source";
    case "streak_milestone":
      return lang === "he" ? "הגיע לרצף לימוד" : "reached a learning streak";
  }
}

function kindIcon(kind: FeedItem["kind"]) {
  switch (kind) {
    case "session_started":
      return <BookOpen className="h-3.5 w-3.5" />;
    case "session_completed":
      return <PartyPopper className="h-3.5 w-3.5" />;
    case "source_studied":
      return <GraduationCap className="h-3.5 w-3.5" />;
    case "streak_milestone":
      return <Flame className="h-3.5 w-3.5" />;
  }
}

/** Deterministic vivid gradient per user for identity avatars. */
function avatarGradient(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 48) % 360;
  return `linear-gradient(135deg, hsl(${hue} 52% 46%), hsl(${hue2} 58% 38%))`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (
    parts
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

function CommunityPage() {
  const { user, loading } = useAuth();
  const { lang, dir } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const authRedirect = useAuthRedirectSearch();
  const feedFn = useServerFn(getCommunityFeed);
  const cheerFn = useServerFn(toggleCheer);
  const createAiStudyFn = useServerFn(createAiStudySession);
  const [burstId, setBurstId] = useState<string | null>(null);

  const feedQ = useQuery({
    queryKey: ["community-feed"],
    enabled: !!user,
    queryFn: () => feedFn({ data: { limit: 40 } }),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("community-feed-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "learning_activity" },
        () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const cheerMutation = useMutation({
    mutationFn: (activityId: string) => cheerFn({ data: { activityId } }),
    onMutate: async (activityId) => {
      await qc.cancelQueries({ queryKey: ["community-feed"] });
      const prev = qc.getQueryData<FeedItem[]>(["community-feed"]);
      qc.setQueryData<FeedItem[]>(["community-feed"], (items) =>
        (items ?? []).map((item) =>
          item.id === activityId
            ? {
                ...item,
                cheered_by_me: !item.cheered_by_me,
                cheer_count: item.cheer_count + (item.cheered_by_me ? -1 : 1),
              }
            : item,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["community-feed"], ctx.prev);
      toast.error(lang === "he" ? "העידוד נכשל" : "Cheer failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });

  const learnToo = useMutation({
    mutationFn: (sourceId: string) => createAiStudyFn({ data: { sourceId } }),
    onSuccess: (room) => navigate({ to: "/study/$sessionId", params: { sessionId: room.id } }),
    onError: () => toast.error(lang === "he" ? "לא הצלחתי לפתוח לימוד" : "Could not open study"),
  });

  const cheer = (item: FeedItem) => {
    if (!item.cheered_by_me) setBurstId(item.id);
    cheerMutation.mutate(item.id);
  };

  const items = useMemo(() => feedQ.data ?? [], [feedQ.data]);
  const he = lang === "he";

  const { liveUsers, todayCount, completedToday } = useMemo(() => {
    const seen = new Map<string, FeedItem>();
    for (const item of items) {
      if (
        Date.now() - new Date(item.created_at).getTime() < 30 * 60_000 &&
        !seen.has(item.user_id)
      ) {
        seen.set(item.user_id, item);
      }
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = items.filter((i) => new Date(i.created_at) >= startOfDay);
    return {
      liveUsers: [...seen.values()],
      todayCount: new Set(today.map((i) => i.user_id)).size,
      completedToday: today.filter((i) => i.kind === "session_completed").length,
    };
  }, [items]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <PageLoader />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen" dir={dir}>
        <TopBar />
        <main id="main-content" className="relative mx-auto max-w-2xl px-4 py-16 text-center">
          <div
            aria-hidden
            className="hero-aurora pointer-events-none absolute inset-0 -z-10 opacity-70"
          />
          <section className="scholar-card glow-card p-8">
            <div className="mx-auto flex w-fit -space-x-3 rtl:space-x-reverse">
              {["🦁", "🕊️", "🌿", "🔥"].map((e, i) => (
                <motion.span
                  key={e}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-white to-[var(--paper-1)] text-xl shadow"
                >
                  {e}
                </motion.span>
              ))}
            </div>
            <h1 className="mt-5 text-4xl">
              <span className="flow-text">{he ? "לומדים ביחד" : "Learning together"}</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              {he
                ? "התחבר כדי לראות מי לומד מה עכשיו, לעודד חברים, ולהצטרף ללימוד."
                : "Sign in to see who is learning what right now, cheer friends on, and join the learning."}
            </p>
            <Link
              to="/auth"
              search={authRedirect}
              className="flow-button mt-6 inline-flex h-12 items-center rounded-full px-7 font-bold"
            >
              {he ? "התחברות" : "Sign in"}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main id="main-content" className="relative mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <div
          aria-hidden
          className="hero-aurora pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-50"
        />

        <header className="mb-6">
          <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-3 py-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            {he ? "לומדים ביחד" : "learning together"}
          </div>
          <h1 className="text-4xl sm:text-5xl">
            <span className="flow-text">{he ? "פיד הקהילה" : "Community feed"}</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            {he
              ? "מי לומד מה עכשיו, סיומים חגיגיים, ועידוד הדדי. כל לימוד שמתחיל או נגמר מופיע כאן."
              : "Who is learning what right now, celebrations, and mutual encouragement. Every study that starts or finishes shows up here."}
          </p>
        </header>

        {/* Live-now rail */}
        {liveUsers.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel mb-4 rounded-2xl p-4"
            aria-label={he ? "פעילים עכשיו" : "Active now"}
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--moss)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--moss)] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--moss)]" />
              </span>
              {he ? "לומדים עכשיו" : "learning now"}
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {liveUsers.map((item) => (
                <div
                  key={item.user_id}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  <div className="flow-ring rounded-full p-0.5">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white"
                      style={{ background: avatarGradient(item.user_id) }}
                    >
                      {initials(item.display_name)}
                    </span>
                  </div>
                  <span className="w-full truncate text-[11px] text-muted-foreground">
                    {item.display_name}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Today's pulse */}
        <section
          className="mb-6 grid grid-cols-3 gap-2 sm:gap-3"
          aria-label={he ? "היום בקהילה" : "Today in the community"}
        >
          <PulseStat
            icon={<Users className="h-4 w-4" />}
            value={todayCount}
            label={he ? "לומדים היום" : "learners today"}
            tone="teal"
          />
          <PulseStat
            icon={<PartyPopper className="h-4 w-4" />}
            value={completedToday}
            label={he ? "סיומים היום" : "finished today"}
            tone="amber"
          />
          <PulseStat
            icon={<TrendingUp className="h-4 w-4" />}
            value={items.length}
            label={he ? "אירועים בפיד" : "feed events"}
            tone="royal"
          />
        </section>

        {feedQ.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="scholar-card animate-pulse p-5">
                <div className="h-4 w-1/3 rounded bg-secondary" />
                <div className="mt-3 h-4 w-2/3 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title={he ? "הפיד עוד ריק" : "The feed is empty"}
            description={
              he
                ? "פתח לימוד מהספרייה או מהחברותות — והוא יופיע כאן לכל הקהילה."
                : "Start a study from the library or chavrutot — it will show up here for the whole community."
            }
            action={
              <Link
                to="/learn-now"
                className="flow-button inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-bold"
              >
                <Zap className="h-4 w-4" />
                {he ? "התחל ללמוד עכשיו" : "Start learning now"}
              </Link>
            }
          />
        ) : (
          <ol className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((item, index) => {
                const celebration = item.kind === "session_completed";
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
                    className={`scholar-card glow-card p-4 sm:p-5 ${
                      celebration ? "border-[var(--amber)]/50" : ""
                    }`}
                  >
                    {celebration && (
                      <div
                        aria-hidden
                        className="flow-wash pointer-events-none absolute inset-0 rounded-[inherit] opacity-40"
                      />
                    )}
                    <div className="relative flex items-start gap-3">
                      <span
                        className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow"
                        style={{ background: avatarGradient(item.user_id) }}
                      >
                        {initials(item.display_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6">
                          <span className="font-semibold text-[var(--ink)]">
                            {item.display_name}
                          </span>{" "}
                          <span className="text-muted-foreground">{kindLabel(item, lang)}</span>
                        </p>
                        {item.source_title && (
                          <p className="mt-0.5 truncate font-medium text-primary">
                            {item.source_title}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                              celebration
                                ? "border-[var(--amber)]/40 bg-[var(--amber)]/10 text-[var(--amber)]"
                                : "border-border/70 bg-background/40 text-muted-foreground"
                            }`}
                          >
                            {kindIcon(item.kind)}
                            {timeAgo(item.created_at, lang)}
                          </span>
                          {item.kind === "session_completed" &&
                            typeof item.meta?.questions === "number" && (
                              <span>
                                {he
                                  ? `${item.meta.questions} שאלות בדרך`
                                  : `${item.meta.questions} questions asked`}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-3 flex flex-wrap items-center gap-2 ps-14">
                      <button
                        type="button"
                        onClick={() => cheer(item)}
                        onAnimationEnd={() => setBurstId((id) => (id === item.id ? null : id))}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-all ${
                          item.cheered_by_me
                            ? "border-[var(--rose)]/50 bg-[var(--rose-soft)] font-semibold text-[var(--rose)]"
                            : "border-border/70 bg-background/40 text-muted-foreground hover:border-[var(--rose)]/40 hover:text-[var(--rose)]"
                        } ${burstId === item.id ? "animate-cheer-burst" : ""}`}
                        aria-pressed={item.cheered_by_me}
                      >
                        🔥
                        <span className="tabular-nums">{item.cheer_count}</span>
                        <span className="hidden sm:inline">{he ? "עידוד" : "cheer"}</span>
                      </button>
                      {item.source_id && item.user_id !== user.id && (
                        <button
                          type="button"
                          disabled={learnToo.isPending}
                          onClick={() => learnToo.mutate(item.source_id!)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--teal)]/40 bg-[var(--teal-soft)] px-3 text-sm font-medium text-[var(--teal)] transition-colors hover:bg-[var(--teal)] hover:text-white disabled:opacity-50"
                        >
                          {learnToo.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BookOpen className="h-3.5 w-3.5" />
                          )}
                          {he ? "ללמוד גם" : "Learn this too"}
                        </button>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}

        <AppFooter />
      </main>
    </div>
  );
}

const PULSE_TONES = {
  teal: { color: "var(--teal)", bg: "var(--teal-soft)" },
  amber: { color: "var(--amber)", bg: "rgba(217,149,47,0.12)" },
  royal: { color: "var(--royal)", bg: "var(--royal-soft)" },
} as const;

function PulseStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: keyof typeof PULSE_TONES;
}) {
  const t = PULSE_TONES[tone];
  return (
    <div className="scholar-card flex items-center gap-3 p-3 sm:p-4">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ color: t.color, background: t.bg }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-sans text-lg font-bold tabular-nums" style={{ color: t.color }}>
          {value}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
