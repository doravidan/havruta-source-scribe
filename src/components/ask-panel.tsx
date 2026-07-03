import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askHavruta } from "@/lib/ask.functions";
import { BookMarked, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SourceReader } from "./source-reader";
import { EmptyState } from "./page-shell";
import { useSourceSequenceNav, buildDailyReaderNav } from "@/hooks/use-source-sequence-nav";

type AskResult = Awaited<ReturnType<typeof askHavruta>>;
type SourceCard = AskResult["sources"][number] & { source_url?: string | null };

export function AskPanel() {
  const { lang, t } = useLang();
  const [question, setQuestion] = useState("");
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
  const [openSummarize, setOpenSummarize] = useState(false);
  const fn = useServerFn(askHavruta);
  const m = useMutation({
    mutationFn: (q: string) => fn({ data: { question: q, lang } }) as Promise<AskResult>,
    onError: (err) => {
      toast.error(t.askErrorGeneric, {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const submit = (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || m.isPending) return;
    setQuestion(text);
    m.mutate(text);
  };

  const readerNav = useSourceSequenceNav(openSourceId, {
    lang,
    onNavigate: (id) => {
      setOpenSummarize(false);
      setOpenSourceId(id);
    },
  });

  return (
    <section className="w-full" aria-labelledby="ask-panel-title">
      <div className="scholar-card scholar-card-hover border-primary/25 p-5 sm:p-7 xl:p-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="ask-panel-title" className="eyebrow flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sage)]" />
              {t.askTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {lang === "he"
                ? "שאלה אחת, מקורות תחילה. התשובה נשענת על הטקסטים במאגר."
                : "One question, sources first. Answers are grounded in corpus text."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border/80 bg-background/35 px-3 py-1.5 text-xs text-muted-foreground">
            <BookMarked className="h-3.5 w-3.5 text-primary" aria-hidden />
            {lang === "he" ? "מבוסס מאגר" : "corpus grounded"}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5">
          <label htmlFor="ask-question" className="sr-only">
            {t.askPlaceholder}
          </label>
          <textarea
            id="ask-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={t.askPlaceholder}
            rows={4}
            className="w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/55 sm:text-lg"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label={lang === "he" ? "דוגמאות לשאלות" : "Example questions"}>
              {t.askExamples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => submit(ex)}
                  disabled={m.isPending}
                  className="min-h-10 rounded-full border border-border/80 bg-card/45 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/35 hover:bg-secondary hover:text-foreground disabled:opacity-50 sm:text-sm"
                >
                  {ex}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => submit()}
              disabled={m.isPending || !question.trim()}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-medium text-primary-foreground hover:opacity-95 disabled:opacity-40"
            >
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {m.isPending ? t.askThinking : t.askSubmit}
            </button>
          </div>
        </div>
      </div>

      {m.isError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {t.askErrorGeneric}
        </div>
      )}

      {m.isPending && (
        <article className="mt-6 scholar-card p-5 sm:p-7" aria-busy="true" aria-live="polite">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {t.askThinking}
          </div>
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-full rounded bg-secondary" />
            <div className="h-4 w-11/12 rounded bg-secondary" />
            <div className="h-4 w-4/5 rounded bg-secondary" />
          </div>
        </article>
      )}

      {m.data && !m.isPending && (
        <article className="mt-6 scholar-card p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {m.data.mode === "weak" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--saffron)]/50 bg-[var(--saffron-soft)] px-2.5 py-1 text-[var(--oxide-deep)]">
                {t.weakAnswer}
              </span>
            )}
            {m.data.mode === "deterministic" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-2.5 py-1">
                {lang === "he" ? "תשובה מיידית" : "Instant lookup"}
              </span>
            )}
          </div>
          <div
            className="whitespace-pre-wrap text-base leading-relaxed sm:text-[17px]"
            style={{ fontFamily: lang === "he" ? "var(--font-serif-he)" : "var(--font-sans)" }}
          >
            {m.data.answer}
          </div>

          {m.data.sources.length > 0 ? (
            <div className="mt-6">
              <h3 className="eyebrow mb-3">{t.sourcesUsed}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {m.data.sources.map((raw) => {
                  const s = raw as SourceCard;
                  return (
                    <div
                      key={s.id}
                      className="flex flex-col rounded-xl border border-border/70 bg-background/30 p-4 text-start transition-colors hover:border-primary/40 hover:bg-secondary/30"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSummarize(false);
                          setOpenSourceId(s.id);
                        }}
                        className="flex-1 text-start"
                      >
                        {s.tree && (
                          <div className="mb-1 truncate text-[11px] text-muted-foreground">{s.tree}</div>
                        )}
                        <div className="mb-2 font-medium">{s.title}</div>
                        <div className="line-clamp-3 text-sm text-muted-foreground">{s.excerpt}</div>
                      </button>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSummarize(true);
                            setOpenSourceId(s.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/5 px-2.5 py-1.5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          <Sparkles className="h-3 w-3" aria-hidden />
                          {t.cardSummary}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : m.data.mode !== "deterministic" ? (
            <EmptyState
              className="mt-4"
              title={t.noSources}
              description={
                lang === "he"
                  ? "נסה לנסח מחדש או לחפש במאגר לפני שאלה נוספת."
                  : "Try rephrasing or searching the corpus before asking again."
              }
            />
          ) : null}
        </article>
      )}

      <SourceReader
        sourceId={openSourceId}
        onClose={() => setOpenSourceId(null)}
        autoSummarize={openSummarize}
        readerNav={readerNav}
      />
    </section>
  );
}
