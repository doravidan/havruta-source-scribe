import { useLang } from "@/lib/lang-context";

export function Hero() {
  const { t } = useLang();
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-scholar)" }} />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-16 sm:pt-24 pb-10 sm:pb-16 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-4">{t.poweredBy}</p>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight">
          <span className="gold-text">{t.tagline}</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t.heroSubtext}
        </p>
      </div>
    </section>
  );
}
