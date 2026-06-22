import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { useLang } from "@/lib/lang-context";
import { BookOpen, Calendar, Headphones, Users } from "lucide-react";

export const Route = createFileRoute("/guides/daily-tanya-guide")({
  head: () => ({
    meta: [
      { title: "Daily Tanya Guide — Chitas Study Cycle" },
      { name: "description", content: "A practical guide to the Daily Tanya (Chitas) cycle: structure, schedule, and how to use the source reader and audio to stay consistent." },
      { property: "og:title", content: "Daily Tanya Guide — Chitas Study Cycle" },
      { property: "og:description", content: "A practical guide to the Daily Tanya (Chitas) cycle: structure, schedule, and how to use the source reader and audio to stay consistent." },
      { property: "og:url", content: "https://havruta-source-scribe.lovable.app/guides/daily-tanya-guide" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://havruta-source-scribe.lovable.app/guides/daily-tanya-guide" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Daily Tanya Guide — Chitas Study Cycle",
          description: "A practical guide to the Daily Tanya (Chitas) cycle: structure, schedule, and how to use the source reader and audio to stay consistent.",
          inLanguage: "en",
          about: [
            { "@type": "Thing", name: "Daily Tanya" },
            { "@type": "Thing", name: "Chitas" },
            { "@type": "Thing", name: "Chabad Chassidus" },
          ],
          isPartOf: { "@type": "WebSite", name: "Havruta Chabad", url: "https://havruta-source-scribe.lovable.app" },
        }),
      },
    ],
  }),
  component: DailyTanyaGuidePage,
});

const sections = [
  {
    icon: BookOpen,
    title: "What is the Daily Tanya cycle?",
    body: "The Daily Tanya — part of the broader Chitas cycle (Chumash, Tehillim, Tanya) — is a fixed annual schedule established by the Rebbe Rayatz that walks every Jew through the entire Tanya once a year. Each day has a defined portion, so by year-end you've studied every chapter of Likkutei Amarim, Sha'ar HaYichud VehaEmunah, Iggeret HaTeshuvah, Iggeret HaKodesh, and Kuntres Acharon.",
  },
  {
    icon: Calendar,
    title: "How the schedule is structured",
    body: "The cycle runs from the 19th of Kislev (the Chag HaGeulah of the Alter Rebbe) and is divided so that the daily portion is short and learnable — usually a few paragraphs, sometimes a full chapter. The schedule repeats annually, so missing a day doesn't break the cycle; you simply rejoin on today's portion. Most printed Tanyas and Chabad calendars include the daily division.",
  },
  {
    icon: Headphones,
    title: "Using the source reader and audio",
    body: "Open today's portion in the source library and read with the inline Rashi / Yiddish helpers when a phrase is dense. The read-aloud tool plays the Hebrew aloud — useful for review on a commute, or for hearing the cantillation of a difficult passage. When a concept (bittul, nefesh ha-bahamis, yichuda ila'ah) recurs, click through to other places it appears in the corpus to see how the Alter Rebbe uses it in context.",
  },
  {
    icon: Users,
    title: "Make it stick with a chavruta",
    body: "Five minutes a day with a chavruta beats twenty minutes alone. Use the chavruta matcher to find a partner who keeps the same daily schedule; a short call or chat to review the day's portion turns passive reading into real understanding. If you fall behind, don't catch up — just learn today's portion today.",
  },
];

function DailyTanyaGuidePage() {
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
            Daily Tanya Guide — Chitas Study Cycle
          </h1>
          <p className="mt-5 text-[color:var(--cream-dim)] text-lg leading-relaxed">
            A short, practical orientation to the Daily Tanya cycle: what it is, how the schedule works, and how to
            use this site's tools — source reader, read-aloud, and chavruta matching — to keep up with it.
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
