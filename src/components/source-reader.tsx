import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSource } from "@/lib/get-source.functions";
import { isSourceStudied, toggleSourceStudied } from "@/lib/study-progress.functions";
import { summarizeSource } from "@/lib/summarize-source.functions";
import { useAuth } from "@/hooks/use-auth";
import { X, Copy, Check, Minus, Plus, Search, BookCheck, Loader2, ExternalLink, Sparkles } from "lucide-react";

type Props = { sourceId: string | null; onClose: () => void };

export function SourceReader({ sourceId, onClose }: Props) {
  const { lang, t, dir } = useLang();
  const { session } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(getSource);
  const studiedFn = useServerFn(isSourceStudied);
  const toggleFn = useServerFn(toggleSourceStudied);
  const summarizeFn = useServerFn(summarizeSource);
  const open = !!sourceId;
  const { data, isLoading } = useQuery({
    queryKey: ["source", sourceId],
    queryFn: () => fn({ data: { id: sourceId! } }),
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

  const [fontStep, setFontStep] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 1;
    return Number(localStorage.getItem("reader_font") ?? 1);
  });
  const [needle, setNeedle] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const summary = useMutation({
    mutationFn: () => summarizeFn({ data: { id: sourceId!, lang } }),
  });

  useEffect(() => {
    try { localStorage.setItem("reader_font", String(fontStep)); } catch {}
  }, [fontStep]);

  // Reset summary state when switching sources
  useEffect(() => {
    setShowSummary(false);
    summary.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
    const text = data.text ?? "";
    if (!needle.trim()) return { html: escapeHtml(text), matchCount: 0 };
    const re = new RegExp(escapeReg(needle.trim()), "gi");
    let count = 0;
    const out = escapeHtml(text).replace(re, (m) => {
      count++;
      return `<mark class="rounded px-0.5" style="background:oklch(0.80 0.13 80 / 0.35);color:inherit">${m}</mark>`;
    });
    return { html: out, matchCount: count };
  }, [data, needle]);

  if (!open) return null;

  const copyAll = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.text ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
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
          <div className="min-w-0 flex-1">
            {data?.tree && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(data.tree_parts as string[] | null ?? data.tree.split(" > ")).map((p, i, arr) => (
                  <span
                    key={i}
                    className={`text-[11px] px-2 py-1 rounded-full border ${i === arr.length - 1 ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
            <h2 className="text-lg sm:text-2xl font-semibold leading-tight">{data?.title ?? "…"}</h2>
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

        <div className="p-3 sm:p-4 border-b border-border/70 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 me-auto">
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
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
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
            onClick={copyAll}
            className="h-10 px-3 rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5 text-sm"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t.readerCopied : t.readerCopy}
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
              {studiedQuery.data?.studied
                ? lang === "he" ? "נלמד" : "Studied"
                : lang === "he" ? "סמן כנלמד" : "Mark studied"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
