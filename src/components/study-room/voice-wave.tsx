export function VoiceWave({
  level,
  active,
  label,
  tone = "primary",
}: {
  level: number;
  active: boolean;
  label: string;
  tone?: "primary" | "emerald";
}) {
  const bars = [0.18, 0.45, 0.78, 0.55, 0.95, 0.62, 0.35, 0.7, 0.5, 0.28];
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-background/35 px-3 py-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${active ? (tone === "emerald" ? "bg-emerald-500" : "bg-primary") : "bg-muted-foreground/40"}`}
      />
      <div className="flex h-7 items-center gap-0.5" aria-hidden>
        {bars.map((bar, index) => (
          <span
            key={index}
            className={`w-1 rounded-full transition-all duration-150 ${tone === "emerald" ? "bg-emerald-500/75" : "bg-primary/75"}`}
            style={{
              height: `${Math.max(18, (active ? bar * 42 + level * 36 : bar * 16) + 8)}%`,
              opacity: active ? 0.95 : 0.35,
            }}
          />
        ))}
      </div>
      <span className="max-w-28 truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
