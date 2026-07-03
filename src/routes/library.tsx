import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopBar } from "@/components/top-bar";
import { SourceReader } from "@/components/source-reader";
import { AppFooter } from "@/components/page-shell";
import { useLang } from "@/lib/lang-context";
import { browseLibrary } from "@/lib/library-browse.functions";
import { useSourceSequenceNav } from "@/hooks/use-source-sequence-nav";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Home,
  Library as LibraryIcon,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — חסידותא · Chassiduta" },
      {
        name: "description",
        content:
          "Browse the full Chassidus knowledge base by section: maamarim, sichos, igrot, and more.",
      },
      { property: "og:title", content: "Library — חסידותא · Chassiduta" },
      {
        property: "og:description",
        content:
          "Browse the full Chassidus knowledge base by section: maamarim, sichos, igrot, and more.",
      },
      { property: "og:url", content: "https://chassiduta.lovable.app/library" },
      { name: "twitter:title", content: "Library — חסידותא · Chassiduta" },
      {
        name: "twitter:description",
        content:
          "Browse the full Chassidus knowledge base by section: maamarim, sichos, igrot, and more.",
      },
    ],
    links: [{ rel: "canonical", href: "https://chassiduta.lovable.app/library" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Chassiduta Source Library",
          description:
            "A browsable collection of the Chabad Chassidus corpus, organized by section: Tanya, Maamarim, Sichos, Igrot Kodesh, and more.",
          url: "https://chassiduta.lovable.app/library",
          inLanguage: ["he", "yi", "en"],
          about: { "@type": "Thing", name: "Chabad Chassidus" },
          isPartOf: {
            "@type": "WebSite",
            name: "Chassiduta",
            url: "https://chassiduta.lovable.app",
          },
        }),
      },
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

  const readerNav = useSourceSequenceNav(openId, {
    lang,
    browsePath: path,
    onNavigate: setOpenId,
  });

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main id="main-content" className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-14">
        <header className="mb-8 sm:mb-10 grid lg:grid-cols-[1fr_auto] gap-5 items-end">
          <div>
            <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-3 py-2">
              <LibraryIcon className="h-3.5 w-3.5 text-primary" />
              {lang === "he" ? "עיון במאגר" : "browse corpus"}
            </div>
            <h1 className="text-4xl sm:text-5xl">
              <span className="flow-text">{lang === "he" ? "ספריית לימוד" : "Study library"}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base leading-7 text-muted-foreground">
              {lang === "he"
                ? "מצא ספר, כרך, שיחה או מאמר לפי המבנה הלימודי האמיתי. דפי עזר, שערים ומפתחות מוסתרים כדי שתגיע ישר לטקסט שלומדים."
                : "Find a book, volume, sicha, maamar, or chapter in a learning-first structure. Utility pages, title pages, and indexes are hidden so you land on real study text."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card/45 px-4 py-3 text-sm text-muted-foreground">
            <span className="text-foreground font-medium tabular-nums">
              {data?.total?.toLocaleString() ?? "—"}
            </span>{" "}
            {lang === "he" ? "יחידות לימוד בנתיב" : "study units in this path"}
          </div>
        </header>

        <nav className="flex flex-wrap items-center gap-1 mb-5 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <Chevron className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
              {i < crumbs.length - 1 ? (
                <button
                  onClick={() => setPath(c.path)}
                  className="px-2.5 py-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  {i === 0 && <Home className="h-3.5 w-3.5" />}
                  {c.label}
                </button>
              ) : (
                <span className="px-2.5 py-1.5 text-primary font-medium inline-flex items-center gap-1">
                  {i === 0 && <Home className="h-3.5 w-3.5" />}
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="scholar-card p-4 sm:p-6 relative">
          {(isLoading || isFetching) && (
            <div className="absolute top-4 end-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {!isLoading && data && data.children.length === 0 && data.leaves.length === 0 && (
            <p className="text-sm text-muted-foreground py-12 text-center">
              {lang === "he" ? "אין מקורות בקטגוריה זו עדיין." : "No sources in this section yet."}
            </p>
          )}

          {data && data.children.length > 0 && (
            <section className="mb-7">
              <h2 className="eyebrow mb-3">
                {lang === "he"
                  ? `ספרים / חלקים (${data.children.length})`
                  : `Books / sections (${data.children.length})`}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {data.children.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setPath([...path, c.label])}
                    className="group flex items-center gap-3 p-4 rounded-2xl border border-border/80 bg-background/30 hover:bg-secondary/35 hover:border-primary/40 transition-all text-start"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card/50 text-primary shrink-0">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{c.label}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums mt-0.5">
                        {c.count.toLocaleString()}{" "}
                        {lang === "he" ? "מקורות" : c.count === 1 ? "source" : "sources"}
                      </span>
                    </span>
                    <Chevron className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {data && data.leaves.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">
                {lang === "he"
                  ? `שיחות / מאמרים / פרקים (${data.leaves.length})`
                  : `Sichot / maamarim / chapters (${data.leaves.length})`}
              </h2>
              <ul className="grid gap-2">
                {data.leaves.map((leaf) => (
                  <li key={leaf.id}>
                    <button
                      onClick={() => setOpenId(leaf.id)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/70 bg-background/25 hover:bg-secondary/35 hover:border-primary/35 transition-colors text-start"
                    >
                      <FileText className="h-4 w-4 text-primary/80 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">
                          {leaf.learning_path?.at(-1) ??
                            leaf.title ??
                            (lang === "he" ? "יחידת לימוד ללא כותרת" : "Untitled study unit")}
                        </span>
                        {leaf.learning_path && leaf.learning_path.length > 1 && (
                          <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                            {leaf.learning_path.slice(0, -1).join(" › ")}
                          </span>
                        )}
                        {leaf.char_count != null && (
                          <span className="block text-xs text-muted-foreground tabular-nums mt-0.5">
                            {leaf.char_count.toLocaleString()} {t.charsLabel}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <AppFooter />
      </main>

      <SourceReader sourceId={openId} onClose={() => setOpenId(null)} readerNav={readerNav} />
    </div>
  );
}
