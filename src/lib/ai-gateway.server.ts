// Server-only Lovable AI Gateway helpers.
const BASE = "https://ai.gateway.lovable.dev/v1";

function getKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY is not configured");
  return k;
}

export async function chatCompletion(opts: {
  model: string;
  system?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
}): Promise<string> {
  const messages = opts.system
    ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
    : opts.messages;

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getKey(),
      "X-Lovable-AIG-SDK": "manual-fetch",
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gateway ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function embed(inputs: string[], model = "google/gemini-embedding-001"): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await fetch(`${BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getKey(),
      "X-Lovable-AIG-SDK": "manual-fetch",
    },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embeddings ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { data?: Array<{ embedding: number[]; index: number }> };
  const arr = (json.data ?? []).slice().sort((a, b) => a.index - b.index);
  return arr.map((d) => d.embedding);
}
