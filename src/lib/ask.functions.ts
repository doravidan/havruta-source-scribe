import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  question: z.string().min(2).max(1000),
  lang: z.enum(["he", "en"]).default("he"),
});

const SYS_HE = `אתה חברותא ללימוד חסידות חב"ד.
- ענה אך ורק בעברית.
- השתמש אך ורק במקורות שניתנים לך. אל תמציא ציטוטים.
- אם המקורות חלשים או חסרים, אמור זאת בפירוש.
- מבנה התשובה: תשובה ישירה קצרה (2–3 שורות), ביאור לימודי קצר (3–5 שורות), ציון שמות המקורות, ולסיום שאלת המשך אחת לחברותא.
- אל תשתמש בשפות אחרות (לא סינית, לא ערבית, לא רוסית, לא יוונית, לא יפנית/קוריאנית). ציטוטים מתורה ביידיש/ארמית מותרים בקצרה.
`;
const SYS_EN = `You are a Chabad Chassidus chavruta.
- Reply ONLY in English.
- Use ONLY the provided sources. Do not invent citations.
- If the sources are weak or missing, say so plainly.
- Shape of answer: a short direct answer (2-3 lines), a brief learning explanation (3-5 lines), mention the source titles, end with one chavruta follow-up question.
- Do not output Chinese, Arabic, Cyrillic, Greek, Korean, or Japanese. Brief Hebrew/Yiddish/Aramaic quotes are allowed.
`;

// Reject if output contains characters from blocked scripts
function isUnsupportedScript(s: string): boolean {
  // Cyrillic, Arabic, CJK, Hangul, Greek
  return /[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0370-\u03FF]/.test(s);
}

export const askHavruta = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    const { embed, chatCompletion } = await import("./ai-gateway.server");
    const { getPublicServerClient } = await import("./supabase-public.server");
    const { deterministicHelper } = await import("./helpers-deterministic");
    const sb = getPublicServerClient();

    // Deterministic shortcuts (Yiddish translate / Rashi script) — no AI needed.
    const det = deterministicHelper(data.question, data.lang);
    if (det) {
      return {
        answer: det,
        sources: [],
        mode: "deterministic" as const,
        latency_ms: Date.now() - t0,
        lang: data.lang,
      };
    }

    // 1. Embed the question
    let queryEmbedding: number[] = [];
    try {
      const [vec] = await embed([data.question]);
      queryEmbedding = vec ?? [];
    } catch (e) {
      console.error("embed question failed", e);
    }

    // 2. Vector retrieval
    type Match = { chunk_id: string; source_id: string; chunk_index: number; text: string; similarity: number; title: string; tree: string };
    let matches: Match[] = [];
    if (queryEmbedding.length > 0) {
      const { data: rows, error } = await sb.rpc("match_chunks", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: 8,
        min_similarity: 0.0,
      });
      if (!error) matches = (rows ?? []) as Match[];
    }

    // 3. Keyword fallback if no matches
    if (matches.length === 0) {
      const ql = `%${data.question.replace(/[%_]/g, "\\$&")}%`;
      const { data: rows } = await sb
        .from("source_chunks")
        .select("id, source_id, chunk_index, text, sources(title, tree)")
        .ilike("text", ql)
        .limit(6);
      matches = (rows ?? []).map((r: any) => ({
        chunk_id: r.id,
        source_id: r.source_id,
        chunk_index: r.chunk_index,
        text: r.text,
        similarity: 0,
        title: r.sources?.title ?? "",
        tree: r.sources?.tree ?? "",
      }));
    }

    // 4. De-dup by source_id, keep best 5 sources, 8 chunks max
    const seen = new Set<string>();
    const topChunks = matches.slice(0, 8);
    const sourceList: Array<{ id: string; title: string; tree: string; excerpt: string }> = [];
    for (const m of matches) {
      if (seen.has(m.source_id)) continue;
      seen.add(m.source_id);
      sourceList.push({
        id: m.source_id,
        title: m.title,
        tree: m.tree,
        excerpt: m.text.slice(0, 220) + (m.text.length > 220 ? "…" : ""),
      });
      if (sourceList.length >= 5) break;
    }

    // 5. Build context
    const ctxBlock = topChunks
      .map((m, i) => `[#${i + 1}] ${m.title}${m.tree ? " — " + m.tree : ""}\n${m.text}`)
      .join("\n\n---\n\n");

    const weak = topChunks.length === 0 || (topChunks[0]?.similarity ?? 0) < 0.35;

    const system = data.lang === "he" ? SYS_HE : SYS_EN;
    const userMsg = data.lang === "he"
      ? `שאלה: ${data.question}\n\nמקורות זמינים מהמאגר:\n${ctxBlock || "(לא נמצאו מקורות)"}\n\nענה לפי ההנחיות.`
      : `Question: ${data.question}\n\nAvailable sources from the corpus:\n${ctxBlock || "(no sources retrieved)"}\n\nAnswer per the instructions.`;

    // 6. Call model with retry on unsupported script output
    let answer = "";
    let attempt = 0;
    const model = "google/gemini-3-flash-preview";
    while (attempt < 2) {
      try {
        answer = await chatCompletion({
          model,
          system,
          messages: [{ role: "user", content: userMsg }],
          temperature: 0.3,
        });
      } catch (e: any) {
        if (String(e?.message).includes("402")) throw new Error("credits_exhausted");
        if (String(e?.message).includes("429")) throw new Error("rate_limited");
        throw e;
      }
      if (!isUnsupportedScript(answer)) break;
      attempt++;
    }
    if (isUnsupportedScript(answer)) {
      answer = data.lang === "he"
        ? "לא הצלחתי להפיק תשובה בעברית. נסה שוב בבקשה."
        : "I couldn't produce an English answer. Please try again.";
    }

    // 7. Persist
    try {
      await sb.from("ask_sessions").insert({
        lang: data.lang,
        question: data.question,
        answer,
        source_ids: sourceList.map((s) => s.id),
        mode: weak ? "weak" : "ok",
        latency_ms: Date.now() - t0,
      });
    } catch {}

    return {
      answer,
      sources: sourceList,
      mode: weak ? "weak" : "ok",
      latency_ms: Date.now() - t0,
      lang: data.lang,
    };
  });
