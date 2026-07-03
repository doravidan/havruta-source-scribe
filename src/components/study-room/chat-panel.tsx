import { useEffect, useMemo, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { StudyLang, StudyMessageRow, StudyQuestionRow } from "./types";

export function ChatPanel({
  lang,
  userId,
  messages,
  aiQuestions,
  isAiCompanion,
  draft,
  setDraft,
  onSend,
  sending,
  partnerTyping,
  partnerOnline,
  onTyping,
  onTypingStop,
}: {
  lang: StudyLang;
  userId: string;
  messages: StudyMessageRow[];
  aiQuestions: StudyQuestionRow[];
  isAiCompanion: boolean;
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  mobileVisible?: boolean;
  partnerTyping?: boolean;
  partnerOnline?: boolean;
  onTyping?: () => void;
  onTypingStop?: () => void;
}) {
  const aiConversation = useMemo(
    () => aiQuestions.filter((q) => q.kind === "human"),
    [aiQuestions],
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiConversation.length, messages.length, sending]);
  return (
    <section className="scholar-card p-4">
      <h2 className="eyebrow mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          {isAiCompanion
            ? lang === "he"
              ? "חברותא AI"
              : "AI chavruta"
            : lang === "he"
              ? "שיחה"
              : "Chat"}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isAiCompanion || partnerOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            aria-hidden
          />
          {isAiCompanion
            ? lang === "he"
              ? "זמין"
              : "ready"
            : partnerOnline
              ? lang === "he"
                ? "מחובר"
                : "online"
              : lang === "he"
                ? "לא מחובר"
                : "offline"}
        </span>
      </h2>
      <div
        ref={scrollRef}
        className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-border bg-background/30 p-3"
      >
        {isAiCompanion ? (
          aiConversation.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lang === "he"
                ? "שאל את החברותא AI על הקטע הנוכחי, או לחץ ‘שאל אותנו על הקטע’ כדי לקבל שאלות הבנה."
                : "Ask the AI chavruta about the current segment, or generate comprehension questions."}
            </p>
          ) : (
            aiConversation.map((q) => (
              <div key={q.id} className="space-y-2">
                <div className="ms-auto max-w-[86%] rounded-[1.35rem] rounded-se-sm bg-primary/10 px-3 py-2 text-sm text-primary shadow-sm">
                  {q.question}
                </div>
                {q.answer && (
                  <div className="max-w-[92%] rounded-[1.35rem] rounded-ss-sm border border-border bg-card/75 px-3 py-2 text-sm leading-6 text-foreground shadow-sm">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {lang === "he" ? "חברותא AI" : "AI chavruta"}
                    </div>
                    {q.answer}
                  </div>
                )}
              </div>
            ))
          )
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lang === "he" ? "עדיין אין הודעות." : "No messages yet."}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div
                key={m.id}
                className={`max-w-[88%] rounded-[1.35rem] px-3 py-2 text-sm shadow-sm ${mine ? "ms-auto rounded-se-sm bg-primary/10 text-primary" : "rounded-ss-sm bg-card/70 text-foreground"}`}
              >
                {m.body}
              </div>
            );
          })
        )}
        {!isAiCompanion && partnerTyping && (
          <div className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            {lang === "he" ? "החברותא מקליד..." : "Partner is typing..."}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!isAiCompanion) {
              if (e.target.value.trim()) onTyping?.();
              else onTypingStop?.();
            }
          }}
          onBlur={() => onTypingStop?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onTypingStop?.();
              onSend();
            }
          }}
          placeholder={
            isAiCompanion
              ? lang === "he"
                ? "שאל את החברותא AI על הקטע..."
                : "Ask the AI chavruta about this segment..."
              : lang === "he"
                ? "כתוב לחברותא..."
                : "Message your chavruta..."
          }
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background/45 px-3 text-sm outline-none"
        />
        <button
          disabled={!draft.trim() || sending}
          onClick={() => {
            onTypingStop?.();
            onSend();
          }}
          className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isAiCompanion ? (lang === "he" ? "שאל" : "Ask") : lang === "he" ? "שלח" : "Send"}
        </button>
      </div>
    </section>
  );
}
