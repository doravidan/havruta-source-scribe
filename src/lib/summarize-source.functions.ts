import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  id: z.string().uuid(),
  lang: z.enum(["he", "en"]).default("he"),
});

const SYS_HE = `אתה מסכם מקורות חסידות חב"ד.
- ענה אך ורק בעברית.
- סכם את המקור שניתן לך ב-4 עד 7 שורות תמציתיות.
- שמור על מושגים מקוריים (תניא, בינוני, דירה בתחתונים וכו') ואל תמציא תוכן שאינו במקור.
- מבנה: נושא ראשי במשפט, עיקרי הרעיון בנקודות קצרות, ושורת מסקנה.`;

const SYS_EN = `You summarize Chabad Chassidus sources.
- Reply ONLY in English.
- Summarize the given source in 4–7 concise lines.
- Keep original terms (Tanya, beinoni, dirah betachtonim) and do not invent content not in the source.
- Structure: one-line topic, the main idea as short points, and a concluding line.`;

export const summarizeSource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    const { getPublicServerClient } = await import("./supabase-public.server");
    const { chatCompletion } = await import("./ai-gateway.server");
    const sb = getPublicServerClient();

    const { data: row, error } = await sb
      .from("sources")
      .select("id, title, tree, text, language")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");

    const text = (row.text ?? "").slice(0, 12000);
    const system = data.lang === "he" ? SYS_HE : SYS_EN;
    const userMsg = data.lang === "he"
      ? `מקור: ${row.title}${row.tree ? " — " + row.tree : ""}\n\nתוכן:\n${text}\n\nסכם לפי ההנחיות.`
      : `Source: ${row.title}${row.tree ? " — " + row.tree : ""}\n\nContent:\n${text}\n\nSummarize per the instructions.`;

    let summary = "";
    try {
      summary = await chatCompletion({
        model: "google/gemini-3-flash-preview",
        system,
        messages: [{ role: "user", content: userMsg }],
        temperature: 0.2,
      });
    } catch (e: any) {
      if (String(e?.message).includes("402")) throw new Error("credits_exhausted");
      if (String(e?.message).includes("429")) throw new Error("rate_limited");
      throw e;
    }

    return { summary, latency_ms: Date.now() - t0 };
  });
