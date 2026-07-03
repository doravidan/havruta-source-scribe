import { Loader2, Mic, MicOff } from "lucide-react";
import { useAiVoice } from "@/hooks/use-ai-voice";
import { VoiceWave } from "./voice-wave";
import type { StudyLang } from "./types";

export function AiVoiceControls({
  lang,
  onAsk,
}: {
  lang: StudyLang;
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
