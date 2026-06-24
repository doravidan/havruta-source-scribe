import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Hero } from "@/components/hero";
import { AskPanel } from "@/components/ask-panel";
import { SearchPanel } from "@/components/search-panel";
import { YiddishHelper } from "@/components/helpers";

import { DailyStudyPanel } from "@/components/daily-study";
import { useLang } from "@/lib/lang-context";
import { motion } from "framer-motion";

const HOME_TITLE = "חסידותא · Chassiduta — חברותא לחסידות חב״ד";
const HOME_DESC =
  "חסידותא — שאלה אחת שמחזירה אותך אל המקור: קריאה מלאה, קול נקי, סדר יומי וחברותא ללימוד חסידות חב״ד.";
const HOME_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8cf675d8-f93d-4815-a2d4-50bacefc2c97/id-preview-058f936a--ed713669-c7b4-4cdb-be4f-8878effb64ff.lovable.app-1782162151012.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: "https://chassiduta.lovable.app/" },
      { property: "og:image", content: HOME_IMAGE },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
      { name: "twitter:image", content: HOME_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://chassiduta.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "חסידותא · Chassiduta",
              alternateName: "Chassiduta",
              url: "https://chassiduta.lovable.app/",
              inLanguage: ["he", "yi", "en"],
              description: HOME_DESC,
            },
            {
              "@type": "Organization",
              name: "חסידותא · Chassiduta",
              url: "https://chassiduta.lovable.app/",
              description:
                "Digital beit midrash for Chabad Chassidus — sourced Q&A, library, daily study and chavruta matching.",
            },
          ],
        }),
      },
    ],
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
              <motion.div id="ask" custom={0} initial="hidden" animate="show" variants={tile}>
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
              <YiddishHelper />
            </motion.aside>
          </div>

          <footer className="mt-14 text-center text-xs text-muted-foreground">{t.poweredBy}</footer>
        </section>
      </main>
    </div>
  );
}
