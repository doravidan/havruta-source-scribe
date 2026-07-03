import { useCallback, useRef } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { useStudyAudioCall } from "@/hooks/use-study-audio-call";
import { ParticipantTile } from "./participant-tile";
import { useAudioLevel } from "./use-audio-level";
import type { StudyLang } from "./types";

export function StudyTextStage({
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
  lang: StudyLang;
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
