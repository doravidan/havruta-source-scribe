import type { StudyLang, StudyQuestionRow } from "./types";

export function GuidePanel({
  lang,
  questions,
  questionDraft,
  setQuestionDraft,
  askPending,
  generatePending,
  onAsk,
  onGenerate,
}: {
  lang: StudyLang;
  questions: StudyQuestionRow[];
  questionDraft: string;
  setQuestionDraft: (value: string) => void;
  askPending: boolean;
  generatePending: boolean;
  onAsk: () => void;
  onGenerate: () => void;
}) {
  return (
    <section className="scholar-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="eyebrow">{lang === "he" ? "שאלות והנחיה" : "Questions & guide"}</h2>
        <button
          onClick={onGenerate}
          className="rounded-full border border-primary/35 px-3 py-1.5 text-xs font-semibold text-primary"
        >
          {generatePending ? "..." : lang === "he" ? "צור שאלות" : "Generate"}
        </button>
      </div>
      <div className="space-y-2">
        {questions.length === 0 ? (
          <p className="rounded-2xl border border-border bg-background/30 p-3 text-sm text-muted-foreground">
            {lang === "he"
              ? "לחץ צור שאלות אחרי שסיימתם לקרוא את הקטע."
              : "Generate questions after you read the segment."}
          </p>
        ) : (
          questions.map((q) => (
            <div
              key={q.id}
              className="rounded-2xl border border-border bg-background/30 p-3 text-sm"
            >
              <div className="font-medium text-foreground">{q.question}</div>
              {q.answer && <p className="mt-2 leading-6 text-muted-foreground">{q.answer}</p>}
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={questionDraft}
          onChange={(e) => setQuestionDraft(e.target.value)}
          placeholder={lang === "he" ? "שאלה על הקטע..." : "Question about the segment..."}
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background/45 px-3 text-sm outline-none"
        />
        <button
          disabled={!questionDraft.trim() || askPending}
          onClick={onAsk}
          className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {lang === "he" ? "שאל" : "Ask"}
        </button>
      </div>
    </section>
  );
}
