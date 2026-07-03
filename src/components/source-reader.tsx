import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSource } from "@/lib/get-source.functions";
import { isSourceStudied, toggleSourceStudied } from "@/lib/study-progress.functions";
import { summarizeSource } from "@/lib/summarize-source.functions";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthRedirectSearch } from "@/lib/auth-redirect";
import {
  X,
  Copy,
  Check,
  Minus,
  Plus,
  Search,
  BookCheck,
  Loader2,
  Sparkles,
  Play,
  Pause,
  Square,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  MoreHorizontal,
} from "lucide-react";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { parseSefariaText } from "@/lib/sefaria-text";
import { sanitizeSourceText } from "@/lib/sanitize-source-text";
import { createAiStudySession } from "@/lib/chavruta-study.functions";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  const authRedirect = useAuthRedirectSearch();
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
      toast.success(
        res.studied
          ? lang === "he"
            ? "סומן כנלמד"
            : "Marked as studied"
          : lang === "he"
            ? "הוסר מנלמדו"
            : "Removed from studied",
      );
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

  const fontSize = [15, 17, 19, 22, 25][Math.max(0, Math.min(4, fontStep))];

  const cleanText = useMemo(
    () => sanitizeSourceText(data?.text ?? "", data?.language ?? null),
    [data?.text, data?.language],
  );

  const { html, matchCount } = useMemo(() => {
    if (!data) return { html: "", matchCount: 0 };
    return parseSefariaText(cleanText, { highlight: needle });
  }, [data, cleanText, needle]);

  if (!open) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      read.stop();
      onClose();
    }
  };

  const copyAll = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      toast.success(t.readerCopied);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      toast.error(lang === "he" ? "לא הצלחנו להעתיק" : "Could not copy text");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir={dir}
        aria-describedby={undefined}
        className={cn(
          "fixed inset-0 z-50 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 border-0 bg-transparent p-0 shadow-none sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[88dvh] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-0 sm:shadow-2xl",
          "[&>button:last-child]:hidden",
        )}
        onPointerDownOutside={() => handleOpenChange(false)}
      >
        <div className="relative flex w-full flex-col max-h-[100dvh] sm:max-h-[88dvh] overflow-hidden">
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
            <DialogTitle id="source-reader-title" className="text-lg sm:text-2xl font-semibold leading-tight">
              {data?.title ?? "…"}
            </DialogTitle>
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
              type="button"
              onClick={() => setFontStep((s) => Math.max(0, s - 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
              aria-label={t.readerSmaller}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFontStep((s) => Math.min(4, s + 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
              aria-label={t.readerLarger}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="order-1 flex w-full flex-none items-center gap-2 sm:order-none sm:min-w-[200px] sm:max-w-md sm:flex-1">
            <div className="flex h-10 flex-1 items-center gap-2 rounded-md border border-border bg-background/50 px-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                value={needle}
                onChange={(e) => setNeedle(e.target.value)}
                placeholder={t.readerSearchPh}
                aria-label={t.readerSearchPh}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            {needle && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {matchCount === 0 ? t.readerNoMatches : t.readerMatches(matchCount)}
              </span>
            )}
          </div>

          {/* Primary actions — always visible */}
          <div className="hidden items-center gap-2 sm:flex">
            <ReaderToolbarActions
              lang={lang}
              t={t}
              data={data}
              session={session}
              summary={summary}
              read={read}
              cleanText={cleanText}
              copied={copied}
              copyAll={copyAll}
              openAiStudy={openAiStudy}
              toggleStudied={toggleStudied}
              studiedQuery={studiedQuery}
              setShowSummary={setShowSummary}
              authRedirect={authRedirect}
              compact={false}
            />
          </div>

          {/* Mobile overflow menu */}
          <div className="flex items-center gap-2 sm:hidden">
            <ReaderToolbarActions
              lang={lang}
              t={t}
              data={data}
              session={session}
              summary={summary}
              read={read}
              cleanText={cleanText}
              copied={copied}
              copyAll={copyAll}
              openAiStudy={openAiStudy}
              toggleStudied={toggleStudied}
              studiedQuery={studiedQuery}
              setShowSummary={setShowSummary}
              authRedirect={authRedirect}
              compact
              primaryOnly
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
                  aria-label={lang === "he" ? "פעולות נוספות" : "More actions"}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <ReaderToolbarActions
                  lang={lang}
                  t={t}
                  data={data}
                  session={session}
                  summary={summary}
                  read={read}
                  cleanText={cleanText}
                  copied={copied}
                  copyAll={copyAll}
                  openAiStudy={openAiStudy}
                  toggleStudied={toggleStudied}
                  studiedQuery={studiedQuery}
                  setShowSummary={setShowSummary}
                  authRedirect={authRedirect}
                  compact
                  menuItems
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
      </DialogContent>
    </Dialog>
  );
}

type ToolbarProps = {
  lang: "he" | "en";
  t: ReturnType<typeof useLang>["t"];
  data: { id: string; language?: string | null } | undefined;
  session: ReturnType<typeof useAuth>["session"];
  summary: { isPending: boolean; data?: { summary: string } | null; mutate: () => void };
  read: ReturnType<typeof useReadAloud>;
  cleanText: string;
  copied: boolean;
  copyAll: () => void;
  openAiStudy: { isPending: boolean; mutate: () => void };
  toggleStudied: { isPending: boolean; mutate: () => void };
  studiedQuery: { isLoading: boolean; data?: { studied: boolean } | null };
  setShowSummary: (v: boolean) => void;
  authRedirect: { redirect: string };
  compact?: boolean;
  primaryOnly?: boolean;
  menuItems?: boolean;
};

function ReaderToolbarActions(props: ToolbarProps) {
  const {
    lang,
    t,
    data,
    session,
    summary,
    read,
    cleanText,
    copied,
    copyAll,
    openAiStudy,
    toggleStudied,
    studiedQuery,
    setShowSummary,
    authRedirect,
    compact,
    primaryOnly,
    menuItems,
  } = props;

  const playing = read.status === "playing";
  const paused = read.status === "paused";
  const loading = read.status === "loading";
  const active = playing || paused || loading;
  const readLabel =
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
  const ReadIcon = loading ? Loader2 : playing ? Pause : Play;

  const onSummary = () => {
    setShowSummary(true);
    if (!summary.data && !summary.isPending) summary.mutate();
  };

  const onRead = () => {
    if (!cleanText) return;
    if (playing) return read.pause();
    if (paused) return read.resume();
    read.speak(cleanText, (data?.language as "he" | "en") ?? lang);
  };

  if (menuItems) {
    return (
      <>
        <DropdownMenuItem onClick={onSummary} disabled={summary.isPending || !data}>
          {t.readerSummary}
        </DropdownMenuItem>
        {session && data && (
          <DropdownMenuItem onClick={() => openAiStudy.mutate()} disabled={openAiStudy.isPending}>
            {lang === "he" ? "לימוד עם AI" : "Study with AI"}
          </DropdownMenuItem>
        )}
        {session && data && (
          <DropdownMenuItem asChild>
            <Link to="/chavruta" search={{ source: data.id } as never}>
              {lang === "he" ? "חברותא למקור" : "Chavruta for source"}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRead} disabled={!data || loading}>
          {readLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyAll}>{copied ? t.readerCopied : t.readerCopy}</DropdownMenuItem>
        {session && (
          <DropdownMenuItem onClick={() => toggleStudied.mutate()} disabled={toggleStudied.isPending}>
            {studiedQuery.data?.studied
              ? lang === "he"
                ? "נלמד"
                : "Studied"
              : lang === "he"
                ? "סמן כנלמד"
                : "Mark studied"}
          </DropdownMenuItem>
        )}
      </>
    );
  }

  const btnClass = compact
    ? "inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium"
    : "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium";

  const items = [];

  if (!primaryOnly) {
    items.push(
      <button
        key="summary"
        type="button"
        onClick={onSummary}
        disabled={summary.isPending || !data}
        className={`${btnClass} border border-[var(--indigo-deep)]/40 text-[var(--indigo-deep)] bg-[color:var(--indigo-soft,transparent)] hover:bg-[var(--indigo-deep)] hover:text-white disabled:opacity-60`}
        title={t.readerSummary}
        aria-label={t.readerSummary}
      >
        {summary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {!compact && <span>{summary.isPending ? t.readerSummarizing : t.readerSummary}</span>}
      </button>,
    );
  }

  if (session && data) {
    items.push(
      <button
        key="ai"
        type="button"
        onClick={() => openAiStudy.mutate()}
        disabled={openAiStudy.isPending}
        className={`${btnClass} border border-primary bg-primary font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60`}
      >
        {openAiStudy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {!compact && <span>{lang === "he" ? "לימוד עם AI" : "Study with AI"}</span>}
      </button>,
    );
  } else if (data && primaryOnly) {
    items.push(
      <Link
        key="ai-auth"
        to="/auth"
        search={authRedirect}
        className={`${btnClass} border border-primary bg-primary font-semibold text-primary-foreground`}
      >
        <Sparkles className="h-4 w-4" />
      </Link>,
    );
  }

  if (!primaryOnly) {
    if (session && data) {
      items.push(
        <Link
          key="chavruta"
          to="/chavruta"
          search={{ source: data.id } as never}
          className={`${btnClass} border border-primary/35 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground`}
        >
          <Users className="h-4 w-4" />
          {!compact && <span>{lang === "he" ? "חברותא" : "Chavruta"}</span>}
        </Link>,
      );
    }

    items.push(
      <div key="read" className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={onRead}
          disabled={!data || loading}
          className={`${btnClass} ${
            active
              ? "border border-[var(--saffron)] bg-[var(--saffron)] text-white"
              : "border border-[var(--saffron)] bg-[color:var(--saffron-soft)] text-[var(--indigo-deep)] hover:bg-[var(--saffron)] hover:text-white"
          } disabled:opacity-60`}
          title={readLabel}
          aria-label={readLabel}
        >
          <ReadIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {!compact && <span>{readLabel}</span>}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => read.stop()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-secondary"
            aria-label={lang === "he" ? "עצור" : "Stop"}
          >
            <Square className="h-4 w-4" />
          </button>
        )}
      </div>,
      <button
        key="copy"
        type="button"
        onClick={copyAll}
        className={`${btnClass} border border-border hover:bg-secondary`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {!compact && <span>{copied ? t.readerCopied : t.readerCopy}</span>}
      </button>,
    );

    if (session) {
      items.push(
        <button
          key="studied"
          type="button"
          onClick={() => toggleStudied.mutate()}
          disabled={toggleStudied.isPending || studiedQuery.isLoading}
          className={`${btnClass} ${
            studiedQuery.data?.studied
              ? "border border-[var(--sage)] bg-[var(--sage)] text-white"
              : "border border-[var(--saffron)] bg-[color:var(--saffron-soft)] text-[var(--indigo-deep)]"
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
          {!compact && (
            <span>
              {studiedQuery.data?.studied
                ? lang === "he"
                  ? "נלמד"
                  : "Studied"
                : lang === "he"
                  ? "סמן כנלמד"
                  : "Mark studied"}
            </span>
          )}
        </button>,
      );
    }
  }

  return <>{items}</>;
}
