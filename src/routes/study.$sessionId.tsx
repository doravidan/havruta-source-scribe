import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Flag,
  HelpCircle,
  Loader2,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { PageLoader } from "@/components/page-shell";
import {
  AiVoiceControls,
  AudioControls,
  ChatPanel,
  GuidePanel,
  SegmentOutline,
  SessionCompleteOverlay,
  StudyTextStage,
  type StudyProgressRow,
  type StudyQuestionRow,
} from "@/components/study-room";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  advanceStudySegment,
  askStudySegmentQuestion,
  completeStudySession,
  generateSegmentQuestions,
  getStudySession,
  setSegmentStatus,
} from "@/lib/chavruta-study.functions";
import { useStudyAudioCall } from "@/hooks/use-study-audio-call";
import { useStudyPresence } from "@/hooks/use-study-presence";

export const Route = createFileRoute("/study/$sessionId")({
  head: () => ({ meta: [{ title: "לימוד משותף — חסידותא" }] }),
  component: StudyRoomPage,
});

function StudyRoomPage() {
  const { sessionId } = Route.useParams();
  const { user, loading } = useAuth();
  const { lang, dir } = useLang();
  const navigate = useNavigate();
  const toastError = (err: Error) =>
    toast.error(err.message || (lang === "he" ? "משהו השתבש" : "Something went wrong"));
  const qc = useQueryClient();
  const getStudy = useServerFn(getStudySession);
  const setStatusFn = useServerFn(setSegmentStatus);
  const advanceFn = useServerFn(advanceStudySegment);
  const generateFn = useServerFn(generateSegmentQuestions);
  const askFn = useServerFn(askStudySegmentQuestion);
  const completeFn = useServerFn(completeStudySession);
  const [draft, setDraft] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [tab, setTab] = useState<"text" | "guide" | "chat">("text");
  const [confettiKey, setConfettiKey] = useState(0);
  const [completion, setCompletion] = useState<{
    stats: { questions: number; understoodSegments: number };
  } | null>(null);
  const celebratedSegmentsRef = useRef<Set<number>>(new Set());
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audio = useStudyAudioCall(sessionId, user?.id);
  const presence = useStudyPresence(sessionId, user?.id);
  const studyQueryKey = useMemo(
    () => ["study-session", sessionId, lang] as const,
    [lang, sessionId],
  );
  const invalidateStudy = useCallback(
    () => qc.invalidateQueries({ queryKey: studyQueryKey, exact: true }),
    [qc, studyQueryKey],
  );

  const studyQ = useQuery({
    queryKey: studyQueryKey,
    enabled: !!user,
    queryFn: () => getStudy({ data: { sessionId, lang } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const bundle = studyQ.data;
  const activeIndex = bundle?.session.current_segment_index ?? 0;
  const activeSegment = bundle?.segments[activeIndex];
  const progress = useMemo(() => bundle?.progress ?? [], [bundle?.progress]);
  const questions = useMemo(
    () => (bundle?.questions ?? []).filter((q: StudyQuestionRow) => q.segment_index === activeIndex),
    [activeIndex, bundle?.questions],
  );
  const messages = useMemo(() => bundle?.messages ?? [], [bundle?.messages]);
  const isAiCompanion = bundle?.session.companion_type === "ai";

  const myProgress = useMemo(
    () =>
      progress.find((p: StudyProgressRow) => p.user_id === user?.id && p.segment_index === activeIndex),
    [activeIndex, progress, user?.id],
  );
  const partnerProgress = useMemo(
    () =>
      progress.find((p: StudyProgressRow) => p.user_id !== user?.id && p.segment_index === activeIndex),
    [activeIndex, progress, user?.id],
  );
  const understoodCount = useMemo(
    () =>
      new Set(
        progress
          .filter((p: StudyProgressRow) => p.segment_index === activeIndex && p.status === "understood")
          .map((p: StudyProgressRow) => p.user_id),
      ).size,
    [activeIndex, progress],
  );
  const myUnderstoodTotal = useMemo(
    () =>
      new Set(
        progress
          .filter((p: StudyProgressRow) => p.user_id === user?.id && p.status === "understood")
          .map((p: StudyProgressRow) => p.segment_index),
      ).size,
    [progress, user?.id],
  );
  const segmentsTotal = Math.max(1, bundle?.segments.length ?? 1);
  const progressPct = (myUnderstoodTotal / segmentsTotal) * 100;
  const isLastSegment = activeIndex >= segmentsTotal - 1;
  const bothUnderstood = isAiCompanion
    ? myProgress?.status === "understood"
    : myProgress?.status === "understood" && partnerProgress?.status === "understood";

  // Celebrate the first time a segment is fully understood by everyone in the room.
  useEffect(() => {
    if (!bothUnderstood || celebratedSegmentsRef.current.has(activeIndex)) return;
    celebratedSegmentsRef.current.add(activeIndex);
    setConfettiKey((k) => k + 1);
  }, [bothUnderstood, activeIndex]);

  useEffect(() => {
    if (!audio.remoteStream || !remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = audio.remoteStream;
    remoteAudioRef.current.play().catch(() => {
      toast.info(
        lang === "he" ? "לחץ במסך כדי להפעיל שמע" : "Tap anywhere to enable audio",
        { duration: 4000 },
      );
    });
  }, [audio.remoteStream, lang]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chavruta-study-db:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chavruta_study_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => invalidateStudy(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chavruta_study_progress",
          filter: `session_id=eq.${sessionId}`,
        },
        () => invalidateStudy(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chavruta_study_questions",
          filter: `session_id=eq.${sessionId}`,
        },
        () => invalidateStudy(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateStudy, sessionId, user]);

  useEffect(() => {
    if (!bundle?.session.match_id || !user || isAiCompanion) return;
    const channel = supabase
      .channel(`chavruta-study-chat:${bundle.session.match_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chavruta_messages",
          filter: `match_id=eq.${bundle.session.match_id}`,
        },
        () => invalidateStudy(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bundle?.session.match_id, invalidateStudy, isAiCompanion, user]);

  const statusMutation = useMutation({
    mutationFn: (status: "reading" | "confused" | "understood" | "answered") =>
      setStatusFn({ data: { sessionId, segmentIndex: activeIndex, status } }),
    onSuccess: () => invalidateStudy(),
    onError: toastError,
  });

  const completeMutation = useMutation({
    mutationFn: () => completeFn({ data: { sessionId } }),
    onSuccess: (result) => {
      setCompletion({ stats: result.stats });
      setConfettiKey((k) => k + 1);
      invalidateStudy();
      qc.invalidateQueries({ queryKey: ["study-summary"] });
    },
    onError: toastError,
  });

  const advanceMutation = useMutation({
    mutationFn: (next: number) => advanceFn({ data: { sessionId, segmentIndex: next } }),
    onSuccess: () => invalidateStudy(),
    onError: toastError,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateFn({ data: { sessionId, segmentIndex: activeIndex, lang } }),
    onSuccess: () => invalidateStudy(),
    onError: toastError,
  });

  const askMutation = useMutation({
    mutationFn: () =>
      askFn({ data: { sessionId, segmentIndex: activeIndex, question: questionDraft, lang } }),
    onSuccess: () => {
      setQuestionDraft("");
      invalidateStudy();
    },
    onError: toastError,
  });

  const askSelectedMutation = useMutation({
    mutationFn: () => {
      const quote = selectedText.trim().slice(0, 700);
      const question =
        lang === "he"
          ? `מה פירוש הקטע המסומן הזה בתוך המקור?\n\n${quote}`
          : `What does this selected passage mean in the source?\n\n${quote}`;
      return askFn({ data: { sessionId, segmentIndex: activeIndex, question, lang } });
    },
    onSuccess: () => {
      setTab("guide");
      invalidateStudy();
    },
    onError: toastError,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!bundle || !user || !draft.trim()) return;
      if (isAiCompanion) {
        await askFn({
          data: { sessionId, segmentIndex: activeIndex, question: draft.trim(), lang },
        });
        return;
      }
      if (!bundle.session.match_id) throw new Error("missing_match_for_chat");
      const { error } = await supabase.from("chavruta_messages").insert({
        match_id: bundle.session.match_id,
        sender_id: user.id,
        body: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      invalidateStudy();
    },
    onError: toastError,
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
        <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 text-center">
          <section className="scholar-card p-7">
            <h1 className="text-3xl">{lang === "he" ? "צריך להתחבר" : "Sign in required"}</h1>
            <Link
              to="/auth"
              search={{ redirect: `/study/${sessionId}` }}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-primary-foreground"
            >
              {lang === "he" ? "התחברות" : "Sign in"}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <header className="glass-panel mb-5 flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              to="/chavruta"
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              {lang === "he" ? "חזרה לחברותות" : "Back to chavrutot"}
            </Link>
            <h1 className="truncate text-2xl sm:text-4xl">
              {bundle?.source.title ?? (lang === "he" ? "חדר לימוד" : "Study room")}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${isAiCompanion || presence.partnerOnline ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" : "bg-muted-foreground/40"}`}
                aria-hidden
              />
              <span>
                {isAiCompanion
                  ? lang === "he"
                    ? "חברותא AI זמין עכשיו"
                    : "AI chavruta is ready"
                  : presence.partnerOnline
                    ? lang === "he"
                      ? "החברותא מחובר"
                      : "Partner online"
                    : lang === "he"
                      ? "החברותא לא מחובר"
                      : "Partner offline"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {bundle
                ? `${activeIndex + 1}/${Math.max(1, bundle.segments.length)} · ${understoodCount} ${lang === "he" ? "סימנו הבנתי" : "marked understood"}`
                : ""}
            </p>
          </div>
          {!isAiCompanion && (
            <button
              type="button"
              onClick={() => {
                audio.hangUp();
                navigate({ to: "/learn-now", search: { auto: "1" } });
              }}
              className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-full border border-border bg-card/60 px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary sm:self-center"
              title={lang === "he" ? "לעבור לחברותא הבאה" : "Skip to the next chavruta"}
            >
              <SkipForward className="h-4 w-4" />
              {lang === "he" ? "חברותא הבאה" : "Next chavruta"}
            </button>
          )}
          {isAiCompanion ? (
            <AiVoiceControls
              lang={lang}
              onAsk={async (text) => {
                const row = await askFn({
                  data: {
                    sessionId,
                    segmentIndex: activeIndex,
                    question: text,
                    lang,
                    includeSpeech: true,
                  },
                });
                invalidateStudy();
                const voiceRow = row as {
                  answer?: string | null;
                  speech_text?: string | null;
                } | null;
                return {
                  displayText: voiceRow?.answer ?? null,
                  speechText: voiceRow?.speech_text ?? voiceRow?.answer ?? null,
                };
              }}
            />
          ) : (
            <AudioControls audio={audio} lang={lang} />
          )}
        </header>

        {studyQ.isLoading ? (
          <div className="scholar-card grid min-h-80 place-items-center p-8">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : studyQ.error || !bundle || !activeSegment ? (
          <div className="scholar-card p-8 text-center text-muted-foreground">
            {lang === "he" ? "לא הצלחתי לטעון את חדר הלימוד." : "Could not load this study room."}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2 lg:hidden">
              {(["text", "guide", "chat"] as const).map((x) => (
                <button
                  key={x}
                  onClick={() => setTab(x)}
                  className={`h-10 rounded-full border text-sm ${tab === x ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/60"}`}
                >
                  {x === "text"
                    ? lang === "he"
                      ? "טקסט"
                      : "Text"
                    : x === "guide"
                      ? lang === "he"
                        ? "שאלות"
                        : "Guide"
                      : lang === "he"
                        ? "שיחה"
                        : "Chat"}
                </button>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)_360px]">
              <aside className={`${tab === "text" ? "block" : "hidden"} lg:block`}>
                <SegmentOutline
                  lang={lang}
                  bundle={bundle}
                  activeIndex={activeIndex}
                  onJump={(i) => advanceMutation.mutate(i)}
                  userId={user.id}
                />
              </aside>

              <section
                className={`${tab === "text" ? "block" : "hidden"} lg:block scholar-card overflow-hidden p-0`}
              >
                <StudyTextStage
                  lang={lang}
                  activeSegmentText={activeSegment.text}
                  status={myProgress?.status ?? "reading"}
                  partnerStatus={partnerProgress?.status}
                  isAiCompanion={isAiCompanion}
                  partnerOnline={presence.partnerOnline}
                  audio={audio}
                  selectedText={selectedText}
                  selectedAskPending={askSelectedMutation.isPending}
                  onSelectedText={setSelectedText}
                  onAskSelected={() => askSelectedMutation.mutate()}
                  reactions={presence.reactions}
                  onReact={presence.sendReaction}
                  progressPct={progressPct}
                  confettiKey={confettiKey}
                />
                <div className="flex flex-wrap gap-2 border-t border-border bg-background/30 p-4 sm:p-5">
                  <button
                    onClick={() => statusMutation.mutate("understood")}
                    className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-all ${
                      myProgress?.status === "understood"
                        ? "bg-[var(--moss)] text-white shadow-md"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    {myProgress?.status === "understood"
                      ? lang === "he"
                        ? "הבנתי ✓"
                        : "Understood ✓"
                      : lang === "he"
                        ? "הבנתי"
                        : "Understood"}
                  </button>
                  <button
                    onClick={() => statusMutation.mutate("confused")}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold"
                  >
                    <HelpCircle className="h-4 w-4 text-primary" />
                    {lang === "he" ? "צריך הסבר" : "Need explanation"}
                  </button>
                  <button
                    disabled={generateMutation.isPending}
                    onClick={() => generateMutation.mutate()}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/35 px-5 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {lang === "he" ? "שאלות על הקטע" : "Questions on this"}
                  </button>
                  {isLastSegment ? (
                    <button
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate()}
                      className={`ms-auto inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60 ${
                        bothUnderstood
                          ? "animate-glow-pulse bg-[var(--moss)]"
                          : "bg-[var(--moss)]/80"
                      }`}
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Flag className="h-4 w-4" />
                      )}
                      {lang === "he" ? "סיימנו!" : "We finished!"}
                    </button>
                  ) : (
                    <button
                      onClick={() => advanceMutation.mutate(activeIndex + 1)}
                      className={`ms-auto inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-all ${
                        bothUnderstood
                          ? "animate-glow-pulse bg-primary text-primary-foreground shadow-lg"
                          : "border border-border"
                      }`}
                    >
                      {bothUnderstood
                        ? lang === "he"
                          ? "ממשיכים! ←"
                          : "Onward! →"
                        : lang === "he"
                          ? "הבא"
                          : "Next"}
                    </button>
                  )}
                </div>
              </section>

              <aside className={`${tab === "guide" ? "block" : "hidden"} space-y-5 lg:block`}>
                <GuidePanel
                  lang={lang}
                  questions={questions}
                  questionDraft={questionDraft}
                  setQuestionDraft={setQuestionDraft}
                  askPending={askMutation.isPending}
                  generatePending={generateMutation.isPending}
                  onAsk={() => askMutation.mutate()}
                  onGenerate={() => generateMutation.mutate()}
                />
                <ChatPanel
                  lang={lang}
                  userId={user.id}
                  messages={messages}
                  aiQuestions={questions}
                  isAiCompanion={isAiCompanion}
                  draft={draft}
                  setDraft={setDraft}
                  onSend={() => sendMessage.mutate()}
                  sending={sendMessage.isPending}
                  mobileVisible={tab === "chat"}
                  partnerTyping={presence.partnerTyping}
                  partnerOnline={presence.partnerOnline}
                  onTyping={presence.notifyTyping}
                  onTypingStop={presence.notifyTypingStop}
                />
              </aside>

              <div className={`${tab === "chat" ? "block" : "hidden"} lg:hidden`}>
                <ChatPanel
                  lang={lang}
                  userId={user.id}
                  messages={messages}
                  aiQuestions={questions}
                  isAiCompanion={isAiCompanion}
                  draft={draft}
                  setDraft={setDraft}
                  onSend={() => sendMessage.mutate()}
                  sending={sendMessage.isPending}
                  mobileVisible
                  partnerTyping={presence.partnerTyping}
                  partnerOnline={presence.partnerOnline}
                  onTyping={presence.notifyTyping}
                  onTypingStop={presence.notifyTypingStop}
                />
              </div>
            </div>
          </>
        )}
      </main>
      {completion && bundle && (
        <SessionCompleteOverlay
          lang={lang}
          sourceTitle={bundle.source.title ?? (lang === "he" ? "המקור" : "the source")}
          segmentsTotal={segmentsTotal}
          stats={completion.stats}
          isAiCompanion={isAiCompanion}
          onKeepReading={() => setCompletion(null)}
        />
      )}
    </div>
  );
}
