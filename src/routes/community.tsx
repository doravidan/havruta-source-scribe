import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Flame,
  GraduationCap,
  Loader2,
  PartyPopper,
  Sparkles,
  Users,
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
      return <BookOpen className="h-4 w-4" />;
    case "session_completed":
      return <PartyPopper className="h-4 w-4" />;
    case "source_studied":
      return <GraduationCap className="h-4 w-4" />;
    case "streak_milestone":
      return <Flame className="h-4 w-4" />;
  }
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
        <main id="main-content" className="mx-auto max-w-2xl px-4 py-16 text-center">
          <section className="scholar-card p-8">
            <Users className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-3xl gold-text">
              {lang === "he" ? "פיד הקהילה" : "Community feed"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {lang === "he"
                ? "התחבר כדי לראות מי לומד מה עכשיו, לעודד חברים, ולהצטרף ללימוד."
                : "Sign in to see who is learning what right now, cheer friends on, and join the learning."}
            </p>
            <Link
              to="/auth"
              search={authRedirect}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground"
            >
              {lang === "he" ? "התחברות" : "Sign in"}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const items = feedQ.data ?? [];
  const recentLearners = new Set(
    items
      .filter((i) => Date.now() - new Date(i.created_at).getTime() < 30 * 60_000)
      .map((i) => i.user_id),
  ).size;

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <header className="mb-8">
          <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-3 py-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            {lang === "he" ? "לומדים ביחד" : "learning together"}
          </div>
          <h1 className="text-4xl sm:text-5xl gold-text">
            {lang === "he" ? "פיד הקהילה" : "Community feed"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            {lang === "he"
              ? "מי לומד מה עכשיו, סיומים חגיגיים, ועידוד הדדי. כל לימוד שמתחיל או נגמר מופיע כאן."
              : "Who is learning what right now, celebrations, and mutual encouragement. Every study that starts or finishes shows up here."}
          </p>
          {recentLearners > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--moss)]/40 bg-[var(--moss)]/10 px-4 py-2 text-sm text-[var(--moss)]">
              <span className="h-2 w-2 animate-glow-pulse rounded-full bg-[var(--moss)]" />
              {lang === "he"
                ? `${recentLearners} לומדים פעילים בחצי השעה האחרונה`
                : `${recentLearners} learners active in the last half hour`}
            </div>
          )}
        </header>

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
            title={lang === "he" ? "הפיד עוד ריק" : "The feed is empty"}
            description={
              lang === "he"
                ? "פתח לימוד מהספרייה או מהחברותות — והוא יופיע כאן לכל הקהילה."
                : "Start a study from the library or chavrutot — it will show up here for the whole community."
            }
          />
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="scholar-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                      item.kind === "session_completed"
                        ? "border-[var(--moss)]/40 bg-[var(--moss)]/10 text-[var(--moss)]"
                        : "border-border/70 bg-background/40 text-primary"
                    }`}
                  >
                    {kindIcon(item.kind)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6">
                      <span className="font-semibold">{item.display_name}</span>{" "}
                      <span className="text-muted-foreground">{kindLabel(item, lang)}</span>
                    </p>
                    {item.source_title && (
                      <p className="mt-0.5 truncate font-medium text-primary">
                        {item.source_title}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{timeAgo(item.created_at, lang)}</span>
                      {item.kind === "session_completed" &&
                        typeof item.meta?.questions === "number" && (
                          <span>
                            ·{" "}
                            {lang === "he"
                              ? `${item.meta.questions} שאלות בדרך`
                              : `${item.meta.questions} questions asked`}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 ps-13">
                  <button
                    type="button"
                    onClick={() => cheerMutation.mutate(item.id)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                      item.cheered_by_me
                        ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-primary"
                    }`}
                    aria-pressed={item.cheered_by_me}
                  >
                    🔥
                    <span className="tabular-nums">{item.cheer_count}</span>
                    <span className="hidden sm:inline">
                      {lang === "he" ? "עידוד" : "cheer"}
                    </span>
                  </button>
                  {item.source_id && item.user_id !== user.id && (
                    <button
                      type="button"
                      disabled={learnToo.isPending}
                      onClick={() => learnToo.mutate(item.source_id!)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/5 px-3 text-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                    >
                      {learnToo.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BookOpen className="h-3.5 w-3.5" />
                      )}
                      {lang === "he" ? "ללמוד גם" : "Learn this too"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <AppFooter />
      </main>
    </div>
  );
}
