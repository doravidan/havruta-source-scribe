import { Mic, MicOff, PhoneOff } from "lucide-react";
import type { useStudyAudioCall } from "@/hooks/use-study-audio-call";
import { useAudioLevel } from "./use-audio-level";
import { VoiceWave } from "./voice-wave";
import type { StudyLang } from "./types";

export function AudioControls({
  audio,
  lang,
}: {
  audio: ReturnType<typeof useStudyAudioCall>;
  lang: StudyLang;
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
