/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { segmentSourceText } from "./source-segments";

const Uuid = z.string().uuid();
const CreateInput = z.object({ matchId: Uuid, sourceId: Uuid });
const CreateAiInput = z.object({ sourceId: Uuid });
const SessionInput = z.object({
  sessionId: Uuid,
  lang: z.enum(["he", "en"]).default("he"),
});
const StatusInput = z.object({
  sessionId: Uuid,
  segmentIndex: z.number().int().min(0),
  status: z.enum(["reading", "confused", "understood", "answered"]),
  note: z.string().max(600).optional(),
});
const AdvanceInput = z.object({ sessionId: Uuid, segmentIndex: z.number().int().min(0) });
const GenerateInput = z.object({
  sessionId: Uuid,
  segmentIndex: z.number().int().min(0),
  lang: z.enum(["he", "en"]).default("he"),
});
// Mirrors the DB CHECK constraint chavruta_study_questions_question_check:
//   char_length(question) BETWEEN 3 AND 1200
const QUESTION_MIN = 3;
const QUESTION_MAX = 1200;

function sanitizeQuestionText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Normalize whitespace and strip control chars that would slip past length checks.
  const cleaned = [...raw]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < QUESTION_MIN) return null;
  return cleaned.slice(0, QUESTION_MAX);
}

const QuestionText = z
  .string()
  .transform((v) => sanitizeQuestionText(v) ?? "")
  .refine((v) => v.length >= QUESTION_MIN && v.length <= QUESTION_MAX, {
    message: `question must be ${QUESTION_MIN}-${QUESTION_MAX} characters`,
  });

const AskInput = z.object({
  sessionId: Uuid,
  segmentIndex: z.number().int().min(0),
  question: QuestionText,
  lang: z.enum(["he", "en"]).default("he"),
  includeSpeech: z.boolean().optional().default(false),
});

type AnySb = any;

async function loadSessionBundle(sb: AnySb, sessionId: string, lang: "he" | "en" = "he") {
  const { data: session, error: sessionError } = await sb
    .from("chavruta_study_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("study_session_not_found");

  const sourcePromise = sb
    .from("sources")
    .select("id, title, tree, tree_parts, language, text, excerpt, char_count, updated_at")
    .eq("id", session.source_id)
    .maybeSingle();
  const matchPromise = session.match_id
    ? sb.from("chavruta_matches").select("*").eq("id", session.match_id).maybeSingle()
    : Promise.resolve({ data: null });
  const messagesPromise = session.match_id
    ? sb
        .from("chavruta_messages")
        .select("*")
        .eq("match_id", session.match_id)
        .order("created_at", { ascending: true })
    : Promise.resolve({ data: [] });

  const [
    { data: source, error: sourceError },
    { data: match },
    { data: progress },
    { data: questions },
    { data: messages },
  ] = await Promise.all([
    sourcePromise,
    matchPromise,
    sb
      .from("chavruta_study_progress")
      .select("*")
      .eq("session_id", sessionId)
      .order("updated_at", { ascending: false }),
    sb
      .from("chavruta_study_questions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    messagesPromise,
  ]);

  if (sourceError) throw new Error(sourceError.message);
  if (!source) throw new Error("source_not_found");

  const { localizeSourceForStudy } = await import("./localize-source.server");
  const localizedSource = await localizeSourceForStudy(source, lang);
  const { sanitizeSourceText } = await import("./sanitize-source-text");
  const cleanedText = sanitizeSourceText(localizedSource.text ?? "", localizedSource.language ?? lang);
  const cleanedSource = { ...localizedSource, text: cleanedText };

  return {
    session,
    source: cleanedSource,
    match,
    progress: progress ?? [],
    questions: questions ?? [],
    messages: messages ?? [],
    segments: segmentSourceText(cleanedText, cleanedSource.title ?? "קטע"),
  };
}

export const createStudySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySb;
    const { data: source } = await sb
      .from("sources")
      .select("title")
      .eq("id", data.sourceId)
      .maybeSingle();

    const { data: session, error } = await sb
      .from("chavruta_study_sessions")
      .upsert(
        {
          match_id: data.matchId,
          source_id: data.sourceId,
          created_by: context.userId,
          companion_type: "human",
          title: source?.title ?? null,
        },
        { onConflict: "match_id,source_id" },
      )
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!session) throw new Error("could_not_create_study_session");
    return session;
  });

export const createAiStudySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateAiInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySb;
    const { data: source } = await sb
      .from("sources")
      .select("title")
      .eq("id", data.sourceId)
      .maybeSingle();

    const { data: existing, error: existingError } = await sb
      .from("chavruta_study_sessions")
      .select("*")
      .eq("created_by", context.userId)
      .eq("source_id", data.sourceId)
      .eq("companion_type", "ai")
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return existing;

    const { data: session, error } = await sb
      .from("chavruta_study_sessions")
      .insert({
        match_id: null,
        source_id: data.sourceId,
        created_by: context.userId,
        companion_type: "ai",
        title: source?.title ? `AI חברותא · ${source.title}` : "AI חברותא",
      })
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!session) throw new Error("could_not_create_ai_study_session");
    return session;
  });

export const getStudySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessionInput.parse(d))
  .handler(async ({ data, context }) =>
    loadSessionBundle(context.supabase as AnySb, data.sessionId, data.lang),
  );

export const setSegmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySb;
    const { data: row, error } = await sb
      .from("chavruta_study_progress")
      .upsert(
        {
          session_id: data.sessionId,
          user_id: context.userId,
          segment_index: data.segmentIndex,
          status: data.status,
          note: data.note ?? null,
        },
        { onConflict: "session_id,user_id,segment_index" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const advanceStudySegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdvanceInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySb;
    const { data: row, error } = await sb
      .from("chavruta_study_sessions")
      .update({ current_segment_index: data.segmentIndex })
      .eq("id", data.sessionId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

function fallbackQuestions(lang: "he" | "en") {
  return lang === "he"
    ? [
        "מה המהלך המרכזי בקטע הזה?",
        "איזו מילה או ביטוי צריך לדייק כאן?",
        "איך היית מסביר את הקטע לחברותא במילים שלך?",
      ]
    : [
        "What is the main idea of this segment?",
        "Which word or phrase needs careful reading here?",
        "How would you explain this segment to your chavruta in your own words?",
      ];
}

function parseQuestions(raw: string, lang: "he" | "en") {
  try {
    const parsed = JSON.parse(raw) as { questions?: Array<{ text?: string }> };
    const qs = parsed.questions?.map((q) => q.text?.trim()).filter(Boolean) ?? [];
    if (qs.length) return qs.slice(0, 3) as string[];
  } catch {
    // plain text fallback below
  }
  const lines = raw
    .split("\n")
    .map((x) => x.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((x) => x.length > 6);
  return lines.length ? lines.slice(0, 3) : fallbackQuestions(lang);
}

function cleanSpeechText(raw: string, lang: "he" | "en") {
  const withoutMarkdown = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/^\s*[-*•]+\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/["“”'׳״*_#~<>|{}()[\]\\/]/g, " ");

  const allowed = lang === "he" ? /[^\u0590-\u05FF\s.,;:?!־-]/g : /[^A-Za-z0-9\s.,;:?!'-]/g;
  return withoutMarkdown.replace(allowed, " ").replace(/\s+/g, " ").trim();
}

async function prepareSpeechText(answer: string, lang: "he" | "en") {
  const cleaned = cleanSpeechText(answer, lang);
  if (!cleaned) return "";
  if (lang !== "he") return cleaned;

  try {
    const { chatCompletion } = await import("./ai-gateway.server");
    const raw = await chatCompletion({
      system:
        "אתה מנקד טקסט עברי לקריאה קולית. החזר עברית מנוקדת בלבד. בלי Markdown, בלי סוגריים, בלי מרכאות, בלי כוכביות, בלי מקפים מיותרים, בלי מספרי סעיפים, בלי סימנים מיוחדים. שמור את אותה משמעות ואל תוסיף מידע.",
      messages: [
        {
          role: "user",
          content: `נקה ונקד את הטקסט הבא לקריאה בקול בדפדפן. השאר רק עברית נקייה עם ניקוד וסימני פיסוק פשוטים:\n\n${cleaned}`,
        },
      ],
      temperature: 0.05,
    });
    return cleanSpeechText(raw, "he") || cleaned;
  } catch (e) {
    console.warn("prepareSpeechText fallback", e);
    return cleaned;
  }
}

export const generateSegmentQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySb;
    const bundle = await loadSessionBundle(sb, data.sessionId, data.lang);
    const existing = bundle.questions.filter(
      (q: any) => q.segment_index === data.segmentIndex && q.kind === "agent",
    );
    if (existing.length > 0) return existing;

    const segment = bundle.segments[data.segmentIndex];
    if (!segment) throw new Error("segment_not_found");

    let questionTexts = fallbackQuestions(data.lang);
    try {
      const { chatCompletion } = await import("./ai-gateway.server");
      const system =
        data.lang === "he"
          ? 'אתה מנחה לימוד חסידות חב״ד בחברותא. כתוב בעברית בלבד, קצר, בלי המצאות מעבר לקטע. החזר JSON בלבד: {"questions":[{"text":"..."}]}'
          : 'You guide a Chabad Chassidus chavruta. Reply in English only, concise, no claims beyond the segment. Return JSON only: {"questions":[{"text":"..."}]}';
      const user =
        data.lang === "he"
          ? `צור 3 שאלות: הבנה, דיוק, והעמקה/יישום.\n\nכותרת: ${bundle.source.title}\nקטע:\n${segment.text}`
          : `Create 3 questions: comprehension, precision, and reflection/application.\n\nTitle: ${bundle.source.title}\nSegment:\n${segment.text}`;
      const raw = await chatCompletion({
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.25,
      });
      questionTexts = parseQuestions(raw, data.lang);
    } catch (e) {
      console.warn("generateSegmentQuestions fallback", e);
    }

    const sanitized = questionTexts
      .map((q) => sanitizeQuestionText(q))
      .filter((q): q is string => q !== null);
    const finalTexts = sanitized.length ? sanitized : fallbackQuestions(data.lang);
    const rows = finalTexts.map((question) => ({
      session_id: data.sessionId,
      segment_index: data.segmentIndex,
      created_by: context.userId,
      kind: "agent",
      question,
    }));
    const { data: inserted, error } = await sb
      .from("chavruta_study_questions")
      .insert(rows)
      .select("*");
    if (error) throw new Error(error.message);
    return inserted ?? [];
  });

export const askStudySegmentQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySb;
    const bundle = await loadSessionBundle(sb, data.sessionId, data.lang);
    const segment = bundle.segments[data.segmentIndex];
    if (!segment) throw new Error("segment_not_found");

    let answer = data.lang === "he" ? "לא הצלחתי לענות כרגע." : "I could not answer right now.";
    try {
      const { chatCompletion } = await import("./ai-gateway.server");
      const system =
        data.lang === "he"
          ? "אתה חברותא ללימוד חסידות חב״ד. ענה בעברית בלבד, לפי הקטע שסופק בלבד. אם חסר הקשר, אמור זאת. כתוב תשובה נקייה בלי Markdown, בלי כוכביות, בלי טבלאות, ובלי סימנים מיוחדים."
          : "You are a Chabad Chassidus chavruta. Answer in English only, only from the provided segment. Say if context is missing. Keep the answer clean, with no Markdown tables or special formatting.";
      const userPrompt =
        data.lang === "he"
          ? `מקור: ${bundle.source.title}\n\nקטע:\n${segment.text}\n\nשאלה:\n${data.question}`
          : `Source: ${bundle.source.title}\n\nSegment:\n${segment.text}\n\nQuestion:\n${data.question}`;
      answer = await chatCompletion({
        system,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.25,
      });
    } catch (e) {
      console.warn("askStudySegmentQuestion fallback", e);
    }

    if (data.includeSpeech) answer = cleanSpeechText(answer, data.lang) || answer;
    const speech_text = data.includeSpeech ? await prepareSpeechText(answer, data.lang) : null;

    const { data: row, error } = await sb
      .from("chavruta_study_questions")
      .insert({
        session_id: data.sessionId,
        segment_index: data.segmentIndex,
        created_by: context.userId,
        kind: "human",
        question: data.question,
        answer,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return speech_text ? { ...row, speech_text } : row;
  });
