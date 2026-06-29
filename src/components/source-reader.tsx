import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSource } from "@/lib/get-source.functions";
import { isSourceStudied, toggleSourceStudied } from "@/lib/study-progress.functions";
import { summarizeSource } from "@/lib/summarize-source.functions";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  X,
  Copy,
  Check,
  Minus,
  Plus,
  Search,
  BookCheck,
  Loader2,
  ExternalLink,
  Sparkles,
  Play,
  Pause,
  Square,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { parseSefariaText } from "@/lib/sefaria-text";
import { createAiStudySession } from "@/lib/chavruta-study.functions";

export type DateNav = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  onToday?: () => void;
  todayLabel?: string;
  loading?: boolean;
};

type Props = {
  sourceId: string | null;
  onClose: () => void;
  autoSummarize?: boolean;
  dateNav?: DateNav;
};

export function SourceReader({ sourceId, onClose, autoSummarize, dateNav }: Props) {
  const { lang, t, dir } = useLang();
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getSource);
  const studiedFn = useServerFn(isSourceStudied);
  const toggleFn = useServerFn(toggleSourceStudied);
  const summarizeFn = useServerFn(summarizeSource);
  const createAiStudyFn = useServerFn(createAiStudySession);
  const open = !!sourceId;
  const { data, isLoading } = useQuery({
    queryKey: ["source", sourceId, lang],
    queryFn: () => fn({ data: { id: sourceId!, lang } }),
    enabled: open,
  });

  const studiedQuery = useQuery({
    queryKey: ["studied", sourceId, session?.user?.id],
    queryFn: () => studiedFn({ data: { sourceId: sourceId! } }),
    enabled: open && !!session && !!sourceId,
  });

  const toggleStudied = useMutation({
    mutationFn: () => toggleFn({ data: { sourceId: sourceId! } }),
    onSuccess: (res) => {
      qc.setQueryData(["studied", sourceId, session?.user?.id], res);
      qc.invalidateQueries({ queryKey: ["study-summary"] });
    },
  });

  const openAiStudy = useMutation({
    mutationFn: () => createAiStudyFn({ data: { sourceId: sourceId! } }),
    onSuccess: (room) => {
      onClose();
      navigate({ to: "/study/$sessionId", params: { sessionId: room.id } });
    },
  });

  const [fontStep, setFontStep] = useState<number>(() => {
    if (typeof window === "undefined" || typeof window.localStorage?.getItem !== "function")
      return 1;
    return Number(window.localStorage.getItem("reader_font") ?? 1);
  });
  const [needle, setNeedle] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const summary = useMutation({
    mutationFn: () => summarizeFn({ data: { id: sourceId!, lang } }),
  });

  const read = useReadAloud();

  // Stop audio when switching sources or closing.
  useEffect(() => {
    return () => read.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  useEffect(() => {
    try {
      window.localStorage.setItem("reader_font", String(fontStep));
    } catch {
      // localStorage can be unavailable in private/embedded browsers.
    }
  }, [fontStep]);

  // Reset / auto-trigger summary when switching sources
  useEffect(() => {
    setShowSummary(!!autoSummarize);
    summary.reset();
    if (autoSummarize && sourceId) summary.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, autoSummarize]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const fontSize = [15, 17, 19, 22, 25][Math.max(0, Math.min(4, fontStep))];

  const { html, matchCount } = useMemo(() => {
    if (!data) return { html: "", matchCount: 0 };
    return parseSefariaText(data.text ?? "", { highlight: needle });
  }, [data, needle]);

  if (!open) return null;

  const copyAll = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.text ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      dir={dir}
    >
      <div
        className="relative w-full sm:max-w-3xl bg-card border border-border rounded-none sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[88dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 sm:p-5 border-b border-border/70 flex items-start gap-3">
          {dateNav && (
            <button
              onClick={onClose}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-secondary shrink-0"
              aria-label={lang === "he" ? "חזרה" : "Back"}
              title={lang === "he" ? "חזרה" : "Back"}
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {data?.tree && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {((data.tree_parts as string[] | null) ?? data.tree.split(" > ")).map(
                  (p: string, i: number, arr: string[]) => (
                    <span
                      key={i}
                      className={`text-[11px] px-2 py-1 rounded-full border ${i === arr.length - 1 ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {p}
                    </span>
                  ),
                )}
              </div>
            )}
            <h2 className="text-lg sm:text-2xl font-semibold leading-tight">
              {data?.title ?? "…"}
            </h2>
            {data && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {data.char_count?.toLocaleString()} {t.charsLabel}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-secondary"
            aria-label={t.readerClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {dateNav && (
          <div className="px-4 sm:px-5 py-2 border-b border-border/70 flex items-center justify-between gap-2 bg-secondary/30">
            <button
              type="button"
              onClick={dateNav.onPrev}
              disabled={dateNav.canPrev === false || dateNav.loading}
              className="h-9 px-3 rounded-md border border-border hover:bg-background inline-flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={lang === "he" ? "יום קודם" : "Previous day"}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              <span className="hidden sm:inline">{lang === "he" ? "יום קודם" : "Previous"}</span>
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-sm font-medium truncate inline-flex items-center gap-2">
                {dateNav.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {dateNav.label}
              </div>
              {dateNav.onToday && (
                <button
                  type="button"
                  onClick={dateNav.onToday}
                  disabled={dateNav.loading}
                  className="block mx-auto mt-0.5 text-[11px] text-primary hover:underline disabled:opacity-50"
                >
                  {dateNav.todayLabel ?? (lang === "he" ? "חזרה להיום" : "Jump to today")}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={dateNav.onNext}
              disabled={dateNav.canNext === false || dateNav.loading}
              className="h-9 px-3 rounded-md border border-border hover:bg-background inline-flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={lang === "he" ? "יום הבא" : "Next day"}
            >
              <span className="hidden sm:inline">{lang === "he" ? "יום הבא" : "Next"}</span>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3 sm:p-4">
          <div className="order-2 me-auto flex items-center gap-1 sm:order-none">
            <button
              onClick={() => setFontStep((s) => Math.max(0, s - 1))}
              className="h-10 w-10 rounded-md border border-border hover:bg-secondary inline-flex items-center justify-center"
              aria-label={t.readerSmaller}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFontStep((s) => Math.min(4, s + 1))}
              className="h-10 w-10 rounded-md border border-border hover:bg-secondary inline-flex items-center justify-center"
              aria-label={t.readerLarger}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="order-1 flex w-full flex-none items-center gap-2 sm:order-none sm:min-w-[200px] sm:max-w-md sm:flex-1">
            <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-border bg-background/50 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={needle}
                onChange={(e) => setNeedle(e.target.value)}
                placeholder={t.readerSearchPh}
                className="bg-transparent outline-none flex-1 text-sm"
              />
            </div>
            {needle && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {matchCount === 0 ? t.readerNoMatches : t.readerMatches(matchCount)}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setShowSummary(true);
              if (!summary.data && !summary.isPending) summary.mutate();
            }}
            disabled={summary.isPending || !data}
            className="h-10 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-medium border border-[var(--indigo-deep)]/40 text-[var(--indigo-deep)] bg-[color:var(--indigo-soft,transparent)] hover:bg-[var(--indigo-deep)] hover:text-white transition-colors disabled:opacity-60"
            title={t.readerSummary}
            aria-label={t.readerSummary}
          >
            {summary.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {summary.isPending ? t.readerSummarizing : t.readerSummary}
            </span>
          </button>
          {session && data ? (
            <button
              onClick={() => openAiStudy.mutate()}
              disabled={openAiStudy.isPending || !data}
              className="h-10 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground border border-primary hover:opacity-95 transition-colors disabled:opacity-60"
              title={
                lang === "he" ? "פתח חדר לימוד עם חברותא AI" : "Open a study room with AI chavruta"
              }
              aria-label={lang === "he" ? "פתח חדר לימוד עם חברותא AI" : "Open AI study room"}
            >
              {openAiStudy.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>{lang === "he" ? "לימוד עם AI" : "Study with AI"}</span>
            </button>
          ) : data ? (
            <Link
              to="/auth"
              className="h-10 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground border border-primary hover:opacity-95 transition-colors"
              title={lang === "he" ? "התחבר כדי לפתוח חדר לימוד עם AI" : "Sign in to study with AI"}
            >
              <Sparkles className="h-4 w-4" />
              <span>{lang === "he" ? "לימוד עם AI" : "Study with AI"}</span>
            </Link>
          ) : null}
          {session && data && (
            <Link
              to="/chavruta"
              search={{ source: data.id } as never}
              className="h-10 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-medium border border-primary/35 text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-colors"
              title={lang === "he" ? "מצא חברותא למקור הזה" : "Find a chavruta for this source"}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">
                {lang === "he" ? "חברותא למקור" : "Chavruta"}
              </span>
            </Link>
          )}
          {/* Read aloud */}
          {(() => {
            const playing = read.status === "playing";
            const paused = read.status === "paused";
            const loading = read.status === "loading";
            const active = playing || paused || loading;
            const label =
              lang === "he"
                ? loading
                  ? "טוען…"
                  : playing
                    ? "השהה"
                    : paused
                      ? "המשך"
                      : "הקרא בקול"
                : loading
                  ? "Loading…"
                  : playing
                    ? "Pause"
                    : paused
                      ? "Resume"
                      : "Read aloud";
            const Icon = loading ? Loader2 : playing ? Pause : Play;
            return (
              <div className="inline-flex items-center gap-1">
                <button
                  onClick={() => {
                    if (!data?.text) return;
                    if (playing) return read.pause();
                    if (paused) return read.resume();
                    read.speak(data.text, (data.language as "he" | "en") ?? lang);
                  }}
                  disabled={!data || loading}
                  className={`h-10 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                    active
                      ? "bg-[var(--saffron)] text-white border border-[var(--saffron)] hover:opacity-95"
                      : "border border-[var(--saffron)] text-[var(--indigo-deep)] bg-[color:var(--saffron-soft)] hover:bg-[var(--saffron)] hover:text-white"
                  }`}
                  title={label}
                  aria-label={label}
                >
                  <Icon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{label}</span>
                  {active && read.progress > 0 && (
                    <span className="hidden md:inline text-[11px] opacity-80 tabular-nums">
                      {Math.round(read.progress * 100)}%
                    </span>
                  )}
                </button>
                {active && (
                  <button
                    onClick={() => read.stop()}
                    className="h-10 w-10 rounded-md border border-border hover:bg-secondary inline-flex items-center justify-center"
                    title={lang === "he" ? "עצור" : "Stop"}
                    aria-label={lang === "he" ? "עצור" : "Stop"}
                  >
                    <Square className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })()}
          <button
            onClick={copyAll}
            className="h-10 px-3 rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5 text-sm"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? t.readerCopied : t.readerCopy}</span>
          </button>
          {session && (
            <button
              onClick={() => toggleStudied.mutate()}
              disabled={toggleStudied.isPending || studiedQuery.isLoading}
              className={`h-10 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                studiedQuery.data?.studied
                  ? "bg-[var(--sage)] text-white border border-[var(--sage)] hover:opacity-95"
                  : "border border-[var(--saffron)] text-[var(--indigo-deep)] bg-[color:var(--saffron-soft)] hover:bg-[color:var(--saffron)] hover:text-white"
              } disabled:opacity-60`}
              aria-pressed={!!studiedQuery.data?.studied}
            >
              {toggleStudied.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : studiedQuery.data?.studied ? (
                <Check className="h-4 w-4" />
              ) : (
                <BookCheck className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {studiedQuery.data?.studied
                  ? lang === "he"
                    ? "נלמד"
                    : "Studied"
                  : lang === "he"
                    ? "סמן כנלמד"
                    : "Mark studied"}
              </span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          {showSummary && (
            <div className="mx-auto max-w-[68ch] mb-6 rounded-xl border border-[var(--saffron)]/50 bg-[color:var(--saffron-soft,#fff7e0)] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--indigo-deep)]">
                  <Sparkles className="h-4 w-4" />
                  {t.readerSummaryTitle}
                </div>
                <button
                  onClick={() => setShowSummary(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t.readerHideSummary}
                </button>
              </div>
              {summary.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.readerSummarizing}
                </div>
              ) : summary.isError ? (
                <div className="text-sm text-destructive">{t.readerSummaryError}</div>
              ) : summary.data ? (
                <div
                  className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground"
                  style={{
                    fontFamily:
                      data?.language === "he" ? "var(--font-serif-he)" : "var(--font-sans)",
                  }}
                >
                  {summary.data.summary}
                </div>
              ) : null}
            </div>
          )}
          {isLoading || !data ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-secondary rounded w-3/4" />
              <div className="h-4 bg-secondary rounded w-full" />
              <div className="h-4 bg-secondary rounded w-5/6" />
              <div className="h-4 bg-secondary rounded w-2/3" />
            </div>
          ) : (
            <div
              className="mx-auto max-w-[68ch] whitespace-pre-wrap leading-loose"
              style={{
                fontSize,
                fontFamily: data.language === "he" ? "var(--font-serif-he)" : "var(--font-sans)",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
