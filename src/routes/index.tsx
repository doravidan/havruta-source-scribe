import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Hero } from "@/components/hero";
import { AskPanel } from "@/components/ask-panel";
import { SearchPanel } from "@/components/search-panel";
import { YiddishHelper, RashiHelper } from "@/components/helpers";
import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Havruta Chabad — Chassidus with sources" },
      { name: "description", content: "Search, read, and ask AI-grounded questions on Chabad Chassidus sources. Bilingual Hebrew and English." },
      { property: "og:title", content: "Havruta Chabad — Chassidus with sources" },
      { property: "og:description", content: "Bilingual chavruta grounded only in saved Chassidus sources." },
    ],
  }),
  component: Index,
});

const tile = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.05 * i, ease: [0.2, 0.8, 0.2, 1] },
  }),
};

function Index() {
  const { t } = useLang();
  return (
    <div className="min-h-screen">
      <TopBar />
      <main>
        <Hero />

        <section className="mx-auto max-w-6xl px-4 sm:px-8 mt-2 sm:mt-4 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 auto-rows-min">
            {/* Featured: Ask — spans full width on mobile, 2/3 on desktop */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="show"
              variants={tile}
              className="lg:col-span-2"
            >
              <AskPanel />
            </motion.div>

            {/* Yiddish — side tile */}
            <motion.div custom={1} initial="hidden" animate="show" variants={tile}>
              <YiddishHelper />
            </motion.div>

            {/* Search — wide tile */}
            <motion.div custom={2} initial="hidden" animate="show" variants={tile} className="lg:col-span-2">
              <SearchPanel />
            </motion.div>

            {/* Rashi — side tile */}
            <motion.div custom={3} initial="hidden" animate="show" variants={tile}>
              <RashiHelper />
            </motion.div>
          </div>

          <footer className="mt-14 text-center text-xs text-muted-foreground">
            {t.poweredBy}
          </footer>
        </section>
      </main>
    </div>
  );
}
