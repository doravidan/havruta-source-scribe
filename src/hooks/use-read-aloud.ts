import { useCallback, useEffect, useRef, useState } from "react";

// Free client-side read-aloud using the browser SpeechSynthesis API.
// This avoids Lovable AI Gateway / paid TTS entirely. Voice quality depends on
// the user's browser/OS, but it keeps the reader feature working at zero API cost.
function chunkText(text: string, maxChars = 260): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?׃\n]+[.!?׃]?\s*/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    const t = cur.trim();
    if (t) chunks.push(t);
    cur = "";
  };
  for (const sRaw of sentences) {
    const s = sRaw.trim();
    if (!s) continue;
    if (s.length > maxChars) {
      flush();
      const words = s.split(/\s+/);
      let buf = "";
      for (const w of words) {
        if (buf.length + w.length + 1 > maxChars) {
          chunks.push(buf.trim());
          buf = "";
        }
        buf += (buf ? " " : "") + w;
      }
      if (buf.trim()) chunks.push(buf.trim());
      continue;
    }
    if (cur.length + s.length + 1 > maxChars) flush();
    cur += (cur ? " " : "") + s;
  }
  flush();
  return chunks;
}

type Status = "idle" | "loading" | "playing" | "paused" | "error";

function pickVoice(lang: "he" | "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang === "he" ? "he" : "en";
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? voices.find((v) => v.lang.toLowerCase().startsWith("en"));
}

export function useReadAloud() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    cancelRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setStatus("idle");
    setProgress(0);
  }, []);

  const pause = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setStatus("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setStatus("playing");
    }
  }, []);

  const speak = useCallback(
    async (text: string, lang: "he" | "en") => {
      stop();
      cancelRef.current = false;
      setError(null);
      setStatus("loading");
      setProgress(0);

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setError("speech_synthesis_unavailable");
        setStatus("error");
        return;
      }

      const chunks = chunkText(text);
      if (chunks.length === 0) {
        setStatus("idle");
        return;
      }

      const voice = pickVoice(lang);
      const playOne = (chunk: string) =>
        new Promise<void>((resolve, reject) => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = lang === "he" ? "he-IL" : "en-US";
          u.rate = lang === "he" ? 0.9 : 0.95;
          u.pitch = 1;
          if (voice) u.voice = voice;
          u.onstart = () => setStatus("playing");
          u.onend = () => resolve();
          u.onerror = (event) => reject(new Error(event.error || "speech_error"));
          utteranceRef.current = u;
          window.speechSynthesis.speak(u);
        });

      try {
        // Some browsers populate voices asynchronously.
        if (window.speechSynthesis.getVoices().length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        for (let i = 0; i < chunks.length; i++) {
          if (cancelRef.current) break;
          await playOne(chunks[i]);
          setProgress((i + 1) / chunks.length);
        }
        if (!cancelRef.current) {
          setStatus("idle");
          setProgress(0);
        }
      } catch (e: unknown) {
        const msg = (e as Error)?.message ?? "speech_failed";
        setError(msg);
        setStatus("error");
      }
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { status, progress, error, speak, pause, resume, stop };
}
