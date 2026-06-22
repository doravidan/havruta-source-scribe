import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { useLang } from "@/lib/lang-context";
import { Scroll, Sparkles, PenLine, Heart } from "lucide-react";

export const Route = createFileRoute("/guides/pidyon-nefesh-explained")({
  head: () => ({
    meta: [
      { title: "Pidyon Nefesh (PAN) — Origin, Meaning & How to Write One" },
      { name: "description", content: "What is a Pidyon Nefesh? A guide to the origin, spiritual meaning, and practical 'how-to' of writing a PAN to a Rebbe in Chabad Chassidus." },
      { property: "og:title", content: "Pidyon Nefesh (PAN) — Origin, Meaning & How to Write One" },
      { property: "og:description", content: "What is a Pidyon Nefesh? A guide to the origin, spiritual meaning, and practical 'how-to' of writing a PAN to a Rebbe in Chabad Chassidus." },
      { property: "og:url", content: "https://chassiduta.lovable.app/guides/pidyon-nefesh-explained" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://chassiduta.lovable.app/guides/pidyon-nefesh-explained" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Pidyon Nefesh (PAN) — Origin, Meaning & How to Write One",
          description: "A guide to the origin, spiritual significance, and practical 'how-to' of writing a Pidyon Nefesh (PAN) in Chabad Chassidus.",
          inLanguage: "en",
          about: [
            { "@type": "Thing", name: "Pidyon Nefesh" },
            { "@type": "Thing", name: "PAN" },
            { "@type": "Thing", name: "Chabad Chassidus" },
            { "@type": "Thing", name: "Rebbe" },
          ],
          isPartOf: { "@type": "WebSite", name: "Havruta Chabad", url: "https://chassiduta.lovable.app" },
        }),
      },
    ],
  }),
  component: PidyonNefeshGuidePage,
});

const sections = [
  {
    icon: Scroll,
    title: "What is a Pidyon Nefesh?",
    body: "A Pidyon Nefesh — literally 'redemption of the soul', usually abbreviated PAN (פ״נ) — is a written note given to a Rebbe asking for a blessing or to be mentioned in prayer. The name reflects the customary accompanying donation to tzedakah: the money 'redeems' the soul by binding the request to a tangible act of giving, while the Rebbe acts as a spiritual conduit raising the request before the One Above.",
  },
  {
    icon: Sparkles,
    title: "Origin in Chassidic tradition",
    body: "The practice of writing a kvittel or PAN to a tzaddik traces back to the early Chassidic movement of the Baal Shem Tov and was formalized in Chabad by the Alter Rebbe. The Tzemach Tzedek and later Rebbeim discuss it extensively in their letters: the tzaddik, through his bittul and connection to higher levels of the soul, can elevate a Jew's personal request and draw down a response from a place that an individual on his own may not be able to reach. The PAN became standard practice for major life events — illness, parnasah, shidduchim, children — and for the spiritual milestones of birthdays, yahrzeits, and the Yud-Tes Kislev / Yud Shvat Chassidic festivals.",
  },
  {
    icon: Heart,
    title: "Spiritual significance",
    body: "Chassidus explains the PAN on several levels. The writing itself is an act of hiskashrus — binding oneself to the Rebbe and, through him, to the chain of the Rebbeim back to the Baal Shem Tov and ultimately to Moshe Rabbeinu. The accompanying tzedakah arouses Divine mercy (the verse 'tzedakah tatzil mi-mavet'), and the very act of articulating a need in writing, before a tzaddik, requires the kind of honest accounting that itself begins the redemption being requested. After the Rebbe's histalkus, Chassidim continue the practice by placing a PAN at the Ohel.",
  },
  {
    icon: PenLine,
    title: "How to write a PAN",
    body: "A PAN is short and written by hand when possible. Open with the person's Hebrew name and their mother's name (e.g. Yosef ben Sarah). State the request plainly — for a refuah sheleimah, a shidduch, hatzlacha in parnasah, nachas from children, success in avodas Hashem — without lengthy explanation. If the PAN is for others, list each person by name and mother's name. Close with a request for a blessing. Accompany it with a donation to tzedakah, traditionally to a cause associated with the Rebbe's institutions. Today many Chassidim send a PAN to the Ohel by fax or through Chabad emissaries who deliver it on their behalf.",
  },
  {
    icon: Sparkles,
    title: "When Chassidim write a PAN",
    body: "Customary times include: a birthday (the day's mazel shines), erev Rosh Chodesh and Yud-Aleph Nissan, the Rebbeim's yahrzeits — especially Yud Shvat and Gimmel Tammuz — Yud-Tes Kislev (Chag HaGeulah of the Alter Rebbe) and Yud-Beis/Yud-Gimmel Tammuz, before a wedding or bris, and in times of difficulty. The PAN is not a magical formula — it's an opportunity to pause, take stock, and bring one's personal life into the Rebbe's broader vision for the world.",
  },
];

function PidyonNefeshGuidePage() {
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
            Pidyon Nefesh (PAN) — Origin, Meaning &amp; How to Write One
          </h1>
          <p className="mt-5 text-[color:var(--cream-dim)] text-lg leading-relaxed">
            What a Pidyon Nefesh is, where the practice comes from, what Chassidus says about its inner meaning,
            and a practical guide to writing one yourself.
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
          <Link to="/guides/daily-tanya-guide" className="text-[color:var(--gold)] hover:underline">
            → Daily Tanya guide
          </Link>
          <Link to="/library" className="text-[color:var(--gold)] hover:underline">
            → Browse the source library
          </Link>
        </nav>
      </main>
    </div>
  );
}
