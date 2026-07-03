import { useEffect, useState } from "react";

/** Throttled audio level meter (~15fps) to limit re-renders during calls. */
export function useAudioLevel(stream: MediaStream | null | undefined, active: boolean) {
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
    let lastTick = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastTick < 66) return;
      lastTick = now;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(Math.min(1, avg / 90));
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => undefined);
    };
  }, [active, stream]);

  return level;
}
