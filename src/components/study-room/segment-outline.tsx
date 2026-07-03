import { useMemo } from "react";
import type { StudyBundle, StudyLang } from "./types";

export function SegmentOutline({
  lang,
  bundle,
  activeIndex,
  onJump,
}: {
  lang: StudyLang;
  bundle: StudyBundle;
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  const visibleSegments = useMemo(() => {
    if (bundle.segments.length <= 160) return bundle.segments;
    const start = Math.max(0, activeIndex - 60);
    const end = Math.min(bundle.segments.length, activeIndex + 100);
    return bundle.segments.slice(start, end);
  }, [activeIndex, bundle.segments]);

  return (
    <div className="scholar-card p-4">
      <div className="eyebrow mb-3">{lang === "he" ? "קטעים" : "Segments"}</div>
      {visibleSegments.length < bundle.segments.length && (
        <div className="mb-2 rounded-2xl border border-border bg-background/30 p-2 text-xs text-muted-foreground">
          {lang === "he"
            ? "מציגים את הקטעים סביב המיקום הנוכחי כדי לשמור על ביצועים."
            : "Showing segments near your current position for performance."}
        </div>
      )}
      <div className="max-h-[70vh] space-y-2 overflow-auto pe-1">
        {visibleSegments.map((segment) => (
          <button
            key={segment.index}
            onClick={() => onJump(segment.index)}
            className={`block w-full rounded-2xl border p-3 text-start text-sm ${segment.index === activeIndex ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/30 text-muted-foreground"}`}
          >
            <div className="font-medium">
              {lang === "he" ? `קטע ${segment.index + 1}` : `Segment ${segment.index + 1}`}
            </div>
            <div className="mt-1 line-clamp-2 text-xs">{segment.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
