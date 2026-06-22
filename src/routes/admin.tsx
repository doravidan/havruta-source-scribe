import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ingestSources, seedCorpus } from "@/lib/ingest.functions";
import { crawlChabadLibrary } from "@/lib/chabad-ingest.functions";
import { CHABAD_ROOT_IDS } from "@/lib/chabad-clean";
import { corpusStats } from "@/lib/corpus.functions";
import { TopBar } from "@/components/top-bar";
import { Loader2, Sprout, Upload, Library } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Havruta Chabad" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { t, lang } = useLang();
  const { session, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [json, setJson] = useState("");
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [selectedRoots, setSelectedRoots] = useState<string[]>([CHABAD_ROOT_IDS[0].id]);
  const [maxPages, setMaxPages] = useState(40);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth" });
  }, [loading, session, nav]);

  const ingestFn = useServerFn(ingestSources);
  const seedFn = useServerFn(seedCorpus);
  const crawlFn = useServerFn(crawlChabadLibrary);
  const statsFn = useServerFn(corpusStats);
  const { data: stats } = useQuery({ queryKey: ["corpus-stats"], queryFn: () => statsFn() });

  const parsed = useMemo(() => {
    if (!json.trim()) return null;
    try {
      const v = JSON.parse(json);
      const arr = Array.isArray(v) ? v : [v];
      return arr;
    } catch { return null; }
  }, [json]);

  const ingestM = useMutation({
    mutationFn: (rows: any[]) => ingestFn({ data: { sources: rows, embed: true } }),
    onSuccess: (r) => {
      setResultMsg(t.adminDone(r.inserted, r.updated, r.chunks));
      setJson("");
      qc.invalidateQueries({ queryKey: ["corpus-stats"] });
    },
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });

  const seedM = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (r) => {
      setResultMsg(t.adminDone(r.inserted, r.updated, r.chunks));
      qc.invalidateQueries({ queryKey: ["corpus-stats"] });
    },
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });

  const crawlM = useMutation({
    mutationFn: () =>
      crawlFn({ data: { rootIds: selectedRoots, maxPages, embed: true, language: "he" } }),
    onSuccess: (r) => {
      setResultMsg(
        `Crawl: visited ${r.visited}, text pages ${r.textPages}, new ${r.savedNew}, updated ${r.savedUpdated}, unchanged ${r.skippedUnchanged}, chunks ${r.chunks}, embedded ${r.embedded}, fetch failures ${r.fetchFailures}, queue remaining ${r.queueRemaining}.`,
      );
      qc.invalidateQueries({ queryKey: ["corpus-stats"] });
    },
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });

  const toggleRoot = (id: string) =>
    setSelectedRoots((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;

  if (!isAdmin) {
    return (
      <div>
        <TopBar />
        <div className="max-w-md mx-auto mt-20 px-4 text-center">
          <h1 className="text-xl font-semibold">{t.adminOnly}</h1>
          <Link to="/" className="mt-4 inline-block text-primary underline">← {lang === "he" ? "חזרה" : "Home"}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold gold-text mb-2">{t.adminTitle}</h1>
        {stats && (
          <p className="text-sm text-muted-foreground mb-6">
            {stats.sources} {t.statusSources} · {stats.chunks} {t.statusChunks} · {stats.chars.toLocaleString()} {t.statusChars}
          </p>
        )}

        <div className="scholar-card p-5 mb-6">
          <h2 className="font-medium mb-2 flex items-center gap-2"><Sprout className="h-4 w-4 text-primary" />{t.adminSeed}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            {lang === "he" ? "טוען ~10 קטעי תניא לדוגמה (אורך מלא, עברית) למאגר." : "Loads ~10 sample Tanya excerpts (full text, Hebrew) into the corpus."}
          </p>
          <button
            onClick={() => seedM.mutate()}
            disabled={seedM.isPending}
            className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center gap-2"
          >
            {seedM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.adminSeed}
          </button>
        </div>

        <div className="scholar-card p-5">
          <h2 className="font-medium mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />{t.adminIngest}</h2>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={t.adminPasteJson}
            rows={12}
            className="w-full bg-background/40 border border-border rounded-md p-3 font-mono text-xs outline-none"
          />
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              {parsed ? t.adminWillInsert(parsed.length) : (json.trim() ? "Invalid JSON" : "")}
            </p>
            <button
              onClick={() => parsed && ingestM.mutate(parsed)}
              disabled={!parsed || ingestM.isPending}
              className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center gap-2"
            >
              {ingestM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.adminIngest}
            </button>
          </div>
        </div>

        {resultMsg && (
          <div className="mt-5 p-4 rounded-md border border-primary/40 bg-primary/5 text-sm">{resultMsg}</div>
        )}
      </main>
    </div>
  );
}
