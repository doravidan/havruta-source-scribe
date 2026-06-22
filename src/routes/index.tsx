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
      { name: "description", content: "חסידותא — לימוד, חיפוש ושאלות מבוססות מקור על מקורות חסידות חב״ד." },
      { property: "og:title", content: "חסידותא · Chassiduta — חברותא לחסידות" },
      { property: "og:description", content: "חסידות עם מקורות. לימוד בלי רעש." },
      { property: "og:url", content: "https://chassiduta.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://chassiduta.lovable.app/" }],
  }),
  component: Index,
});

const tile = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: 0.04 * i, ease: "easeOut" as const },
  }),
};

function Index() {
  const { t } = useLang();
  return (
    <div className="min-h-screen">
      <TopBar />
      <main>
        <Hero />

        <section className="mx-auto max-w-7xl px-4 sm:px-8 mt-8 sm:mt-10 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-7 items-start">
            <div className="space-y-6 min-w-0">
              <motion.div custom={0} initial="hidden" animate="show" variants={tile}>
                <AskPanel />
              </motion.div>

              <motion.div custom={1} initial="hidden" animate="show" variants={tile}>
                <SearchPanel />
              </motion.div>

              <motion.div custom={2} initial="hidden" animate="show" variants={tile}>
                <DailyStudyPanel />
              </motion.div>
            </div>

            <motion.aside
              custom={3}
              initial="hidden"
              animate="show"
              variants={tile}
              className="space-y-6 lg:sticky lg:top-24 min-w-0"
            >
              <StudySidebar />
              <YiddishHelper />
            </motion.aside>
          </div>

          <footer className="mt-14 text-center text-xs text-muted-foreground">
            {t.poweredBy}
          </footer>
        </section>
      </main>
    </div>
  );
}
