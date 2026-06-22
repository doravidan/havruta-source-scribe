import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Hero } from "@/components/hero";
import { AskPanel } from "@/components/ask-panel";
import { SearchPanel } from "@/components/search-panel";
import { YiddishHelper, RashiHelper } from "@/components/helpers";
import { useLang } from "@/lib/lang-context";

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

function Index() {
  const { t } = useLang();
  return (
    <div className="min-h-screen">
      <TopBar />
      <main>
        <Hero />
        <AskPanel />
        <SearchPanel />
        <section className="mx-auto max-w-4xl px-4 sm:px-6 mt-12 sm:mt-16 grid sm:grid-cols-2 gap-4">
          <YiddishHelper />
          <RashiHelper />
        </section>
        <footer className="mx-auto max-w-4xl px-4 sm:px-6 mt-16 mb-10 text-center text-xs text-muted-foreground">
          {t.poweredBy}
        </footer>
      </main>
    </div>
  );
}
