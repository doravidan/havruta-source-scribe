import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, Radio, Users, X, Zap } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { PageLoader } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import {
  instantChavrutaStatus,
  joinInstantChavruta,
  leaveInstantChavruta,
} from "@/lib/instant-chavruta.functions";
import { useAuthRedirectSearch } from "@/lib/auth-redirect";
import { toast } from "sonner";

export const Route = createFileRoute("/learn-now")({
  validateSearch: (search: Record<string, unknown>): { auto?: "1" } =>
    search.auto === true || search.auto === "1" ? { auto: "1" } : {},
  head: () => ({
    meta: [
      { title: "לימוד מיידי — חסידותא · Chassiduta" },
      {
        name: "description",
        content:
          "לחיצה אחת ומקבלים חברותא חיה: התאמה מיידית עם לומד שמחובר עכשיו, מקור משותף, וקול.",
      },
    ],
  }),
  component: LearnNowPage,
});

type Phase = "idle" | "searching" | "matched";

function LearnNowPage() {
  const { user, loading } = useAuth();
  const { lang, dir } = useLang();
  const { auto } = Route.useSearch();
  const navigate = useNavigate();
  const authRedirect = useAuthRedirectSearch();
  const joinFn = useServerFn(joinInstantChavruta);
  const leaveFn = useServerFn(leaveInstantChavruta);
  const statusFn = useServerFn(instantChavrutaStatus);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const goToSession = useCallback(
    (sessionId: string) => {
      setPhase("matched");
      window.setTimeout(() => {
        navigate({ to: "/study/$sessionId", params: { sessionId } });
      }, 1200);
    },
    [navigate],
  );

  const statusQ = useQuery({
    queryKey: ["instant-chavruta-status"],
    enabled: !!user,
    queryFn: () => statusFn(),
    refetchInterval: phase === "searching" ? 4000 : false,
  });

  // Poll fallback: if realtime misses the match event, the status query catches it.
  useEffect(() => {
    const s = statusQ.data;
    if (!s || phaseRef.current !== "searching") return;
    if (s.status === "matched" && s.session_id) goToSession(s.session_id);
  }, [statusQ.data, goToSession]);

  // Realtime: own queue row flips to matched.
  useEffect(() => {
    if (!user || phase !== "searching") return;
    const channel = supabase
      .channel(`instant-queue:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chavruta_queue",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { status?: string; matched_session_id?: string | null };
          if (row.status === "matched" && row.matched_session_id) {
            goToSession(row.matched_session_id);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, phase, goToSession]);

  // Search timer.
  useEffect(() => {
    if (phase !== "searching") {
      setElapsed(0);
      return;
    }
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Leave the queue when navigating away mid-search.
  useEffect(() => {
    return () => {
      if (phaseRef.current === "searching") {
        leaveFn().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = useMutation({
    mutationFn: () => joinFn({ data: { lang } }),
    onSuccess: (result) => {
      if (result.status === "matched") {
        goToSession(result.session_id);
      } else {
        setPhase("searching");
      }
    },
    onError: (err: Error) => {
      setPhase("idle");
      toast.error(
        err.message.includes("no_sources")
          ? lang === "he"
            ? "אין מקורות זמינים כרגע"
            : "No sources available right now"
          : lang === "he"
            ? "ההצטרפות נכשלה, נסה שוב"
            : "Could not join, try again",
      );
    },
  });

  const cancel = useMutation({
    mutationFn: () => leaveFn(),
    onSettled: () => setPhase("idle"),
  });

  // "Next chavruta" from a study room lands here with ?auto=1 — rejoin immediately.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (!auto || !user || autoJoinedRef.current || phaseRef.current !== "idle") return;
    autoJoinedRef.current = true;
    join.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, user]);

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
            <Zap className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-3xl gold-text">
              {lang === "he" ? "לימוד מיידי" : "Learn now"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {lang === "he"
                ? "התחבר כדי לקבל חברותא חיה תוך שניות — מקור משותף, קול, ולימוד אמיתי."
                : "Sign in to get a live chavruta in seconds — shared source, voice, and real learning."}
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

  const waitingCount = statusQ.data?.waiting_count ?? 0;
  const he = lang === "he";

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main
        id="main-content"
        className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col items-center justify-center px-4 py-12"
      >
        <div
          aria-hidden
          className="hero-aurora pointer-events-none absolute inset-0 -z-10 opacity-60"
        />

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.section
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full max-w-xl text-center"
            >
              <div className="eyebrow mb-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-4 py-2">
                <Radio className="h-3.5 w-3.5 text-[var(--moss)]" />
                {he ? "חברותא מיידית" : "instant chavruta"}
              </div>
              <h1 className="text-5xl leading-tight sm:text-6xl">
                <span className="flow-text">
                  {he ? "מישהו מחכה ללמוד איתך" : "Someone is waiting to learn with you"}
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
                {he
                  ? "לחיצה אחת. אנחנו מתאימים אותך ללומד שמחובר עכשיו, בוחרים מקור, ופותחים חדר עם קול וטקסט משותף."
                  : "One click. We pair you with a learner online right now, pick a source, and open a live room with voice and shared text."}
              </p>

              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                disabled={join.isPending}
                onClick={() => join.mutate()}
                className="flow-button group relative mx-auto mt-10 grid h-44 w-44 place-items-center rounded-full shadow-[0_30px_80px_-30px_rgba(92,37,31,0.85)] disabled:opacity-60"
              >
                <span className="absolute inset-0 -z-10 animate-glow-pulse rounded-full bg-[var(--rose)]/30 blur-2xl" />
                <span className="grid place-items-center gap-2">
                  {join.isPending ? (
                    <Loader2 className="h-9 w-9 animate-spin" />
                  ) : (
                    <Zap className="h-9 w-9 transition-transform group-hover:rotate-12" />
                  )}
                  <span className="text-lg font-bold">{he ? "מצא חברותא" : "Find chavruta"}</span>
                </span>
              </motion.button>

              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span
                  className={`h-2 w-2 rounded-full ${waitingCount > 0 ? "animate-glow-pulse bg-[var(--moss)]" : "bg-muted-foreground/40"}`}
                />
                {waitingCount > 0
                  ? he
                    ? `${waitingCount} ממתינים עכשיו`
                    : `${waitingCount} waiting right now`
                  : he
                    ? "היה הראשון בתור — ההתאמה תקפוץ ברגע שמישהו יצטרף"
                    : "Be first in line — you'll match the moment someone joins"}
              </div>

              <div className="mt-10 grid gap-3 text-start sm:grid-cols-3">
                {(he
                  ? [
                      ["🎲", "מקור מפתיע", "בכל פעם טקסט חסידות אחר"],
                      ["🎙️", "קול וטקסט", "שיחה חיה על מקור משותף"],
                      ["⏭️", "הבא בתור", "לא מתאים? ממשיכים ללומד הבא"],
                    ]
                  : [
                      ["🎲", "Surprise source", "A different Chassidus text every time"],
                      ["🎙️", "Voice + text", "Live conversation over a shared source"],
                      ["⏭️", "Next in line", "Not a fit? Skip to the next learner"],
                    ]
                ).map(([icon, title, body]) => (
                  <div key={title} className="scholar-card glow-card p-4">
                    <div className="text-2xl">{icon}</div>
                    <div className="mt-2 text-sm font-semibold">{title}</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {phase === "searching" && (
            <motion.section
              key="searching"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-xl text-center"
            >
              <div className="relative mx-auto grid h-52 w-52 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full border-2 border-[var(--rose)]/30" />
                <span className="absolute inset-4 animate-ping rounded-full border-2 border-[var(--royal)]/25 [animation-delay:300ms]" />
                <span className="absolute inset-8 animate-ping rounded-full border-2 border-[var(--teal)]/20 [animation-delay:600ms]" />
                <div className="flow-ring rounded-full p-1">
                  <div className="grid h-28 w-28 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl">
                    <Users className="h-10 w-10" />
                  </div>
                </div>
              </div>

              <h2 className="mt-8 text-3xl sm:text-4xl">
                <span className="flow-text">
                  {he ? "מחפשים לך חברותא…" : "Finding your chavruta…"}
                </span>
              </h2>
              <p className="mt-3 text-muted-foreground">
                {he
                  ? "ברגע שלומד נוסף יצטרף — נצוות אתכם ונפתח חדר לימוד."
                  : "The moment another learner joins, we'll pair you and open a study room."}
              </p>
              <div className="mt-2 text-sm tabular-nums text-muted-foreground/70">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              </div>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-6 text-sm font-semibold disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  {he ? "ביטול" : "Cancel"}
                </button>
                <Link
                  to="/library"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/35 px-6 text-sm font-semibold text-primary"
                >
                  <BookOpen className="h-4 w-4" />
                  {he ? "ללמוד לבד בינתיים" : "Learn solo meanwhile"}
                </Link>
              </div>
            </motion.section>
          )}

          {phase === "matched" && (
            <motion.section
              key="matched"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className="flow-ring mx-auto w-fit rounded-full p-1 shadow-2xl"
              >
                <div className="grid h-32 w-32 place-items-center rounded-full bg-[var(--moss)] text-white">
                  <Users className="h-14 w-14" />
                </div>
              </motion.div>
              <h2 className="mt-6 text-4xl">
                <span className="flow-text">{he ? "נמצאה חברותא!" : "Chavruta found!"}</span>
              </h2>
              <p className="mt-2 text-muted-foreground">
                {he ? "פותחים לכם חדר לימוד…" : "Opening your study room…"}
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
