import { useEffect, useState } from "react";

const PIECES = 28;
const COLORS = ["#b4552d", "#7c9a5e", "#d9a441", "#8c3f2f", "#c8b08a", "#5d7c4f"];

/** Lightweight CSS confetti burst. Mount with a changing `burstKey` to replay. */
export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (burstKey <= 0) return;
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 1800);
    return () => window.clearTimeout(timer);
  }, [burstKey]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {Array.from({ length: PIECES }).map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 7) * 60;
        const duration = 1100 + ((i * 53) % 600);
        const size = 6 + (i % 3) * 3;
        const color = COLORS[i % COLORS.length];
        const spin = ((i * 71) % 360) - 180;
        return (
          <span
            key={`${burstKey}-${i}`}
            className="absolute top-0 animate-confetti-fall rounded-[2px]"
            style={{
              insetInlineStart: `${left}%`,
              width: size,
              height: size * 1.6,
              backgroundColor: color,
              animationDelay: `${delay}ms`,
              animationDuration: `${duration}ms`,
              ["--spin" as string]: `${spin}deg`,
            }}
          />
        );
      })}
    </div>
  );
}
