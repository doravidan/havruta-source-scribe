import { useCallback, useRef } from "react";
import { Check, HelpCircle, Loader2, Sparkles } from "lucide-react";
import type { useStudyAudioCall } from "@/hooks/use-study-audio-call";
import type { LiveReaction } from "@/hooks/use-study-presence";
import { ParticipantTile } from "./participant-tile";
import { useAudioLevel } from "./use-audio-level";
import { FloatingReactions, ReactionsBar } from "./reactions";
import { ConfettiBurst } from "./confetti";
import type { StudyLang } from "./types";

function statusChip(status: string | undefined, lang: StudyLang) {
  if (status === "understood")
    return {
      icon: <Check className="h-3 w-3" />,
      text: lang === "he" ? "הבין" : "understood",
      cls: "border-[var(--moss)]/50 bg-[var(--moss)]/10 text-[var(--moss)]",
    };
  if (status === "confused")
    return {
      icon: <HelpCircle className="h-3 w-3" />,
      text: lang === "he" ? "צריך הסבר" : "needs help",
      cls: "border-[var(--saffron)]/60 bg-[var(--saffron)]/10 text-[var(--oxide-deep)]",
    };
  return null;
}

export function StudyTextStage({
  lang,
  activeSegmentText,
  status,
  partnerStatus,
  isAiCompanion,
  partnerOnline,
  audio,
  selectedText,
  selectedAskPending,
  onSelectedText,
  onAskSelected,
  reactions,
  onReact,
  progressPct,
  confettiKey,
}: {
  lang: StudyLang;
  activeSegmentText: string;
  status: string;
  partnerStatus?: string;
  isAiCompanion: boolean;
  partnerOnline: boolean;
  audio: ReturnType<typeof useStudyAudioCall>;
  selectedText: string;
  selectedAskPending: boolean;
  onSelectedText: (value: string) => void;
  onAskSelected: () => void;
  reactions: LiveReaction[];
  onReact: (emoji: string) => void;
  progressPct: number;
  confettiKey: number;
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

  const myChip = statusChip(status, lang);
  const partnerChip = statusChip(partnerStatus, lang);

  return (
    <div className="relative">
      <div
        className="h-1.5 w-full bg-border/50"
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={lang === "he" ? "התקדמות בלימוד" : "Study progress"}
      >
        <div
          className="h-full bg-gradient-to-r from-[var(--moss)] via-[var(--saffron)] to-[var(--oxide)] transition-all duration-700"
          style={{ width: `${Math.max(2, progressPct)}%` }}
        />
      </div>

      <div className="border-b border-border bg-background/35 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">{lang === "he" ? "חדר חי" : "Live study room"}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "he"
                ? "הטקסט משותף באמצע. מסמנים מילים, שולחים תגובות, ולומדים ביחד."
                : "The shared text stays in the middle. Highlight, react, and learn together."}
            </p>
          </div>
          <ReactionsBar onReact={onReact} lang={lang} />
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
            chip={myChip}
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
            chip={isAiCompanion ? null : partnerChip}
          />
        </div>
      </div>

      <div className="relative p-4 sm:p-7">
        <FloatingReactions reactions={reactions} />
        <ConfettiBurst burstKey={confettiKey} />
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
