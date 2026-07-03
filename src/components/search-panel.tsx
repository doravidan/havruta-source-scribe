import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchSources } from "@/lib/search.functions";
import { BookOpen, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SourceReader } from "./source-reader";
import { EmptyState } from "./page-shell";
import { useSourceSequenceNav } from "@/hooks/use-source-sequence-nav";

type SearchResult = Awaited<ReturnType<typeof searchSources>>;
type ResultRow = SearchResult["results"][number] & { source_url?: string | null };

export function SearchPanel() {
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSummarize, setOpenSummarize] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const fn = useServerFn(searchSources);
  const m = useMutation({
    mutationFn: (query: string) => fn({ data: { query, lang, limit: 12 } }) as Promise<SearchResult>,
    onSuccess: () => setHasSearched(true),
    onError: (err) =>
      toast.error(err.message || (lang === "he" ? "החיפוש נכשל" : "Search failed")),
  });

  const submit = () => {
    const text = q.trim();
    if (!text || m.isPending) return;
    m.mutate(text);
  };

  const readerNav = useSourceSequenceNav(openId, {
    lang,
    onNavigate: (id) => {
      setOpenSummarize(false);
      setOpenId(id);
    },
  });

  return (
    <section className="w-full" aria-labelledby="search-panel-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="search-panel-title" className="eyebrow flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ruby)]" />
          {t.searchTitle}
        </h2>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          {lang === "he" ? "כותרת · נתיב · תוכן" : "title · path · content"}
        </span>
      </div>

      <div className="scholar-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <label htmlFor="search-query" className="sr-only">
            {t.searchPlaceholder}
          </label>
          <input
            id="search-query"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={t.searchPlaceholder}
            className="h-11 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={m.isPending || !q.trim()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-medium text-primary-foreground disabled:opacity-40"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          {t.searchSubmit}
        </button>
      </div>

      {!hasSearched && !m.isPending && (
        <p className="mt-4 text-sm text-muted-foreground">
          {lang === "he"
            ? "חפש לפי כותרת, נושא, או מילה בתוך הטקסט."
            : "Search by title, topic, or a phrase inside the text."}
        </p>
      )}

      {m.isPending && (
        <div className="mt-5 space-y-3" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className="scholar-card animate-pulse p-5">
              <div className="h-4 w-1/3 rounded bg-secondary" />
              <div className="mt-3 h-4 w-full rounded bg-secondary" />
              <div className="mt-2 h-4 w-2/3 rounded bg-secondary" />
            </div>
          ))}
        </div>
      )}

      {m.data && !m.isPending && (
        <div className="mt-5 space-y-3">
          {m.data.results.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title={t.searchEmpty}
              description={
                lang === "he"
                  ? "נסה מילה קצרה יותר, שם ספר, או נושא אחר."
                  : "Try a shorter term, book name, or different topic."
              }
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {lang === "he"
                  ? `${m.data.results.length} תוצאות`
                  : `${m.data.results.length} result${m.data.results.length === 1 ? "" : "s"}`}
              </p>
              {m.data.results.map((raw) => {
                const r = raw as ResultRow;
                return (
                  <div
                    key={r.id}
                    className="block w-full text-start scholar-card p-4 transition-colors hover:border-primary/40 sm:p-5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSummarize(false);
                        setOpenId(r.id);
                      }}
                      className="block w-full text-start"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/40 text-primary">
                          <BookOpen className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          {r.tree && (
                            <div className="mb-1 truncate text-[11px] text-muted-foreground">{r.tree}</div>
                          )}
                          <div className="mb-1.5 font-medium">{r.title}</div>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{r.excerpt}</p>
                          <div className="mt-2 text-[11px] tabular-nums text-muted-foreground/80">
                            {r.char_count?.toLocaleString()} {t.charsLabel}
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="mt-3 flex items-center gap-2 ps-12 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSummarize(true);
                          setOpenId(r.id);
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
            </>
          )}
        </div>
      )}

      <SourceReader
        sourceId={openId}
        onClose={() => setOpenId(null)}
        autoSummarize={openSummarize}
        readerNav={readerNav}
      />
    </section>
  );
}
