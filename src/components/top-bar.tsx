import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Languages, Library, LogIn, LogOut, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { corpusStats } from "@/lib/corpus.functions";
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
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[rgba(248,242,230,0.86)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:gap-5 sm:px-8">
        <Link to="/" className="group hidden min-w-0 items-center gap-3 sm:flex">
          <img
            src={logo}
            alt={
              lang === "he"
                ? `${t.brand} — לוגו פלטפורמת לימוד חסידות`
                : `${t.brand} — Chassidus learning platform logo`
            }
            width={42}
            height={42}
            className="h-10 w-10 rounded-full border border-border bg-white/50 p-0.5 shadow-sm transition-transform group-hover:scale-[1.03]"
          />
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-xl font-semibold text-[var(--ink)]">
              {t.brand}
            </span>
            <span className="hidden truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:block">
              {lang === "he" ? "מקורות · לימוד · חברותא" : "sources · study · chavruta"}
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-3 rounded-full border border-border/70 bg-white/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:flex">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${stats?.ok ? "bg-[var(--moss)]" : "bg-[var(--oxide)]"}`}
            />
            {stats?.ok ? t.statusOnline : t.statusOffline}
          </span>
          {stats && (
            <>
              <span className="text-border">/</span>
              <span>
                {stats.sources} {t.statusSources}
              </span>
            </>
          )}
        </div>

        <nav className="ms-0 flex max-w-full items-center gap-1.5 overflow-hidden sm:ms-auto">
          <NavLink
            to="/library"
            icon={<Library className="h-4 w-4" />}
            label={lang === "he" ? "ספרייה" : "Library"}
          />
          <NavLink
            to="/chavruta"
            icon={<Users className="h-4 w-4" />}
            label={lang === "he" ? "חברותות" : "Chavruta"}
          />
          <NavLink
            to="/beit-midrash"
            icon={<BookOpen className="h-4 w-4" />}
            label={lang === "he" ? "בית מדרש" : "My room"}
            wide
          />

          <button
            onClick={toggle}
            className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-border/80 bg-white/35 px-3 text-sm transition-colors hover:bg-white/60"
            aria-label={lang === "he" ? "החלפת שפה" : "Toggle language"}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{t.langToggle}</span>
          </button>

          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-primary/35 px-3 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">{t.adminTitle}</span>
            </Link>
          )}

          {session ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-white/45"
              aria-label={t.signOut}
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-95"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">{t.signIn}</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  to,
  icon,
  label,
  wide,
}: {
  to: "/library" | "/chavruta" | "/beit-midrash";
  icon: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border/80 bg-white/35 px-3 text-sm transition-colors hover:bg-white/60"
    >
      {icon}
      <span className={wide ? "hidden lg:inline" : "hidden sm:inline"}>{label}</span>
    </Link>
  );
}
