import { Link } from "@tanstack/react-router";
import { BookCheck, Flame, MessageCircleQuestion, PartyPopper, Users } from "lucide-react";
import { ConfettiBurst } from "./confetti";
import type { StudyLang } from "./types";

export function SessionCompleteOverlay({
  lang,
  sourceTitle,
  segmentsTotal,
  stats,
  isAiCompanion,
  onKeepReading,
}: {
  lang: StudyLang;
  sourceTitle: string;
  segmentsTotal: number;
  stats: { questions: number; understoodSegments: number } | null;
  isAiCompanion: boolean;
  onKeepReading: () => void;
}) {
  const he = lang === "he";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
        <ConfettiBurst burstKey={1} />
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-3xl gold-text">
          {he ? "סיימתם את הלימוד!" : "You finished the study!"}
        </h2>
        <p className="mt-2 text-muted-foreground">{sourceTitle}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
            <BookCheck className="mx-auto h-5 w-5 text-primary" />
            <div className="mt-1 text-lg font-semibold tabular-nums">{segmentsTotal}</div>
            <div className="text-xs text-muted-foreground">{he ? "קטעים" : "segments"}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
            <MessageCircleQuestion className="mx-auto h-5 w-5 text-primary" />
            <div className="mt-1 text-lg font-semibold tabular-nums">{stats?.questions ?? 0}</div>
            <div className="text-xs text-muted-foreground">{he ? "שאלות" : "questions"}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
            <Flame className="mx-auto h-5 w-5 text-primary" />
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {stats?.understoodSegments ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">{he ? "הובנו" : "understood"}</div>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          {he
            ? "הלימוד נוסף לרצף האישי שלך ושותף בפיד הקהילה."
            : "This study was added to your streak and shared to the community feed."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/community"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            <Users className="h-4 w-4" />
            {he ? "לפיד הקהילה" : "Community feed"}
          </Link>
          <button
            type="button"
            onClick={onKeepReading}
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold"
          >
            {he ? "להמשיך לעיין" : "Keep reading"}
          </button>
          <Link
            to={isAiCompanion ? "/library" : "/chavruta"}
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold"
          >
            {he ? (isAiCompanion ? "לספרייה" : "לחברותות") : isAiCompanion ? "Library" : "Chavrutot"}
          </Link>
        </div>
      </div>
    </div>
  );
}
