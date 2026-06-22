import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopBar } from "@/components/top-bar";
import { SourceReader } from "@/components/source-reader";
import { useLang } from "@/lib/lang-context";
import { browseLibrary } from "@/lib/library-browse.functions";
import { ChevronLeft, ChevronRight, FolderOpen, FileText, Home, Library as LibraryIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Havruta Chabad" },
      { name: "description", content: "Browse the full Chassidus knowledge base by section: maamarim, sichos, igrot, and more." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { lang, t, dir } = useLang();
  const [path, setPath] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const fn = useServerFn(browseLibrary);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["library-browse", path],
    queryFn: () => fn({ data: { path } }),
  });

  const isRtl = dir === "rtl";
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const crumbs = useMemo(() => {
    const out: { label: string; path: string[] }[] = [
      { label: lang === "he" ? "ראשי" : "Root", path: [] },
    ];
    path.forEach((p, i) => out.push({ label: p, path: path.slice(0, i + 1) }));
    return out;
  }, [path, lang]);

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center gap-2 mb-2">
          <LibraryIcon className="h-5 w-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-semibold gold-text" style={{ fontFamily: "var(--font-display)" }}>
            {lang === "he" ? "ספריית המקורות" : "Source library"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {lang === "he"
            ? "עיין במאגר לפי הקטגוריות המקוריות מ-ChabadLibrary — מאמרים, שיחות, אגרות ועוד."
            : "Browse the database by the original ChabadLibrary sections — maamarim, sichos, igrot, and more."}
        </p>

        <nav className="flex flex-wrap items-center gap-1 mb-5 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <Chevron className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
              {i < crumbs.length - 1 ? (
                <button
                  onClick={() => setPath(c.path)}
                  className="px-2 py-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  {i === 0 && <Home className="h-3.5 w-3.5" />}
                  {c.label}
                </button>
              ) : (
                <span className="px-2 py-1 text-primary font-medium inline-flex items-center gap-1">
                  {i === 0 && <Home className="h-3.5 w-3.5" />}
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="scholar-card p-4 sm:p-6 relative">
          {(isLoading || isFetching) && (
            <div className="absolute top-3 end-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {!isLoading && data && data.children.length === 0 && data.leaves.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {lang === "he" ? "אין מקורות בקטגוריה זו עדיין." : "No sources in this section yet."}
            </p>
          )}

          {data && data.children.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                {lang === "he" ? `קטגוריות (${data.children.length})` : `Sections (${data.children.length})`}
              </h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.children.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setPath([...path, c.label])}
                    className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-background/30 hover:bg-secondary/40 hover:border-primary/40 transition-all text-start"
                  >
                    <FolderOpen className="h-4 w-4 text-primary/80 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.label}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {c.count.toLocaleString()} {lang === "he" ? "מקורות" : c.count === 1 ? "source" : "sources"}
                      </div>
                    </div>
                    <Chevron className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {data && data.leaves.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                {lang === "he" ? `מקורות (${data.leaves.length})` : `Sources (${data.leaves.length})`}
              </h2>
              <ul className="divide-y divide-border/60 border border-border rounded-lg overflow-hidden">
                {data.leaves.map((leaf) => (
                  <li key={leaf.id}>
                    <button
                      onClick={() => setOpenId(leaf.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors text-start"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{leaf.title ?? "—"}</div>
                        {leaf.char_count != null && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {leaf.char_count.toLocaleString()} {t.charsLabel}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            ← {lang === "he" ? "חזרה לדף הבית" : "Back to home"}
          </Link>
        </div>
      </main>

      <SourceReader sourceId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
