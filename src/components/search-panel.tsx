import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchSources } from "@/lib/search.functions";
import { BookOpen, Loader2, Search } from "lucide-react";
import { SourceReader } from "./source-reader";

type SearchResult = Awaited<ReturnType<typeof searchSources>>;
type ResultRow = SearchResult["results"][number] & { source_url?: string | null };

export function SearchPanel() {
  const { lang, t } = useLang();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSummarize, setOpenSummarize] = useState(false);
  const fn = useServerFn(searchSources);
  const m = useMutation({
    mutationFn: (query: string) => fn({ data: { query, lang, limit: 12 } }) as Promise<SearchResult>,
  });

  const submit = () => {
    const text = q.trim();
    if (!text || m.isPending) return;
    m.mutate(text);
  };

  return (
    <section className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="eyebrow flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ruby)]" />
          {t.searchTitle}
        </h2>
        <span className="hidden sm:inline text-[11px] text-muted-foreground">
          {lang === "he" ? "כותרת · נתיב · תוכן" : "title · path · content"}
        </span>
      </div>

      <div className="scholar-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 rounded-xl border border-border/70 bg-background/35 px-3 h-12">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={t.searchPlaceholder}
            className="flex-1 bg-transparent outline-none text-base h-11"
          />
        </div>
        <button
          onClick={submit}
          disabled={m.isPending || !q.trim()}
          className="px-5 h-12 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t.searchSubmit}
        </button>
      </div>

      {m.data && (
        <div className="mt-5 space-y-3">
          {m.data.results.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 rounded-xl border border-border/70 bg-card/40">
              {t.searchEmpty}
            </p>
          )}
          {m.data.results.map((raw) => {
            const r = raw as ResultRow;
            return (
              <div
                key={r.id}
                className="block w-full text-start scholar-card p-4 sm:p-5 hover:border-primary/40 transition-colors"
              >
                <button
                  onClick={() => {
                    setOpenSummarize(false);
                    setOpenId(r.id);
                  }}
                  className="block w-full text-start"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-background/40 text-primary shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {r.tree && <div className="text-[11px] text-muted-foreground mb-1 truncate">{r.tree}</div>}
                      <div className="font-medium mb-1.5">{r.title}</div>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-6">{r.excerpt}</p>
                      <div className="mt-2 text-[11px] text-muted-foreground/80 tabular-nums">
                        {r.char_count?.toLocaleString()} {t.charsLabel}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-2 text-xs ps-12">
                  <button
                    onClick={() => {
                      setOpenSummarize(true);
                      setOpenId(r.id);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-primary/35 text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {t.cardSummary}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SourceReader sourceId={openId} onClose={() => setOpenId(null)} autoSummarize={openSummarize} />
    </section>
  );
}
