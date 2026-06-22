import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Hero } from "@/components/hero";
import { AskPanel } from "@/components/ask-panel";
import { SearchPanel } from "@/components/search-panel";
import { YiddishHelper } from "@/components/helpers";
import { StudySidebar } from "@/components/study-sidebar";
import { DailyStudyPanel } from "@/components/daily-study";
import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "חסידותא · Chassiduta — חברותא לחסידות" },
      { name: "description", content: "חסידותא — חברותא לחסידות, בכל זמן ובכל מקום. לימוד, חיפוש ושאלות מבוססות מקור על מקורות חסידות חב״ד." },
      { property: "og:title", content: "חסידותא · Chassiduta" },
      { property: "og:description", content: "חברותא לחסידות, בכל זמן ובכל מקום." },
    ],
  }),
  component: Index,
});

const tile = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.05 * i, ease: "easeOut" as const },
  }),
};

function Index() {
  const { t } = useLang();
  return (
    <div className="min-h-screen">
      <TopBar />
      <main>
        <Hero />

        <section className="mx-auto max-w-7xl px-4 sm:px-8 mt-2 sm:mt-4 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 sm:gap-6 items-start">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 auto-rows-min order-2 lg:order-1">
              <motion.div custom={0} initial="hidden" animate="show" variants={tile} className="md:col-span-2">
                <AskPanel />
              </motion.div>

              <motion.div custom={1} initial="hidden" animate="show" variants={tile}>
                <YiddishHelper />
              </motion.div>

              <motion.div custom={2} initial="hidden" animate="show" variants={tile} className="md:col-span-3">
                <DailyStudyPanel />
              </motion.div>

              <motion.div custom={3} initial="hidden" animate="show" variants={tile} className="md:col-span-3">
                <SearchPanel />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="order-1 lg:order-2 lg:sticky lg:top-20"
            >
              <StudySidebar />
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
