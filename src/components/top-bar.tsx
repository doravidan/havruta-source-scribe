import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Languages, Library, LogIn, LogOut, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { corpusStats } from "@/lib/corpus.functions";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/chassiduta-logo.png";

const navLinkBase =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-sm transition-colors min-w-10";
const navLinkIdle =
  "border-border/80 bg-white/35 text-foreground hover:bg-white/60";
const navLinkActive =
  "border-primary/45 bg-primary/10 text-primary font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

export function TopBar() {
  const { lang, t, toggle } = useLang();
  const { session, isAdmin } = useAuth();
  const fn = useServerFn(corpusStats);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: stats } = useQuery({
    queryKey: ["corpus-stats"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[rgba(248,242,230,0.92)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(248,242,230,0.86)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:px-8 lg:min-h-16 lg:flex-row lg:flex-wrap lg:items-center lg:gap-5">
        <div className="flex w-full items-center justify-between gap-3 sm:hidden">
          <BrandLink lang={lang} t={t} compact />
          {stats && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/35 px-2.5 py-1 text-[10px] tabular-nums text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${stats.ok ? "bg-[var(--moss)]" : "bg-[var(--oxide)]"}`}
              />
              {stats.sources.toLocaleString()}
            </span>
          )}
        </div>

        <BrandLink lang={lang} t={t} className="hidden sm:flex" />

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
              <span className="tabular-nums">
                {stats.sources.toLocaleString()} {t.statusSources}
              </span>
            </>
          )}
        </div>

        <nav
          className="ms-0 flex w-full max-w-full items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:ms-auto lg:w-auto lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
          aria-label={lang === "he" ? "ניווט ראשי" : "Main navigation"}
        >
          <NavLink
            to="/library"
            icon={<Library className="h-4 w-4" />}
            label={lang === "he" ? "ספרייה" : "Library"}
            active={isActive("/library")}
          />
          <NavLink
            to="/chavruta"
            icon={<Users className="h-4 w-4" />}
            label={lang === "he" ? "חברותות" : "Chavruta"}
            active={isActive("/chavruta")}
          />
          <NavLink
            to="/beit-midrash"
            icon={<BookOpen className="h-4 w-4" />}
            label={lang === "he" ? "בית מדרש" : "My room"}
            wide
            active={isActive("/beit-midrash")}
          />

          <button
            type="button"
            onClick={toggle}
            className={`${navLinkBase} ${navLinkIdle}`}
            aria-label={lang === "he" ? "החלפת שפה" : "Toggle language"}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{t.langToggle}</span>
          </button>

          {isAdmin && (
            <Link
              to="/admin"
              aria-label={t.adminTitle}
              className={`${navLinkBase} ${isActive("/admin") ? navLinkActive : "border-primary/35 text-primary hover:bg-primary/10"}`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">{t.adminTitle}</span>
            </Link>
          )}

          {session ? (
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className={`${navLinkBase} border-transparent text-muted-foreground hover:bg-white/45`}
              aria-label={t.signOut}
              title={t.signOut}
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              className={`${navLinkBase} border-transparent bg-primary px-4 font-semibold text-primary-foreground hover:opacity-95`}
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

function BrandLink({
  lang,
  t,
  compact,
  className = "",
}: {
  lang: "he" | "en";
  t: (typeof import("@/lib/i18n"))["dict"]["he"];
  compact?: boolean;
  className?: string;
}) {
  const alt =
    lang === "he"
      ? `${t.brand} — לוגו פלטפורמת לימוד חסידות`
      : `${t.brand} — Chassidus learning platform logo`;

  return (
    <Link to="/" className={`group flex min-w-0 items-center gap-2 sm:gap-3 ${className}`}>
      <img
        src={logo}
        alt={alt}
        width={compact ? 36 : 42}
        height={compact ? 36 : 42}
        className={`rounded-full border border-border bg-white/50 p-0.5 shadow-sm transition-transform group-hover:scale-[1.03] ${compact ? "h-9 w-9" : "h-10 w-10"}`}
      />
      <div className="min-w-0 leading-tight">
        <span className={`block truncate font-semibold text-[var(--ink)] ${compact ? "text-lg" : "text-xl"}`}>
          {t.brand}
        </span>
        {!compact && (
          <span className="hidden truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:block">
            {lang === "he" ? "מקורות · לימוד · חברותא" : "sources · study · chavruta"}
          </span>
        )}
      </div>
    </Link>
  );
}

function NavLink({
  to,
  icon,
  label,
  wide,
  active,
}: {
  to: "/library" | "/chavruta" | "/beit-midrash";
  icon: React.ReactNode;
  label: string;
  wide?: boolean;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`${navLinkBase} ${active ? navLinkActive : navLinkIdle}`}
    >
      {icon}
      <span className={wide ? "inline sm:hidden lg:inline" : "inline"}>{label}</span>
    </Link>
  );
}
