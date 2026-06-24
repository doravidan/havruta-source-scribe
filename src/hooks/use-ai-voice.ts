import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
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
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = !!getRecognitionCtor() && typeof window !== "undefined" && "speechSynthesis" in window;
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
      rec.onresult = (e: any) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        setTranscript(text);
      };
      rec.onerror = (e: any) => {
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
          if (answer && answer.trim()) speak(answer);
          else setStatus("idle");
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

  return { status, error, transcript, supported, start, stop, speak, stopSpeaking };
}
