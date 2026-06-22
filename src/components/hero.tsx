import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";
import mascot from "@/assets/mascot.png";

export function Hero() {
  const { t, lang } = useLang();
  return (
    <section className="relative overflow-hidden">
      {/* soft ornamental backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(700px 360px at 12% 20%, rgba(232,169,58,0.28), transparent 60%), radial-gradient(600px 400px at 88% 10%, rgba(192,57,43,0.14), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-10 sm:pt-16 pb-8 sm:pb-12">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] items-center gap-8 md:gap-12">
          <div className="text-center md:text-start">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="eyebrow mb-4 inline-flex items-center gap-2"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--saffron)] animate-glow-pulse" />
              {lang === "he" ? "בס״ד · חברותא דיגיטלית" : "B\u201DH \u00B7 A Digital Chavruta"}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="serif text-4xl sm:text-5xl md:text-6xl leading-[1.04] gradient-text"
              style={{ fontWeight: 600 }}
            >
              {t.tagline}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-[color:var(--muted-foreground)] mx-auto md:mx-0"
            >
              {t.heroSubtext}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }}
            className="relative mx-auto md:mx-0 w-56 sm:w-72"
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(232,169,58,0.55), transparent 70%)",
              }}
            />
            <img
              src={mascot}
              alt={lang === "he" ? "חברותא — הינשוף הלומד" : "Chavruta — the learning owl"}
              width={576}
              height={576}
              className="w-full h-auto animate-float drop-shadow-[0_18px_30px_rgba(30,42,120,0.25)]"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
