import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { corpusStats } from "@/lib/corpus.functions";
import { Languages, ShieldCheck, LogOut, Library, LogIn, Users, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/chassiduta-logo.png";

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
    <header className="sticky top-0 z-40 bg-[color:var(--paper)]/92 backdrop-blur-xl border-b border-[color:var(--rule)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 min-h-16 py-2 flex items-center gap-2 sm:gap-6 flex-wrap">
        <Link
          to="/"
          className="hidden sm:flex items-center gap-3 min-w-0 max-w-[48%] sm:max-w-none group"
        >
          <img
            src={logo}
            alt={`${t.brand} — Chassidus learning platform logo`}
            width={40}
            height={40}
            className="h-9 w-9 rounded-full ring-1 ring-[color:var(--gold)]/30 shadow-[0_10px_28px_-18px_rgba(215,189,120,0.9)] transition-transform group-hover:scale-[1.03]"
          />
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className="text-lg sm:text-xl truncate text-[color:var(--gold-soft)]"
              style={{
                fontFamily: "var(--font-serif-he), var(--font-display)",
                fontWeight: 500,
                letterSpacing: "-0.005em",
              }}
            >
              {t.brand}
            </span>
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-[color:var(--cream-dim)] truncate">
              {t.brandTagline}
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--ink-deep)]" />
            {stats?.ok ? t.statusOnline : t.statusOffline}
          </span>
          {stats && (
            <>
              <span className="text-[color:var(--rule)]">·</span>
              <span>
                {stats.sources} {t.statusSources}
              </span>
              <span>
                {stats.chunks} {t.statusChunks}
              </span>
            </>
          )}
        </div>

        <div className="ms-0 sm:ms-auto flex items-center gap-2 max-w-full overflow-hidden">
          <Link
            to="/library"
            aria-label={lang === "he" ? "ספרייה" : "Library"}
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md border border-border bg-card/60 hover:bg-card text-sm transition-colors"
          >
            <Library className="h-4 w-4" />
            <span className="hidden sm:inline">{lang === "he" ? "ספרייה" : "Library"}</span>
          </Link>
          <Link
            to="/chavruta"
            aria-label={lang === "he" ? "חברותות" : "Chavruta"}
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md border border-border bg-card/60 hover:bg-card text-sm transition-colors"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{lang === "he" ? "חברותות" : "Chavruta"}</span>
          </Link>
          <Link
            to="/beit-midrash"
            aria-label={lang === "he" ? "בית המדרש שלי" : "My Beit Midrash"}
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md border border-border bg-card/60 hover:bg-card text-sm transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden lg:inline">{lang === "he" ? "בית מדרש" : "My room"}</span>
          </Link>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 px-3 h-10 min-w-11 rounded-md border border-border bg-card/60 hover:bg-card text-sm transition-colors"
            aria-label="Toggle language"
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{t.langToggle}</span>
          </button>

          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md border border-primary/40 text-primary hover:bg-primary/10 text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">{t.adminTitle}</span>
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
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">{t.signIn}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
