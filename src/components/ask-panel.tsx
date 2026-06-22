import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askHavruta } from "@/lib/ask.functions";
import { Send, Loader2 } from "lucide-react";
import { SourceReader } from "./source-reader";

type AskResult = Awaited<ReturnType<typeof askHavruta>>;

export function AskPanel() {
  const { lang, t } = useLang();
  const [question, setQuestion] = useState("");
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
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
      <div className="scholar-card scholar-card-hover p-5 sm:p-7 relative overflow-hidden" style={{ boxShadow: "var(--shadow-glow)" }}>
        <div aria-hidden className="absolute -top-16 -right-16 h-48 w-48 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(232,169,58,0.30), transparent 70%)" }} />
        <h2 className="eyebrow mb-3 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--saffron)]" />
          {t.askTitle}
        </h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={t.askPlaceholder}
          rows={3}
          className="w-full resize-none bg-transparent text-base sm:text-lg outline-none placeholder:text-muted-foreground/60 leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {t.askExamples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="text-xs sm:text-sm px-3 py-2 min-h-11 rounded-full border border-border/80 bg-card/50 hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => submit()}
            disabled={m.isPending || !question.trim()}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 hover:opacity-95"
          >
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {m.isPending ? t.askThinking : t.askSubmit}
          </button>
        </div>
      </div>

      {m.isError && (
        <div className="mt-4 p-4 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive-foreground">
          {t.askErrorGeneric} {String((m.error as Error)?.message ?? "")}
        </div>
      )}

      {m.data && (
        <article className="mt-6 scholar-card p-5 sm:p-7">
          <div className="text-xs text-muted-foreground mb-3">
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
              <h3 className="text-xs uppercase tracking-widest text-primary/70 mb-3">
                {t.sourcesUsed}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {m.data.sources.map((s) => (
                  <div
                    key={s.id}
                    className="text-start rounded-lg border border-border/70 bg-card/40 hover:bg-card hover:border-primary/40 p-4 transition-colors flex flex-col"
                  >
                    <button onClick={() => setOpenSourceId(s.id)} className="text-start flex-1">
                      {s.tree && <div className="text-[11px] text-muted-foreground mb-1 truncate">{s.tree}</div>}
                      <div className="font-medium mb-2">{s.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-3">{s.excerpt}</div>
                    </button>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <button
                        onClick={() => setOpenSourceId(s.id)}
                        className="px-2 py-1 rounded border border-[var(--saffron)]/50 text-[var(--indigo-deep)] bg-[color:var(--saffron-soft,transparent)] hover:bg-[var(--saffron)] hover:text-white transition-colors"
                      >
                        ✦ {t.cardSummary}
                      </button>
                      {(s as any).source_url && (
                        <a
                          href={(s as any).source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded border border-border hover:bg-secondary inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗ {t.cardOpenOriginal}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t.noSources}</p>
          )}
        </article>
      )}

      <SourceReader sourceId={openSourceId} onClose={() => setOpenSourceId(null)} />
    </section>
  );
}
