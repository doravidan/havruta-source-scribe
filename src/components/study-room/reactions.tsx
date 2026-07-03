import type { LiveReaction } from "@/hooks/use-study-presence";

export const REACTION_EMOJIS = ["🔥", "❤️", "💡", "👏", "🎉", "🕯️"] as const;

/** Emoji buttons that broadcast a live reaction to the room. */
export function ReactionsBar({
  onReact,
  lang,
}: {
  onReact: (emoji: string) => void;
  lang: "he" | "en";
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={lang === "he" ? "תגובות חיות" : "Live reactions"}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-background/40 text-base transition-transform hover:scale-125 hover:border-primary/40 active:scale-95"
          aria-label={`${lang === "he" ? "שלח" : "Send"} ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Floating emoji overlay — reactions drift up and fade over the text. */
export function FloatingReactions({ reactions }: { reactions: LiveReaction[] }) {
  if (reactions.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {reactions.map((r) => {
        const drift = (r.id.charCodeAt(r.id.length - 1) % 60) - 30;
        const left = 15 + (r.id.charCodeAt(0) % 70);
        return (
          <span
            key={r.id}
            className="absolute bottom-6 animate-reaction-float text-3xl"
            style={{
              insetInlineStart: `${left}%`,
              ["--drift" as string]: `${drift}px`,
            }}
          >
            {r.emoji}
          </span>
        );
      })}
    </div>
  );
}
