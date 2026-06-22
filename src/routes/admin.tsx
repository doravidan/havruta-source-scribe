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
import { chabadCoverage } from "@/lib/chabad-coverage.functions";
import { startFullCrawl, retryFailedCrawl, crawlQueueStats } from "@/lib/chabad-crawl-queue.functions";
import { ingestSefariaSlice, listSefariaSlices } from "@/lib/sefaria-ingest.functions";
import { TopBar } from "@/components/top-bar";
import { Loader2, Sprout, Upload, Library, BarChart3, Rocket, BookOpen } from "lucide-react";

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
  const coverageFn = useServerFn(chabadCoverage);
  const startFullFn = useServerFn(startFullCrawl);
  const retryFailedFn = useServerFn(retryFailedCrawl);
  const queueStatsFn = useServerFn(crawlQueueStats);
  const { data: stats } = useQuery({ queryKey: ["corpus-stats"], queryFn: () => statsFn(), refetchInterval: 15000 });
  const { data: queueStats } = useQuery({
    queryKey: ["crawl-queue-stats"],
    queryFn: () => queueStatsFn(),
    refetchInterval: 10000,
  });
  const [coverageDepth, setCoverageDepth] = useState(2);
  const coverageM = useMutation({
    mutationFn: (depth: number) => coverageFn({ data: { depth, maxFetchesPerRoot: 60 } }),
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });
  const startFullM = useMutation({
    mutationFn: () => startFullFn(),
    onSuccess: (r) => {
      setResultMsg(`Full crawl queued: ${r.enqueued} root volumes. Cron will process the queue automatically.`);
      qc.invalidateQueries({ queryKey: ["crawl-queue-stats"] });
    },
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });
  const retryFailedM = useMutation({
    mutationFn: () => retryFailedFn(),
    onSuccess: (r) => {
      setResultMsg(`Reset ${r.retried} failed items to pending.`);
      qc.invalidateQueries({ queryKey: ["crawl-queue-stats"] });
    },
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });

  // ── Sefaria ingest ────────────────────────────────────────────
  const listSlicesFn = useServerFn(listSefariaSlices);
  const ingestSefariaFn = useServerFn(ingestSefariaSlice);
  const { data: slices } = useQuery({ queryKey: ["sefaria-slices"], queryFn: () => listSlicesFn() });
  const [sefariaSlice, setSefariaSlice] = useState<string>("tehillim");
  const [sefariaStart, setSefariaStart] = useState<number>(1);
  const [sefariaMax, setSefariaMax] = useState<number>(20);
  const sefariaM = useMutation({
    mutationFn: () =>
      ingestSefariaFn({
        data: {
          sliceKey: sefariaSlice,
          startChapter: sefariaStart,
          maxChapters: sefariaMax,
          language: "he",
          embed: true,
        },
      }),
    onSuccess: (r) => {
      setResultMsg(
        `Sefaria ${r.slice}: chapters ${r.processedRange[0]}–${r.processedRange[1]} of ${r.totalChapters} · new ${r.savedNew}, updated ${r.savedUpdated}, unchanged ${r.skippedUnchanged}, chunks ${r.chunks}, embedded ${r.embedded}, failures ${r.failures}.${
          r.nextChapter ? ` Next: chapter ${r.nextChapter}.` : " ✓ slice complete."
        }`,
      );
      if (r.nextChapter) setSefariaStart(r.nextChapter);
      qc.invalidateQueries({ queryKey: ["corpus-stats"] });
    },
    onError: (e: any) => setResultMsg("Error: " + (e?.message ?? String(e))),
  });

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

        <div className="scholar-card p-5 mb-6 border-primary/40">
          <h2 className="font-medium mb-2 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            {lang === "he" ? "סריקה מלאה (רקע)" : "Full background crawl"}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {lang === "he"
              ? "מוסיף את כל 8 הכרכים לתור עיבוד ברקע. עבודה אוטומטית כל דקה עד שהתור ריק — הליך זה יכול לקחת שעות/ימים."
              : "Queues all 8 root volumes for background processing. A cron job ticks every minute until the queue is empty — this may take hours or days."}
          </p>
          {queueStats && (() => {
            const pending = queueStats.counts.pending ?? 0;
            const processing = queueStats.counts.processing ?? 0;
            const done = queueStats.counts.done ?? 0;
            const failed = queueStats.counts.failed ?? 0;
            const total = pending + processing + done + failed;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div className="mb-3">
                <div className="flex flex-wrap gap-3 mb-2 text-sm">
                  <span className="px-2 py-1 rounded bg-background/40 border border-border">
                    {lang === "he" ? "ממתינים" : "Pending"}: <b className="tabular-nums">{pending}</b>
                  </span>
                  <span className="px-2 py-1 rounded bg-background/40 border border-border">
                    {lang === "he" ? "בעיבוד" : "Processing"}: <b className="tabular-nums">{processing}</b>
                  </span>
                  <span className="px-2 py-1 rounded bg-background/40 border border-border">
                    {lang === "he" ? "הושלמו" : "Done"}: <b className="tabular-nums">{done}</b>
                  </span>
                  <span className="px-2 py-1 rounded bg-background/40 border border-border">
                    {lang === "he" ? "נכשלו" : "Failed"}: <b className="tabular-nums">{failed}</b>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{lang === "he" ? "התקדמות ייבוא" : "Import progress"}</span>
                  <span className="tabular-nums">{done.toLocaleString()} / {total.toLocaleString()} ({pct}%)</span>
                </div>
                <div
                  className="h-2 w-full rounded-full bg-background/40 border border-border overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {processing > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {lang === "he"
                      ? `${processing.toLocaleString()} פריטים בעיבוד כעת`
                      : `${processing.toLocaleString()} item${processing === 1 ? "" : "s"} processing now`}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => startFullM.mutate()}
              disabled={startFullM.isPending}
              className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center gap-2"
            >
              {startFullM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "he" ? "התחל סריקה מלאה" : "Start full crawl"}
            </button>
            <button
              onClick={() => retryFailedM.mutate()}
              disabled={retryFailedM.isPending || (queueStats?.counts.failed ?? 0) === 0}
              className="px-4 h-11 rounded-md border border-border font-medium disabled:opacity-40 inline-flex items-center gap-2"
            >
              {retryFailedM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "he" ? "נסה כשלים שוב" : "Retry failed"}
            </button>
          </div>
        </div>



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

        <div className="scholar-card p-5 mb-6">
          <h2 className="font-medium mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {lang === "he" ? "כיסוי מאגר הידע" : "Knowledge base coverage"}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {lang === "he"
              ? "אומדן דפים לעומת מה שנקלט והוטמע, לכל שורש. אומדן הדפים מבוסס על סריקת BFS רדודה ב-API."
              : "Estimated pages vs ingested vs embedded, per root. The page estimate uses a shallow BFS of the public API."}
          </p>
          <div className="flex items-center gap-3 mb-3 text-sm">
            <label className="flex items-center gap-2">
              {lang === "he" ? "עומק אומדן:" : "Estimate depth:"}
              <select
                value={coverageDepth}
                onChange={(e) => setCoverageDepth(Number(e.target.value))}
                className="bg-background/40 border border-border rounded-md px-2 h-9"
              >
                <option value={1}>1 ({lang === "he" ? "מקטעים עליונים" : "top sections"})</option>
                <option value={2}>2 ({lang === "he" ? "אומדן עמוק יותר" : "deeper estimate"})</option>
                <option value={3}>3 ({lang === "he" ? "איטי" : "slow"})</option>
              </select>
            </label>
            <button
              onClick={() => coverageM.mutate(coverageDepth)}
              disabled={coverageM.isPending}
              className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center gap-2"
            >
              {coverageM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "he" ? "חשב כיסוי" : "Compute coverage"}
            </button>
          </div>
          {coverageM.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-start py-2 pe-3">{lang === "he" ? "שורש" : "Root"}</th>
                    <th className="text-end py-2 pe-3">{lang === "he" ? "אומדן" : "Est. pages"}</th>
                    <th className="text-end py-2 pe-3">{lang === "he" ? "נקלטו" : "Ingested"}</th>
                    <th className="text-end py-2 pe-3">{lang === "he" ? "כיסוי" : "Coverage"}</th>
                    <th className="text-end py-2 pe-3">{lang === "he" ? "מקטעים" : "Chunks"}</th>
                    <th className="text-end py-2 pe-3">{lang === "he" ? "הוטמעו" : "Embedded"}</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageM.data.rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 pe-3">
                        {lang === "he" ? r.label_he : r.label_en}
                      </td>
                      <td className="text-end py-2 pe-3 tabular-nums">
                        {r.estimatedPages.toLocaleString()}
                        {r.estimateTruncated && <span className="text-muted-foreground">+</span>}
                      </td>
                      <td className="text-end py-2 pe-3 tabular-nums">{r.ingestedSources.toLocaleString()}</td>
                      <td className="text-end py-2 pe-3 tabular-nums">
                        {r.coveragePct != null ? `${r.coveragePct}%` : "—"}
                      </td>
                      <td className="text-end py-2 pe-3 tabular-nums">{r.totalChunks.toLocaleString()}</td>
                      <td className="text-end py-2 pe-3 tabular-nums">
                        {r.embeddedChunks.toLocaleString()}
                        {r.embeddedPct != null && (
                          <span className="text-muted-foreground"> ({r.embeddedPct}%)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">
                {lang === "he"
                  ? "אומדן מסומן ב-+ נקטע על-ידי מגבלת קריאות; הרץ שוב עם עומק גבוה יותר לדיוק."
                  : "Estimates marked with + were truncated by the fetch cap; re-run with a higher depth for accuracy."}
              </p>
            </div>
          )}
        </div>


        <div className="scholar-card p-5 mb-6">
          <h2 className="font-medium mb-2 flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" />
            {lang === "he" ? "סריקת ChabadLibrary" : "Crawl ChabadLibrary"}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {lang === "he"
              ? "סריקת BFS מהשורשים שנבחרו דרך ה-API הציבורי. הרץ שוב כדי להמשיך — דפים שכבר קיימים יידלגו."
              : "Breadth-first crawl from selected roots via the public API. Re-run to continue — already-ingested pages are skipped."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {CHABAD_ROOT_IDS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRoots.includes(r.id)}
                  onChange={() => toggleRoot(r.id)}
                  className="accent-primary"
                />
                <span>
                  {lang === "he" ? r.label_he : r.label_en}
                  <span className="text-xs text-muted-foreground ml-1">({r.id})</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-3 text-sm">
            <label className="flex items-center gap-2">
              {lang === "he" ? "מקס׳ דפים לקריאה:" : "Max pages per run:"}
              <input
                type="number"
                min={1}
                max={120}
                value={maxPages}
                onChange={(e) => setMaxPages(Math.max(1, Math.min(120, Number(e.target.value) || 40)))}
                className="w-20 bg-background/40 border border-border rounded-md px-2 h-9"
              />
            </label>
          </div>
          <button
            onClick={() => crawlM.mutate()}
            disabled={crawlM.isPending || selectedRoots.length === 0}
            className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center gap-2"
          >
            {crawlM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "he" ? "התחל סריקה" : "Start crawl"}
          </button>
        </div>

        <div className="scholar-card p-5 mb-6">
          <h2 className="font-medium mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {lang === "he" ? "ייבוא מ-Sefaria (פלחים)" : "Sefaria slice ingest"}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {lang === "he"
              ? "מושך פרק־אחר־פרק מ-Sefaria לתוך המאגר. הרצה חוזרת ממשיכה מהפרק הבא. עד 50 פרקים לקריאה."
              : "Pulls chapter-by-chapter from Sefaria into the corpus. Re-run to continue from the next chapter. Up to 50 chapters per run."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{lang === "he" ? "מקור" : "Slice"}</span>
              <select
                value={sefariaSlice}
                onChange={(e) => { setSefariaSlice(e.target.value); setSefariaStart(1); }}
                className="bg-background/40 border border-border rounded-md px-2 h-10"
              >
                {(slices ?? []).map((s) => (
                  <option key={s.key} value={s.key}>
                    {lang === "he" ? s.titleHe : s.titleEn} ({s.chapters})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{lang === "he" ? "פרק התחלה" : "Start chapter"}</span>
              <input
                type="number"
                min={1}
                value={sefariaStart}
                onChange={(e) => setSefariaStart(Math.max(1, Number(e.target.value) || 1))}
                className="bg-background/40 border border-border rounded-md px-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{lang === "he" ? "מקס׳ פרקים" : "Max chapters"}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={sefariaMax}
                onChange={(e) => setSefariaMax(Math.max(1, Math.min(50, Number(e.target.value) || 20)))}
                className="bg-background/40 border border-border rounded-md px-2 h-10"
              />
            </label>
          </div>
          <button
            onClick={() => sefariaM.mutate()}
            disabled={sefariaM.isPending}
            className="px-4 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center gap-2"
          >
            {sefariaM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "he" ? "ייבא פלח" : "Ingest slice"}
          </button>
        </div>


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
