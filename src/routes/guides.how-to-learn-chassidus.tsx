import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { useLang } from "@/lib/lang-context";
import { BookOpen, GraduationCap, Library, Search, Users } from "lucide-react";

export const Route = createFileRoute("/guides/how-to-learn-chassidus")({
  head: () => ({
    meta: [
      { title: "How to Learn Chassidus: A Step-by-Step Guide — Havruta Chabad" },
      { name: "description", content: "A practical, step-by-step guide on how to learn Chassidus. Start with Tanya, progress to Maamarim and Sichos, use the Yiddish helper and source library, and build a sustainable Chassidus learning path." },
      { property: "og:title", content: "How to Learn Chassidus: A Step-by-Step Guide — Havruta Chabad" },
      { property: "og:description", content: "A practical, step-by-step guide on how to learn Chassidus. Start with Tanya, progress to Maamarim and Sichos, use the Yiddish helper and source library, and build a sustainable Chassidus learning path." },
      { property: "og:url", content: "https://havruta-source-scribe.lovable.app/guides/how-to-learn-chassidus" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://havruta-source-scribe.lovable.app/guides/how-to-learn-chassidus" }],
  }),
  component: HowToLearnChassidusPage,
});

const steps = [
  {
    number: "01",
    icon: BookOpen,
    title: "Begin with Tanya — the gateway to Chassidus",
    heTitle: "התחלו בתניא — שער לחסידות",
    body: "The Tanya is the natural first step for anyone learning Chassidus. It defines key concepts — the nefesh, the two souls, the purpose of mitzvot — in systematic language. Read one chapter a day (or follow the daily Tanya cycle), and use the source reader to look up unfamiliar Hebrew or Yiddish terms.",
    heBody: "תניא הוא הצעד הטבעי הראשון לכל לומד חסידות. הוא מגדיר מושגי יסוד — הנפש, שתי הנשמות, מטרת המצוות — בשפה שיטתית. קראו פרק אחד ביום (או עקבו אחרי מחזור התניא היומי), והשתמשו בקורא המקורות כדי לבדוק מונחים בעברית או ביידיש שאינכם מכירים.",
    tip: "If the Hebrew is dense, read with an English translation side-by-side, then return to the original to absorb the terminology.",
    heTip: "אם העברית צפופה, קראו עם תרגום לאנגלית לצד המקור, ואז חזרו למקור כדי לספוג את המונחים.",
  },
  {
    number: "02",
    icon: GraduationCap,
    title: "Add Likkutei Amarim and Igeret HaTeshuvah",
    heTitle: "הוסיפו לקוטי אמרים ואגרת התשובה",
    body: "After the first few chapters of Tanya, move through the rest of Likkutei Amarim and then Igeret HaTeshuvah. These sections introduce the practical transformation of character through Torah and mitzvot — the core 'how-to' of Chassidus life.",
    heBody: "אחרי הפרקים הראשונים של תניא, המשיכו בשאר לקוטי אמרים ולאחר מכן באגרת התשובה. קטעים אלה מציגים את השינוי המעשי באופי באמצעות תורה ומצוות — הליבה של ה\"איך עושים\" בחיי חסידות.",
    tip: "Keep a short notebook: write one idea and one action per day. Chassidus is meant to change behavior, not just knowledge.",
    heTip: "שמרו מחברת קצרה: כתבו רעיון אחד ופעולה אחת ביום. חסידות נועדה לשנות התנהגות, לא רק ידע.",
  },
  {
    number: "03",
    icon: Search,
    title: "Progress to Maamarim (Chassidic discourses)",
    heTitle: "התקדמו למאמרים",
    body: "Maamarim are deeper, more allusive works. Start with well-known Maamarim such as 'V'atah Tetzaveh' or 'Basi Legani' before approaching complex series. Use the search panel to find related Maamarim by topic or phrase, and read them slowly — often one discourse rewards many revisits.",
    heBody: "מאמרים הם יצירות עמוקות ורמוזות יותר. התחילו במאמרים מוכרים כמו 'ואתה תצוה' או 'באתי לגני' לפני שפונים לסדרות מורכבות. השתמשו בלוח החיפוש כדי למצוא מאמרים קשורים לפי נושא או ביטוי, וקראו לאט — לעתים קרובות דרשה אחת משתפרת בכל חזרה.",
    tip: "Read the Maamar aloud. The syntax and phrasing were composed to be heard, not just scanned.",
    heTip: "קראו את המאמר בקול. התחביר והניסוח נכתבו כדי להישמע, לא רק להיקרא.",
  },
  {
    number: "04",
    icon: Library,
    title: "Layer in Sichos and Igrot Kodesh",
    heTitle: "שלבו שיחות ואגרות קודש",
    body: "Sichos apply Chassidus to current events and daily life; Igrot Kodesh show the Rebbe's guidance in real situations. These texts make the earlier study concrete. The library lets you browse by section, so you can follow a theme across sources.",
    heBody: "שיחות מיישמות חסידות על אירועים עכשוויים וחיי יומיום; אגרות קודש מציגות את הדרכת הרבי במצבים אמיתיים. טקסטים אלה הופכים את הלימוד הקודם למוחשי. הספרייה מאפשרת לעיין לפי קטגוריות, כך שאפשר לעקוב אחרי נושא לאורך מקורות שונים.",
    tip: "Pick one Sicha a week and discuss it with a friend or chavruta. Conversation reveals points you miss alone.",
    heTip: "בחרו שיחה אחת בשבוע ודונו בה עם חבר או חברותא. שיחה מגלה נקודות שמפספסים לבד.",
  },
  {
    number: "05",
    icon: Users,
    title: "Find a chavruta and build a steady schedule",
    heTitle: "מצאו חברותא ובנו לוח זמנים קבוע",
    body: "Sustainable Chassidus learning happens in partnership. Use the Chavruta matching tool to find a study partner by availability and level, set a fixed time, and commit to a small, regular amount rather than long, irregular sessions.",
    heBody: "לימוד חסידות מתמשך קורה בשותפות. השתמשו בכלי ההתאמה לחברותא כדי למצוא שותף לימוד לפי זמינות ורמה, קבעו שעה קבועה, והתחייבו לכמות קטנה וקבועה במקום מפגשים ארוכים ובלתי סדירים.",
    tip: "Fifteen focused minutes at the same time each day beats two scattered hours.",
    heTip: "חמש עשרה דקות מרוכזות באותה שעה כל יום עדיפות על שעתיים מפוזרות.",
  },
];

function HowToLearnChassidusPage() {
  const { lang, dir } = useLang();
  const isHe = lang === "he";

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 sm:px-8 py-10 sm:py-14">
        <header className="mb-10 sm:mb-14">
          <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-3 py-2">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            {isHe ? "מדריך למידה" : "Learning guide"}
          </div>
          <h1 className="text-4xl sm:text-5xl gold-text leading-tight">
            {isHe ? "איך ללמוד חסידות — מדריך שלב אחר שלב" : "How to learn Chassidus: a step-by-step guide"}
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-7 text-muted-foreground">
            {isHe
              ? "מסלול מעשי ללימוד חסידות מבית מדרשו של הרבי: מתניא ועד מאמרים, עם כלים לחיפוש מקורות, עזר ליידיש וחברותא קבועה."
              : "A practical path into Chabad Chassidus: from Tanya through Maamarim, with source search, Yiddish help, and a steady chavruta."}
          </p>
        </header>

        <section className="space-y-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                className="scholar-card p-5 sm:p-7 relative overflow-hidden"
              >
                <div className="absolute -top-4 -end-4 text-8xl font-black text-primary/[0.04] select-none pointer-events-none">
                  {step.number}
                </div>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card/50 text-primary shrink-0">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Step {step.number}</p>
                      <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                        {isHe ? step.heTitle : step.title}
                      </h2>
                    </div>
                  </div>
                  <p className="leading-7 text-muted-foreground mb-4">{isHe ? "" : step.body}</p>
                  {!isHe && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                      <span className="font-medium text-primary">Tip:</span>{" "}
                      <span className="text-muted-foreground">{step.tip}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-12 scholar-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold mb-4">
            {isHe ? "כלים באתר שיעזרו לכם" : "Tools on this site to support your learning"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              to="/library"
              className="group flex items-start gap-4 p-4 rounded-2xl border border-border/80 bg-background/30 hover:bg-secondary/35 hover:border-primary/40 transition-all"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card/50 text-primary shrink-0">
                <Library className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-medium group-hover:text-primary transition-colors">Source Library</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse maamarim, sichos, igrot, and more. Each item opens as full text inside the app.
                </p>
              </div>
            </Link>
            <Link
              to="/chavruta"
              className="group flex items-start gap-4 p-4 rounded-2xl border border-border/80 bg-background/30 hover:bg-secondary/35 hover:border-primary/40 transition-all"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card/50 text-primary shrink-0">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-medium group-hover:text-primary transition-colors">Find a Chavruta</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Match with a study partner by weekly availability, level, and preferred topics.
                </p>
              </div>
            </Link>
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/80 bg-background/30 opacity-80">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card/50 text-primary shrink-0">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-medium">Yiddish & Rashi Helpers</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Found in the home sidebar and source reader to decode Yiddish text and Rashi script as you read.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/80 bg-background/30 opacity-80">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card/50 text-primary shrink-0">
                <Search className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-medium">Ask & Search</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask sourced questions and search the corpus by concept or phrase across all texts.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ← {isHe ? "חזרה לדף הבית" : "Back to home"}
          </Link>
        </section>
      </main>
    </div>
  );
}
