import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askHavruta } from "@/lib/ask.functions";
import { BookMarked, Loader2, Send } from "lucide-react";
import { SourceReader } from "./source-reader";

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
  });

  const submit = (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || m.isPending) return;
    setQuestion(text);
    m.mutate(text);
  };

  return (
    <section className="w-full">
      <div className="scholar-card scholar-card-hover p-5 sm:p-7 xl:p-8 border-primary/25">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border/70 pb-5 mb-5">
          <div>
            <h2 className="eyebrow flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sage)]" />
              {t.askTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {lang === "he"
                ? "שאלה אחת, מקורות תחילה. התשובה נשענת על הטקסטים במאגר."
                : "One question, sources first. Answers are grounded in corpus text."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/35 px-3 py-1.5 text-xs text-muted-foreground self-start">
            <BookMarked className="h-3.5 w-3.5 text-primary" />
            {lang === "he" ? "מבוסס מאגר" : "corpus grounded"}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={t.askPlaceholder}
            rows={4}
            className="w-full resize-none bg-transparent text-base sm:text-lg outline-none placeholder:text-muted-foreground/55 leading-relaxed"
          />

          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {t.askExamples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => submit(ex)}
                  className="text-xs sm:text-sm px-3 py-2 min-h-10 rounded-full border border-border/80 bg-card/45 hover:bg-secondary hover:border-primary/35 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
            <button
              onClick={() => submit()}
              disabled={m.isPending || !question.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40 hover:opacity-95 shrink-0"
            >
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {m.isPending ? t.askThinking : t.askSubmit}
            </button>
          </div>
        </div>
      </div>

      {m.isError && (
        <div className="mt-4 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive-foreground">
          {t.askErrorGeneric} {String((m.error as Error)?.message ?? "")}
        </div>
      )}

      {m.data && (
        <article className="mt-6 scholar-card p-5 sm:p-7">
          <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
            {m.data.mode === "weak" && <span className="text-amber-300/90">{t.weakAnswer} · </span>}
            <span>{m.data.latency_ms}ms</span>
          </div>
          <div
            className="whitespace-pre-wrap leading-relaxed text-base sm:text-[17px]"
            style={{ fontFamily: lang === "he" ? "var(--font-serif-he)" : "var(--font-sans)" }}
          >
            {m.data.answer}
          </div>

          {m.data.sources.length > 0 ? (
            <div className="mt-6">
              <h2 className="eyebrow mb-3">{t.sourcesUsed}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {m.data.sources.map((raw) => {
                  const s = raw as SourceCard;
                  return (
                    <div
                      key={s.id}
                      className="text-start rounded-xl border border-border/70 bg-background/30 hover:bg-secondary/30 hover:border-primary/40 p-4 transition-colors flex flex-col"
                    >
                      <button
                        onClick={() => {
                          setOpenSummarize(false);
                          setOpenSourceId(s.id);
                        }}
                        className="text-start flex-1"
                      >
                        {s.tree && <div className="text-[11px] text-muted-foreground mb-1 truncate">{s.tree}</div>}
                        <div className="font-medium mb-2">{s.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-3">{s.excerpt}</div>
                      </button>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <button
                          onClick={() => {
                            setOpenSummarize(true);
                            setOpenSourceId(s.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-primary/35 text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          {t.cardSummary}
                        </button>
                        {s.source_url && (
                          <a
                            href={s.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.cardOpenOriginal}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t.noSources}</p>
          )}
        </article>
      )}

      <SourceReader sourceId={openSourceId} onClose={() => setOpenSourceId(null)} autoSummarize={openSummarize} />
    </section>
  );
}
