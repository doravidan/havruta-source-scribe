import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  HelpCircle,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
} from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { PageLoader } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import {
  advanceStudySegment,
  askStudySegmentQuestion,
  generateSegmentQuestions,
  getStudySession,
  setSegmentStatus,
} from "@/lib/chavruta-study.functions";
import { useStudyAudioCall } from "@/hooks/use-study-audio-call";
import { useStudyPresence } from "@/hooks/use-study-presence";
import { useAiVoice } from "@/hooks/use-ai-voice";

export const Route = createFileRoute("/study/$sessionId")({
  head: () => ({ meta: [{ title: "לימוד משותף — חסידותא" }] }),
  component: StudyRoomPage,
});

type Bundle = Awaited<ReturnType<typeof getStudySession>>;
type ProgressRow = Bundle["progress"][number];
type QuestionRow = Bundle["questions"][number];
type MessageRow = Bundle["messages"][number];

function StudyRoomPage() {
  const { sessionId } = Route.useParams();
  const { user, loading } = useAuth();
  const { lang, dir } = useLang();
  const qc = useQueryClient();
  const getStudy = useServerFn(getStudySession);
  const setStatusFn = useServerFn(setSegmentStatus);
  const advanceFn = useServerFn(advanceStudySegment);
  const generateFn = useServerFn(generateSegmentQuestions);
  const askFn = useServerFn(askStudySegmentQuestion);
  const [draft, setDraft] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [tab, setTab] = useState<"text" | "guide" | "chat">("text");
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
    () => (bundle?.questions ?? []).filter((q: QuestionRow) => q.segment_index === activeIndex),
    [activeIndex, bundle?.questions],
  );
  const messages = useMemo(() => bundle?.messages ?? [], [bundle?.messages]);
  const isAiCompanion = bundle?.session.companion_type === "ai";

  const myProgress = useMemo(
    () =>
      progress.find((p: ProgressRow) => p.user_id === user?.id && p.segment_index === activeIndex),
    [activeIndex, progress, user?.id],
  );
  const understoodCount = useMemo(
    () =>
      new Set(
        progress
          .filter((p: ProgressRow) => p.segment_index === activeIndex && p.status === "understood")
          .map((p: ProgressRow) => p.user_id),
      ).size,
    [activeIndex, progress],
  );

  useEffect(() => {
    if (!audio.remoteStream || !remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = audio.remoteStream;
  }, [audio.remoteStream]);

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
      channel.unsubscribe();
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
      channel.unsubscribe();
    };
  }, [bundle?.session.match_id, invalidateStudy, isAiCompanion, user]);

  const statusMutation = useMutation({
    mutationFn: (status: "reading" | "confused" | "understood" | "answered") =>
      setStatusFn({ data: { sessionId, segmentIndex: activeIndex, status } }),
    onSuccess: () => invalidateStudy(),
  });

  const advanceMutation = useMutation({
    mutationFn: (next: number) => advanceFn({ data: { sessionId, segmentIndex: next } }),
    onSuccess: () => invalidateStudy(),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateFn({ data: { sessionId, segmentIndex: activeIndex, lang } }),
    onSuccess: () => invalidateStudy(),
  });

  const askMutation = useMutation({
    mutationFn: () =>
      askFn({ data: { sessionId, segmentIndex: activeIndex, question: questionDraft, lang } }),
    onSuccess: () => {
      setQuestionDraft("");
      invalidateStudy();
    },
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
        <header className="mb-5 flex flex-col gap-3 rounded-3xl border border-border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                />
              </aside>

              <section
                className={`${tab === "text" ? "block" : "hidden"} lg:block scholar-card overflow-hidden p-0`}
              >
                <StudyTextStage
                  lang={lang}
                  activeSegmentText={activeSegment.text}
                  status={myProgress?.status ?? "reading"}
                  isAiCompanion={isAiCompanion}
                  partnerOnline={presence.partnerOnline}
                  audio={audio}
                  selectedText={selectedText}
                  selectedAskPending={askSelectedMutation.isPending}
                  onSelectedText={setSelectedText}
                  onAskSelected={() => askSelectedMutation.mutate()}
                />
                <div className="flex flex-wrap gap-2 border-t border-border bg-background/30 p-4 sm:p-5">
                  <button
                    onClick={() => statusMutation.mutate("understood")}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                    {lang === "he" ? "הבנתי" : "Understood"}
                  </button>
                  <button
                    onClick={() => statusMutation.mutate("confused")}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold"
                  >
                    <HelpCircle className="h-4 w-4 text-primary" />
                    {lang === "he" ? "צריך הסבר" : "Need explanation"}
                  </button>
                  <button
                    onClick={() => generateMutation.mutate()}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/35 px-5 text-sm font-semibold text-primary"
                  >
                    <Sparkles className="h-4 w-4" />
                    {lang === "he" ? "שאלות על הקטע" : "Questions on this"}
                  </button>
                  <button
                    disabled={activeIndex >= bundle.segments.length - 1}
                    onClick={() => advanceMutation.mutate(activeIndex + 1)}
                    className="ms-auto inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold disabled:opacity-40"
                  >
                    {lang === "he" ? "הבא" : "Next"}
                  </button>
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
    </div>
  );
}

function ParticipantTile({
  name,
  role,
  online,
  muted,
  level,
  tone = "primary",
}: {
  name: string;
  role: string;
  online: boolean;
  muted?: boolean;
  level?: number;
  tone?: "primary" | "emerald";
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="rounded-3xl border border-border bg-[rgba(255,250,239,0.72)] p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold text-white shadow-inner ${tone === "emerald" ? "bg-emerald-700" : "bg-primary"}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{name}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            />
            {role}
          </div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background/50">
          {muted ? (
            <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
      </div>
      <VoiceWave
        level={level ?? 0}
        active={online && !muted}
        label={muted ? "muted" : "voice"}
        tone={tone}
      />
    </div>
  );
}

function StudyTextStage({
  lang,
  activeSegmentText,
  status,
  isAiCompanion,
  partnerOnline,
  audio,
  selectedText,
  selectedAskPending,
  onSelectedText,
  onAskSelected,
}: {
  lang: "he" | "en";
  activeSegmentText: string;
  status: string;
  isAiCompanion: boolean;
  partnerOnline: boolean;
  audio: ReturnType<typeof useStudyAudioCall>;
  selectedText: string;
  selectedAskPending: boolean;
  onSelectedText: (value: string) => void;
  onAskSelected: () => void;
}) {
  const articleRef = useRef<HTMLElement | null>(null);
  const live = audio.state === "live" || audio.state === "muted";
  const localLevel = useAudioLevel(audio.localStream, live && !audio.muted);
  const remoteLevel = useAudioLevel(audio.remoteStream, live);

  const captureSelection = useCallback(() => {
    if (typeof window === "undefined" || !articleRef.current) return;
    const selection = window.getSelection();
    const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!text || text.length < 2) return;
    const anchor = selection?.anchorNode;
    if (anchor && articleRef.current.contains(anchor)) onSelectedText(text.slice(0, 700));
  }, [onSelectedText]);

  return (
    <div>
      <div className="border-b border-border bg-background/35 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">{lang === "he" ? "חדר חי" : "Live study room"}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "he"
                ? "הטקסט משותף באמצע. מסמנים מילים ושואלים את ה-AI על המקום."
                : "The shared text stays in the middle. Select words and ask AI in context."}
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {status}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ParticipantTile
            name={lang === "he" ? "אני" : "Me"}
            role={
              audio.muted
                ? lang === "he"
                  ? "מיקרופון סגור"
                  : "mic off"
                : lang === "he"
                  ? "בלימוד"
                  : "studying"
            }
            online
            muted={audio.muted || !live}
            level={localLevel}
          />
          <ParticipantTile
            name={isAiCompanion ? "AI חברותא" : lang === "he" ? "החברותא" : "Chavruta"}
            role={
              isAiCompanion
                ? lang === "he"
                  ? "זמין לשאלות"
                  : "ready for questions"
                : partnerOnline
                  ? lang === "he"
                    ? "מחובר"
                    : "online"
                  : lang === "he"
                    ? "ממתין לחיבור"
                    : "waiting"
            }
            online={isAiCompanion || partnerOnline || !!audio.remoteStream}
            muted={!isAiCompanion && !audio.remoteStream}
            level={remoteLevel}
            tone="emerald"
          />
        </div>
      </div>

      <div className="p-4 sm:p-7">
        <article
          ref={articleRef}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          className="rounded-3xl border border-border bg-[rgba(255,250,239,0.78)] p-5 text-xl leading-9 shadow-inner selection:bg-primary/20 sm:p-8 sm:text-2xl sm:leading-[2.35]"
        >
          {activeSegmentText}
        </article>
        <div className="mt-4 rounded-3xl border border-border bg-background/35 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground">
                {lang === "he" ? "שאלת AI על סימון" : "AI question from selection"}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {selectedText ||
                  (lang === "he"
                    ? "סמן מילה או משפט בתוך המקור כדי לשאול מה הפירוש."
                    : "Select a word or sentence in the source to ask what it means.")}
              </p>
            </div>
            <button
              disabled={!selectedText.trim() || selectedAskPending}
              onClick={onAskSelected}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-45"
            >
              {selectedAskPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {lang === "he" ? "שאל על הסימון" : "Ask about selection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useAudioLevel(stream: MediaStream | null | undefined, active: boolean) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || !active || typeof window === "undefined") {
      setLevel(0);
      return;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(Math.min(1, avg / 90));
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => undefined);
    };
  }, [active, stream]);

  return level;
}

function VoiceWave({
  level,
  active,
  label,
  tone = "primary",
}: {
  level: number;
  active: boolean;
  label: string;
  tone?: "primary" | "emerald";
}) {
  const bars = [0.18, 0.45, 0.78, 0.55, 0.95, 0.62, 0.35, 0.7, 0.5, 0.28];
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-background/35 px-3 py-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${active ? (tone === "emerald" ? "bg-emerald-500" : "bg-primary") : "bg-muted-foreground/40"}`}
      />
      <div className="flex h-7 items-center gap-0.5" aria-hidden>
        {bars.map((bar, index) => (
          <span
            key={index}
            className={`w-1 rounded-full transition-all duration-150 ${tone === "emerald" ? "bg-emerald-500/75" : "bg-primary/75"}`}
            style={{
              height: `${Math.max(18, (active ? bar * 42 + level * 36 : bar * 16) + 8)}%`,
              opacity: active ? 0.95 : 0.35,
            }}
          />
        ))}
      </div>
      <span className="max-w-28 truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function AudioControls({
  audio,
  lang,
}: {
  audio: ReturnType<typeof useStudyAudioCall>;
  lang: "he" | "en";
}) {
  const live = audio.state === "live" || audio.state === "muted";
  const localLevel = useAudioLevel(audio.localStream, live && !audio.muted);
  const remoteLevel = useAudioLevel(audio.remoteStream, live);
  const statusLabel =
    audio.state === "live"
      ? lang === "he"
        ? "שיחה חיה"
        : "Live conversation"
      : audio.state === "connecting"
        ? lang === "he"
          ? "מחבר את החברותא..."
          : "Connecting chavruta..."
        : audio.state === "muted"
          ? lang === "he"
            ? "אתה מושתק"
            : "You are muted"
          : audio.state === "error"
            ? lang === "he"
              ? "שגיאת אודיו"
              : "Audio error"
            : lang === "he"
              ? "שיחה קולית מוכנה"
              : "Voice conversation ready";

  return (
    <div className="w-full min-w-0 rounded-3xl border border-border bg-background/35 p-2 shadow-sm sm:min-w-[18rem]">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <div>
          <div className="text-xs font-semibold text-foreground">{statusLabel}</div>
          <div className="text-[11px] text-muted-foreground">
            {lang === "he" ? "רואים מי מדבר בזמן אמת" : "See who is speaking in real time"}
          </div>
        </div>
        {live && (
          <button
            onClick={audio.hangUp}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
            aria-label={lang === "he" ? "נתק שיחה" : "Hang up"}
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <VoiceWave
          level={localLevel}
          active={live && !audio.muted}
          label={
            audio.muted
              ? lang === "he"
                ? "אני · מושתק"
                : "Me · muted"
              : lang === "he"
                ? "אני"
                : "Me"
          }
        />
        <VoiceWave
          level={remoteLevel}
          active={!!audio.remoteStream && live}
          label={lang === "he" ? "החברותא" : "Chavruta"}
          tone="emerald"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {audio.state === "idle" || audio.state === "error" ? (
          <button
            onClick={audio.startCall}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Mic className="h-4 w-4" />
            {lang === "he" ? "התחל שיחה" : "Start conversation"}
          </button>
        ) : (
          <button
            onClick={audio.toggleMute}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold"
          >
            {audio.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {audio.muted
              ? lang === "he"
                ? "פתח מיקרופון"
                : "Open mic"
              : lang === "he"
                ? "השתק אותי"
                : "Mute me"}
          </button>
        )}
      </div>
      {audio.error && <div className="mt-2 px-2 text-xs text-destructive">{audio.error}</div>}
    </div>
  );
}

function AiVoiceControls({
  lang,
  onAsk,
}: {
  lang: "he" | "en";
  onAsk: (
    text: string,
  ) => Promise<
    string | { displayText?: string | null; speechText?: string | null } | null | undefined
  >;
}) {
  const voice = useAiVoice({ lang, onTranscript: onAsk });
  if (!voice.supported) {
    return (
      <div className="rounded-3xl border border-primary/35 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary">
        {lang === "he"
          ? "חברותא AI פעיל בטקסט. דיבור קולי לא נתמך בדפדפן הזה."
          : "AI chavruta is available in text. Voice is unsupported in this browser."}
      </div>
    );
  }

  const active =
    voice.status === "listening" || voice.status === "thinking" || voice.status === "speaking";
  const voiceLevel =
    voice.status === "listening"
      ? 0.65
      : voice.status === "speaking"
        ? 0.85
        : voice.status === "thinking"
          ? 0.35
          : 0;
  const label =
    voice.status === "listening"
      ? lang === "he"
        ? "מקשיב לך"
        : "Listening"
      : voice.status === "thinking"
        ? lang === "he"
          ? "מעיין בקטע"
          : "Reading the segment"
        : voice.status === "speaking"
          ? lang === "he"
            ? "עונה בקול"
            : "Answering aloud"
          : lang === "he"
            ? "שיחה קולית עם AI"
            : "Voice AI chavruta";
  const primaryClick =
    voice.status === "listening"
      ? voice.stop
      : voice.status === "speaking"
        ? voice.stopSpeaking
        : voice.start;
  const Icon = voice.status === "listening" || voice.status === "speaking" ? MicOff : Mic;

  return (
    <div className="w-full min-w-0 rounded-3xl border border-primary/25 bg-primary/5 p-2 shadow-sm sm:min-w-[19rem]">
      <div className="mb-2 flex items-center justify-between gap-3 px-2">
        <div>
          <div className="text-xs font-semibold text-foreground">{label}</div>
          <div className="text-[11px] text-muted-foreground">
            {lang === "he"
              ? "מדברים טבעי, השיחה נשמרת בצד"
              : "Speak naturally; the chat stays visible"}
          </div>
        </div>
        {voice.status === "thinking" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>

      <VoiceWave
        level={voiceLevel}
        active={active}
        label={
          voice.status === "speaking"
            ? lang === "he"
              ? "AI מדבר"
              : "AI speaking"
            : lang === "he"
              ? "אני שואל"
              : "My voice"
        }
      />

      {(voice.transcript || voice.lastAnswer) && (
        <div className="mt-2 grid gap-1.5 text-xs">
          {voice.transcript && (
            <div className="rounded-2xl bg-primary/10 px-3 py-2 text-primary">
              <span className="font-semibold">{lang === "he" ? "אתה: " : "You: "}</span>
              {voice.transcript}
            </div>
          )}
          {voice.lastAnswer && (
            <div className="line-clamp-2 rounded-2xl bg-card/80 px-3 py-2 text-foreground">
              <span className="font-semibold">AI: </span>
              {voice.lastAnswer}
            </div>
          )}
        </div>
      )}

      <button
        onClick={primaryClick}
        disabled={voice.status === "thinking"}
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {voice.status === "thinking" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {voice.status === "listening"
          ? lang === "he"
            ? "סיים שאלה"
            : "Finish question"
          : voice.status === "speaking"
            ? lang === "he"
              ? "עצור תשובה"
              : "Stop answer"
            : lang === "he"
              ? "דבר עכשיו"
              : "Speak now"}
      </button>
      {voice.error && <div className="mt-2 px-2 text-xs text-destructive">{voice.error}</div>}
    </div>
  );
}

function SegmentOutline({
  lang,
  bundle,
  activeIndex,
  onJump,
}: {
  lang: "he" | "en";
  bundle: Bundle;
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  const visibleSegments = useMemo(() => {
    if (bundle.segments.length <= 160) return bundle.segments;
    const start = Math.max(0, activeIndex - 60);
    const end = Math.min(bundle.segments.length, activeIndex + 100);
    return bundle.segments.slice(start, end);
  }, [activeIndex, bundle.segments]);

  return (
    <div className="scholar-card p-4">
      <div className="eyebrow mb-3">{lang === "he" ? "קטעים" : "Segments"}</div>
      {visibleSegments.length < bundle.segments.length && (
        <div className="mb-2 rounded-2xl border border-border bg-background/30 p-2 text-xs text-muted-foreground">
          {lang === "he"
            ? "מציגים את הקטעים סביב המיקום הנוכחי כדי לשמור על ביצועים."
            : "Showing segments near your current position for performance."}
        </div>
      )}
      <div className="max-h-[70vh] space-y-2 overflow-auto pe-1">
        {visibleSegments.map((segment) => (
          <button
            key={segment.index}
            onClick={() => onJump(segment.index)}
            className={`block w-full rounded-2xl border p-3 text-start text-sm ${segment.index === activeIndex ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/30 text-muted-foreground"}`}
          >
            <div className="font-medium">
              {lang === "he" ? `קטע ${segment.index + 1}` : `Segment ${segment.index + 1}`}
            </div>
            <div className="mt-1 line-clamp-2 text-xs">{segment.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GuidePanel({
  lang,
  questions,
  questionDraft,
  setQuestionDraft,
  askPending,
  generatePending,
  onAsk,
  onGenerate,
}: {
  lang: "he" | "en";
  questions: QuestionRow[];
  questionDraft: string;
  setQuestionDraft: (value: string) => void;
  askPending: boolean;
  generatePending: boolean;
  onAsk: () => void;
  onGenerate: () => void;
}) {
  return (
    <section className="scholar-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="eyebrow">{lang === "he" ? "שאלות והנחיה" : "Questions & guide"}</h2>
        <button
          onClick={onGenerate}
          className="rounded-full border border-primary/35 px-3 py-1.5 text-xs font-semibold text-primary"
        >
          {generatePending ? "..." : lang === "he" ? "צור שאלות" : "Generate"}
        </button>
      </div>
      <div className="space-y-2">
        {questions.length === 0 ? (
          <p className="rounded-2xl border border-border bg-background/30 p-3 text-sm text-muted-foreground">
            {lang === "he"
              ? "לחץ צור שאלות אחרי שסיימתם לקרוא את הקטע."
              : "Generate questions after you read the segment."}
          </p>
        ) : (
          questions.map((q) => (
            <div
              key={q.id}
              className="rounded-2xl border border-border bg-background/30 p-3 text-sm"
            >
              <div className="font-medium text-foreground">{q.question}</div>
              {q.answer && <p className="mt-2 leading-6 text-muted-foreground">{q.answer}</p>}
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={questionDraft}
          onChange={(e) => setQuestionDraft(e.target.value)}
          placeholder={lang === "he" ? "שאלה על הקטע..." : "Question about the segment..."}
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background/45 px-3 text-sm outline-none"
        />
        <button
          disabled={!questionDraft.trim() || askPending}
          onClick={onAsk}
          className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {lang === "he" ? "שאל" : "Ask"}
        </button>
      </div>
    </section>
  );
}

function ChatPanel({
  lang,
  userId,
  messages,
  aiQuestions,
  isAiCompanion,
  draft,
  setDraft,
  onSend,
  sending,
  partnerTyping,
  partnerOnline,
  onTyping,
  onTypingStop,
}: {
  lang: "he" | "en";
  userId: string;
  messages: MessageRow[];
  aiQuestions: QuestionRow[];
  isAiCompanion: boolean;
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  mobileVisible?: boolean;
  partnerTyping?: boolean;
  partnerOnline?: boolean;
  onTyping?: () => void;
  onTypingStop?: () => void;
}) {
  const aiConversation = useMemo(
    () => aiQuestions.filter((q) => q.kind === "human"),
    [aiQuestions],
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiConversation.length, messages.length, sending]);
  return (
    <section className="scholar-card p-4">
      <h2 className="eyebrow mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          {isAiCompanion
            ? lang === "he"
              ? "חברותא AI"
              : "AI chavruta"
            : lang === "he"
              ? "שיחה"
              : "Chat"}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isAiCompanion || partnerOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            aria-hidden
          />
          {isAiCompanion
            ? lang === "he"
              ? "זמין"
              : "ready"
            : partnerOnline
              ? lang === "he"
                ? "מחובר"
                : "online"
              : lang === "he"
                ? "לא מחובר"
                : "offline"}
        </span>
      </h2>
      <div
        ref={scrollRef}
        className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-border bg-background/30 p-3"
      >
        {isAiCompanion ? (
          aiConversation.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lang === "he"
                ? "שאל את החברותא AI על הקטע הנוכחי, או לחץ ‘שאל אותנו על הקטע’ כדי לקבל שאלות הבנה."
                : "Ask the AI chavruta about the current segment, or generate comprehension questions."}
            </p>
          ) : (
            aiConversation.map((q) => (
              <div key={q.id} className="space-y-2">
                <div className="ms-auto max-w-[86%] rounded-[1.35rem] rounded-se-sm bg-primary/10 px-3 py-2 text-sm text-primary shadow-sm">
                  {q.question}
                </div>
                {q.answer && (
                  <div className="max-w-[92%] rounded-[1.35rem] rounded-ss-sm border border-border bg-card/75 px-3 py-2 text-sm leading-6 text-foreground shadow-sm">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {lang === "he" ? "חברותא AI" : "AI chavruta"}
                    </div>
                    {q.answer}
                  </div>
                )}
              </div>
            ))
          )
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lang === "he" ? "עדיין אין הודעות." : "No messages yet."}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div
                key={m.id}
                className={`max-w-[88%] rounded-[1.35rem] px-3 py-2 text-sm shadow-sm ${mine ? "ms-auto rounded-se-sm bg-primary/10 text-primary" : "rounded-ss-sm bg-card/70 text-foreground"}`}
              >
                {m.body}
              </div>
            );
          })
        )}
        {!isAiCompanion && partnerTyping && (
          <div className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            {lang === "he" ? "החברותא מקליד..." : "Partner is typing..."}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!isAiCompanion) {
              if (e.target.value.trim()) onTyping?.();
              else onTypingStop?.();
            }
          }}
          onBlur={() => onTypingStop?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onTypingStop?.();
              onSend();
            }
          }}
          placeholder={
            isAiCompanion
              ? lang === "he"
                ? "שאל את החברותא AI על הקטע..."
                : "Ask the AI chavruta about this segment..."
              : lang === "he"
                ? "כתוב לחברותא..."
                : "Message your chavruta..."
          }
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background/45 px-3 text-sm outline-none"
        />
        <button
          disabled={!draft.trim() || sending}
          onClick={() => {
            onTypingStop?.();
            onSend();
          }}
          className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isAiCompanion ? (lang === "he" ? "שאל" : "Ask") : lang === "he" ? "שלח" : "Send"}
        </button>
      </div>
    </section>
  );
}
