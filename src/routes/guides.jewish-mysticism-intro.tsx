import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { useLang } from "@/lib/lang-context";
import { BookOpen, Sparkles, Compass, Library } from "lucide-react";

export const Route = createFileRoute("/guides/jewish-mysticism-intro")({
  head: () => ({
    meta: [
      { title: "Jewish Mysticism: An Introduction through Chassidus" },
      { name: "description", content: "A beginner's introduction to Jewish mysticism and Kabbalah, and how Chabad Chassidus makes these ideas learnable and applicable to daily life." },
      { property: "og:title", content: "Jewish Mysticism: An Introduction through Chassidus" },
      { property: "og:description", content: "A beginner's introduction to Jewish mysticism and Kabbalah, and how Chabad Chassidus makes these ideas learnable and applicable to daily life." },
      { property: "og:url", content: "https://havruta-source-scribe.lovable.app/guides/jewish-mysticism-intro" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://havruta-source-scribe.lovable.app/guides/jewish-mysticism-intro" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Jewish Mysticism: An Introduction through Chassidus",
          description: "A beginner's introduction to Jewish mysticism and Kabbalah, and how Chabad Chassidus makes these ideas learnable and applicable to daily life.",
          inLanguage: "en",
          about: [
            { "@type": "Thing", name: "Jewish mysticism" },
            { "@type": "Thing", name: "Kabbalah" },
            { "@type": "Thing", name: "Chabad Chassidus" },
          ],
          isPartOf: { "@type": "WebSite", name: "Havruta Chabad", url: "https://havruta-source-scribe.lovable.app" },
        }),
      },
    ],
  }),
  component: JewishMysticismIntroPage,
});

const sections = [
  {
    icon: Sparkles,
    title: "What is Jewish mysticism?",
    body: "Jewish mysticism is the inner dimension of Torah — the tradition that asks not only what the text says, but what reality it describes. Its classical literature includes the Zohar, the writings of the Arizal, and the broader corpus called Kabbalah. These texts map the structure of the soul, the unfolding of creation through the sefirot, and the hidden purpose behind mitzvot.",
  },
  {
    icon: Compass,
    title: "Kabbalah vs Chassidus — what's the difference?",
    body: "Classical Kabbalah focuses on the structure of the spiritual worlds and divine names. It is dense, often technical, and historically reserved for advanced students. Chassidus — and Chabad Chassidus in particular — takes that same map and makes it learnable: it translates Kabbalah's symbols into the language of the soul, of intellect (Chabad: Chochmah, Binah, Da'at), and of daily emotional life. Where Kabbalah describes the worlds above, Chassidus shows how to live them below.",
  },
  {
    icon: BookOpen,
    title: "How Chabad Chassidus teaches mysticism",
    body: "Chabad teaches that mystical concepts are not meant to remain abstract. The Tanya, the foundational Chassidic work of Rabbi Schneur Zalman of Liadi, opens with the structure of the two souls — the animal soul and the G-dly soul — and uses that framework to explain everyday struggles: focus in prayer, response to temptation, the work of refining character. Each idea from Kabbalah becomes a practical instruction.",
  },
  {
    icon: Library,
    title: "Where to start reading",
    body: "Begin with Tanya, chapter by chapter. Pair it with introductory Maamarim such as 'Basi Legani' or 'V'atah Tetzaveh'. When a term feels abstract (sefirot, atzilut, bittul), look it up in the source library and read the surrounding paragraph — Chassidus repeats its key terms in many contexts, and seeing them used clarifies the meaning. A weekly chavruta makes the study durable.",
  },
];

function JewishMysticismIntroPage() {
  const { dir } = useLang();
  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 sm:px-8 py-12 sm:py-20">
        <header className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[color:var(--cream-dim)] mb-3">Guide</p>
          <h1
            className="text-3xl sm:text-5xl leading-tight text-[color:var(--gold-soft)]"
            style={{ fontFamily: "var(--font-serif-he), var(--font-display)", fontWeight: 500 }}
          >
            Jewish Mysticism: An Introduction through Chassidus
          </h1>
          <p className="mt-5 text-[color:var(--cream-dim)] text-lg leading-relaxed">
            Jewish mysticism — Kabbalah — describes the inner structure of creation and the soul. Chabad Chassidus
            takes that tradition and makes it learnable, so the ideas reshape how you think, pray, and act. This is a
            beginner's orientation, with concrete next steps.
          </p>
        </header>

        <div className="space-y-8">
          {sections.map(({ icon: Icon, title, body }) => (
            <section key={title} className="border-t border-[color:var(--rule)] pt-8">
              <div className="flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-[color:var(--gold)]" />
                <h2 className="text-xl sm:text-2xl text-[color:var(--gold-soft)]" style={{ fontFamily: "var(--font-serif-he), var(--font-display)", fontWeight: 500 }}>
                  {title}
                </h2>
              </div>
              <p className="text-[color:var(--cream-dim)] leading-relaxed">{body}</p>
            </section>
          ))}
        </div>

        <nav className="mt-14 border-t border-[color:var(--rule)] pt-8 flex flex-wrap gap-4 text-sm">
          <Link to="/guides/how-to-learn-chassidus" className="text-[color:var(--gold)] hover:underline">
            → How to learn Chassidus: step-by-step
          </Link>
          <Link to="/library" className="text-[color:var(--gold)] hover:underline">
            → Browse the source library
          </Link>
          <Link to="/chavruta" className="text-[color:var(--gold)] hover:underline">
            → Find a chavruta
          </Link>
        </nav>
      </main>
    </div>
  );
}
