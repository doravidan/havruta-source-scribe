import { Link } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";

export function SkipToContent() {
  const { lang } = useLang();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
    >
      {lang === "he" ? "דלג לתוכן" : "Skip to content"}
    </a>
  );
}

export function PageLoader({ label }: { label?: string }) {
  const { lang } = useLang();
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{label ?? (lang === "he" ? "טוען…" : "Loading…")}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/25 px-6 py-10 text-center ${className}`}
    >
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-border/70 bg-card/50 text-primary">{icon}</div>}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AppFooter() {
  const { lang, t } = useLang();
  const year = new Date().getFullYear();

  const links = [
    { to: "/" as const, label: lang === "he" ? "בית" : "Home" },
    { to: "/library" as const, label: lang === "he" ? "ספרייה" : "Library" },
    { to: "/beit-midrash" as const, label: lang === "he" ? "בית מדרש" : "My room" },
    { to: "/chavruta" as const, label: lang === "he" ? "חברותות" : "Chavruta" },
  ];

  return (
    <footer className="mt-16 border-t border-border/70 pt-8 pb-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
          <span>{t.brand}</span>
          <span className="text-border">·</span>
          <span>{t.poweredBy}</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm" aria-label={lang === "he" ? "קישורי תחתית" : "Footer links"}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground/80">
        © {year} {t.brand}
      </p>
    </footer>
  );
}
