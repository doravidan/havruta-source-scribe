import { useMemo } from "react";
import { Check, HelpCircle } from "lucide-react";
import type { StudyBundle, StudyLang, StudyProgressRow } from "./types";

export function SegmentOutline({
  lang,
  bundle,
  activeIndex,
  onJump,
  userId,
}: {
  lang: StudyLang;
  bundle: StudyBundle;
  activeIndex: number;
  onJump: (index: number) => void;
  userId?: string;
}) {
  const visibleSegments = useMemo(() => {
    if (bundle.segments.length <= 160) return bundle.segments;
    const start = Math.max(0, activeIndex - 60);
    const end = Math.min(bundle.segments.length, activeIndex + 100);
    return bundle.segments.slice(start, end);
  }, [activeIndex, bundle.segments]);

  const progressByIndex = useMemo(() => {
    const map = new Map<number, { mine?: string; partner?: string }>();
    for (const row of (bundle.progress ?? []) as StudyProgressRow[]) {
      const entry = map.get(row.segment_index) ?? {};
      if (row.user_id === userId) entry.mine = row.status;
      else entry.partner = row.status;
      map.set(row.segment_index, entry);
    }
    return map;
  }, [bundle.progress, userId]);

  const understoodTotal = useMemo(
    () =>
      [...progressByIndex.values()].filter((entry) => entry.mine === "understood").length,
    [progressByIndex],
  );

  return (
    <div className="scholar-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">{lang === "he" ? "קטעים" : "Segments"}</div>
        <span className="rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {understoodTotal}/{bundle.segments.length} ✓
        </span>
      </div>
      {visibleSegments.length < bundle.segments.length && (
        <div className="mb-2 rounded-2xl border border-border bg-background/30 p-2 text-xs text-muted-foreground">
          {lang === "he"
            ? "מציגים את הקטעים סביב המיקום הנוכחי כדי לשמור על ביצועים."
            : "Showing segments near your current position for performance."}
        </div>
      )}
      <div className="max-h-[70vh] space-y-2 overflow-auto pe-1">
        {visibleSegments.map((segment) => {
          const entry = progressByIndex.get(segment.index);
          return (
            <button
              key={segment.index}
              onClick={() => onJump(segment.index)}
              className={`block w-full rounded-2xl border p-3 text-start text-sm ${segment.index === activeIndex ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/30 text-muted-foreground"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {lang === "he" ? `קטע ${segment.index + 1}` : `Segment ${segment.index + 1}`}
                </span>
                <span className="flex items-center gap-1">
                  {entry?.mine === "understood" && (
                    <Check className="h-3.5 w-3.5 text-[var(--moss)]" aria-label={lang === "he" ? "הבנתי" : "I understood"} />
                  )}
                  {entry?.mine === "confused" && (
                    <HelpCircle className="h-3.5 w-3.5 text-[var(--saffron)]" aria-label={lang === "he" ? "צריך הסבר" : "I need help"} />
                  )}
                  {entry?.partner === "understood" && (
                    <Check className="h-3.5 w-3.5 text-emerald-600/70" aria-label={lang === "he" ? "החברותא הבין" : "Partner understood"} />
                  )}
                  {entry?.partner === "confused" && (
                    <HelpCircle className="h-3.5 w-3.5 text-emerald-600/70" aria-label={lang === "he" ? "החברותא צריך הסבר" : "Partner needs help"} />
                  )}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-xs">{segment.text}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
