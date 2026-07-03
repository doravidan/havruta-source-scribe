import type { ReactNode } from "react";
import { Mic, MicOff } from "lucide-react";
import { VoiceWave } from "./voice-wave";

export function ParticipantTile({
  name,
  role,
  online,
  muted,
  level,
  tone = "primary",
  chip,
}: {
  name: string;
  role: string;
  online: boolean;
  muted?: boolean;
  level?: number;
  tone?: "primary" | "emerald";
  chip?: { icon: ReactNode; text: string; cls: string } | null;
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="rounded-3xl border border-border bg-[rgba(255,250,239,0.72)] p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold text-white shadow-inner ${tone === "emerald" ? "bg-emerald-700" : "bg-primary"}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            {chip && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.cls}`}
              >
                {chip.icon}
                {chip.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            />
            {role}
          </div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background/50">
          {muted ? (
            <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
      </div>
      <VoiceWave
        level={level ?? 0}
        active={online && !muted}
        label={muted ? "muted" : "voice"}
        tone={tone}
      />
    </div>
  );
}
