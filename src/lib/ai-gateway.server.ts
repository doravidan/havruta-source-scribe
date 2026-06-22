// Server-only AI helpers.
//
// Chat now uses OpenRouter directly instead of Lovable's built-in AI Gateway.
// Default model is OpenRouter's free-model router; override with OPENROUTER_CHAT_MODEL.
// Embeddings are intentionally optional. OpenRouter does not provide a stable embedding
// API, so callers must tolerate an empty vector and use keyword/source fallback.

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function env(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function openRouterKey() {
  const k = env("OPENROUTER_API_KEY");
  if (!k) throw new Error("OPENROUTER_API_KEY is not configured");
  return k;
}

export function defaultChatModel() {
  return env("OPENROUTER_CHAT_MODEL") ?? "openrouter/free";
}

export function defaultEmbedModel() {
  return env("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
}

export async function chatCompletion(opts: {
  model?: string;
  system?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
}): Promise<string> {
  const messages = opts.system
    ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
    : opts.messages;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openRouterKey()}`,
      "HTTP-Referer": env("APP_PUBLIC_URL") ?? "https://havruta-source-scribe.lovable.app",
      "X-Title": "Chassiduta Havruta",
    },
    body: JSON.stringify({
      model: opts.model ?? defaultChatModel(),
      messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function embed(inputs: string[], model = defaultEmbedModel()): Promise<number[][]> {
  if (inputs.length === 0) return [];

  // Optional cheap/free path: if GEMINI_API_KEY is configured, keep using Gemini
  // embeddings directly. This preserves compatibility with the existing pgvector
  // dimensions without going through Lovable credits.
  const geminiKey = env("GEMINI_API_KEY");
  if (!geminiKey) return inputs.map(() => []);

  const embeddings: number[][] = [];
  for (const input of inputs) {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:embedContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: input }] },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini embeddings ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    embeddings.push(json.embedding?.values ?? []);
  }
  return embeddings;
}
