import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeSpeechChunk } from "@/lib/tts.functions";

// Split text into chunks at sentence/paragraph boundaries, each ≤ maxChars.
// Falls back to word-splitting for any single sentence that exceeds the cap.
function chunkText(text: string, maxChars = 600): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Sentence terminators include Hebrew sof-pasuk (׃) and standard . ! ?
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

export function useReadAloud() {
  const synth = useServerFn(synthesizeSpeechChunk);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0); // 0..1
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const cancelRef = useRef(false);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    cancelRef.current = true;
    cleanup();
    setStatus("idle");
    setProgress(0);
  }, [cleanup]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => setStatus("playing")).catch(() => {});
  }, []);

  const speak = useCallback(
    async (text: string, lang: "he" | "en") => {
      stop();
      cancelRef.current = false;
      setError(null);
      setStatus("loading");
      setProgress(0);

      const chunks = chunkText(text);
      if (chunks.length === 0) {
        setStatus("idle");
        return;
      }

      const playOne = (url: string) =>
        new Promise<void>((resolve, reject) => {
          const a = new Audio(url);
          audioRef.current = a;
          a.onended = () => resolve();
          a.onerror = () => reject(new Error("audio_error"));
          a.play().then(() => setStatus("playing")).catch(reject);
        });

      try {
        for (let i = 0; i < chunks.length; i++) {
          if (cancelRef.current) break;
          const { audioBase64, mime } = await synth({
            data: { text: chunks[i], lang },
          });
          if (cancelRef.current) break;
          // Convert base64 → Blob (avoid stack overflow on large strings).
          const bin = atob(audioBase64);
          const bytes = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
          const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
          urlsRef.current.push(url);
          await playOne(url);
          setProgress((i + 1) / chunks.length);
        }
        if (!cancelRef.current) {
          setStatus("idle");
          setProgress(0);
          cleanup();
        }
      } catch (e: unknown) {
        const msg = (e as Error)?.message ?? "tts_failed";
        setError(msg);
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, stop, synth],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  return { status, progress, error, speak, pause, resume, stop };
}
