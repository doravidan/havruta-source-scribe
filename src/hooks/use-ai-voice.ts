import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

type SpeechRecognitionResultLike = {
  readonly length: number;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionWindow = typeof window & {
  SpeechRecognition?: { new (): SpeechRecognitionLike };
  webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
};

function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechRecognitionWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useAiVoice(opts: {
  lang: "he" | "en";
  onTranscript: (text: string) => Promise<string | null | undefined>;
}) {
  const { lang, onTranscript } = opts;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported =
    !!getRecognitionCtor() && typeof window !== "undefined" && "speechSynthesis" in window;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "he" ? "he-IL" : "en-US";
      utter.rate = 1;
      utter.onend = () => setStatus("idle");
      utter.onerror = () => setStatus("idle");
      setStatus("speaking");
      window.speechSynthesis.speak(utter);
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    setError(null);
    setTranscript("");
    setLastAnswer("");
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("speech_recognition_unsupported");
      setStatus("error");
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = lang === "he" ? "he-IL" : "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        setTranscript(text);
      };
      rec.onerror = (e) => {
        setError(String(e?.error ?? "speech_error"));
        setStatus("error");
      };
      rec.onend = async () => {
        const final = transcriptRef.current.trim();
        recRef.current = null;
        if (!final) {
          setStatus("idle");
          return;
        }
        setStatus("thinking");
        try {
          const answer = await onTranscriptRef.current(final);
          if (answer && answer.trim()) {
            setLastAnswer(answer.trim());
            speak(answer);
          } else setStatus("idle");
        } catch (err) {
          setError(err instanceof Error ? err.message : "ai_error");
          setStatus("error");
        }
      };
      recRef.current = rec;
      setStatus("listening");
      rec.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "mic_error");
      setStatus("error");
    }
  }, [lang, speak]);

  // Keep latest transcript visible to rec.onend without re-binding.
  const transcriptRef = useRef("");
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { status, error, transcript, lastAnswer, supported, start, stop, speak, stopSpeaking };
}
