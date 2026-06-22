import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { corpusStats } from "@/lib/corpus.functions";
import { Languages, Sparkles, ShieldCheck, LogOut, BookOpen, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function TopBar() {
  const { lang, t, toggle } = useLang();
  const { session, isAdmin } = useAuth();
  const fn = useServerFn(corpusStats);
  const { data: stats } = useQuery({
    queryKey: ["corpus-stats"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <header className="sticky top-0 z-40 bg-[color:var(--paper)]/85 backdrop-blur-md border-b border-[color:var(--rule)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 h-16 flex items-center gap-3 sm:gap-6 flex-wrap">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <BookOpen className="h-4 w-4 text-[color:var(--ink-deep)]" />
          <span
            className="text-lg sm:text-xl truncate text-[color:var(--ink-deep)]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            {t.brand}
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--ink-deep)]" />
            {stats?.ok ? t.statusOnline : t.statusOffline}
          </span>
          {stats && (
            <>
              <span className="text-[color:var(--rule)]">·</span>
              <span>{stats.sources} {t.statusSources}</span>
              <span>{stats.chunks} {t.statusChunks}</span>
            </>
          )}
        </div>

        <div className="ms-auto flex items-center gap-2">
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md border border-border bg-card/60 hover:bg-card text-sm transition-colors"
          >
            <Library className="h-4 w-4" />
            <span className="hidden sm:inline">{lang === "he" ? "ספרייה" : "Library"}</span>
          </Link>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 px-3 h-10 min-w-11 rounded-md border border-border bg-card/60 hover:bg-card text-sm transition-colors"
            aria-label="Toggle language"
          >
            <Languages className="h-4 w-4" />
            <span>{t.langToggle}</span>
          </button>

          {isAdmin && (
            <Link to="/admin" className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md border border-primary/40 text-primary hover:bg-primary/10 text-sm">
              <ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">{t.adminTitle}</span>
            </Link>
          )}

          {session ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md hover:bg-card text-sm text-muted-foreground"
              aria-label={t.signOut}
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium"
            >
              <Sparkles className="h-4 w-4" />{t.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
