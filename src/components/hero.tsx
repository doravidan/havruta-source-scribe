import { useLang } from "@/lib/lang-context";

export function Hero() {
  const { t, lang } = useLang();
  return (
    <section className="relative">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 pt-14 sm:pt-20 pb-10">
        <div className="text-center">
          <p className="eyebrow mb-5">{lang === "he" ? "בס״ד · חברותא דיגיטלית" : "B\u201DH \u00B7 A Digital Chavruta"}</p>
          <div className="hairline mx-auto w-16 mb-8" />
          <h1
            className="serif text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-[var(--ink-deep)]"
            style={{ fontWeight: 500 }}
          >
            {t.tagline}
          </h1>
          <div className="hairline mx-auto w-16 mt-8 mb-6" />
          <p className="mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-[color:var(--muted-foreground)]">
            {t.heroSubtext}
          </p>
        </div>
      </div>
    </section>
  );
}
