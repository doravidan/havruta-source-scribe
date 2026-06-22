import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchSources } from "@/lib/search.functions";
import { Search, Loader2 } from "lucide-react";
import { SourceReader } from "./source-reader";

type SearchResult = Awaited<ReturnType<typeof searchSources>>;

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
    if (!text) return;
    m.mutate(text);
  };

  return (
    <section className="w-full">
      <h2 className="eyebrow mb-3 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--ruby)]" />
        {t.searchTitle}
      </h2>
      <div className="scholar-card p-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground ms-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t.searchPlaceholder}
          className="flex-1 bg-transparent outline-none text-base h-11"
        />
        <button
          onClick={submit}
          disabled={m.isPending || !q.trim()}
          className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.searchSubmit}
        </button>
      </div>

      {m.data && (
        <div className="mt-5 space-y-3">
          {m.data.results.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">{t.searchEmpty}</p>
          )}
          {m.data.results.map((r: any) => (
            <div
              key={r.id}
              className="block w-full text-start scholar-card p-4 sm:p-5 hover:border-primary/40 transition-colors"
            >
              <button onClick={() => { setOpenSummarize(false); setOpenId(r.id); }} className="block w-full text-start">
                {r.tree && <div className="text-[11px] text-muted-foreground mb-1 truncate">{r.tree}</div>}
                <div className="font-medium mb-1.5">{r.title}</div>
                <p className="text-sm text-muted-foreground line-clamp-2">{r.excerpt}</p>
                <div className="mt-2 text-[11px] text-muted-foreground/80">
                  {r.char_count?.toLocaleString()} {t.charsLabel}
                </div>
              </button>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <button
                  onClick={() => { setOpenSummarize(true); setOpenId(r.id); }}
                  className="px-2 py-1 rounded border border-[var(--saffron)]/50 text-[var(--indigo-deep)] bg-[color:var(--saffron-soft,transparent)] hover:bg-[var(--saffron)] hover:text-white transition-colors"
                >
                  ✦ {t.cardSummary}
                </button>
                {r.source_url && (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded border border-border hover:bg-secondary inline-flex items-center gap-1"
                  >
                    ↗ {t.cardOpenOriginal}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SourceReader sourceId={openId} onClose={() => setOpenId(null)} autoSummarize={openSummarize} />
    </section>
  );
}
