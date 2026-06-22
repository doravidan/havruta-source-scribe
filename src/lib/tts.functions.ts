import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  text: z.string().min(1).max(3500),
  voice: z.string().optional().default("alloy"),
  lang: z.enum(["he", "en"]).optional().default("he"),
});

/**
 * Synthesize a chunk of text into MP3 audio via the Lovable AI Gateway.
 * Returns base64 so it can travel over the server-fn RPC boundary.
 * Callers should chunk long text and queue the audio client-side.
 */
export const synthesizeSpeechChunk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: data.voice,
        response_format: "mp3",
        instructions:
          data.lang === "he"
            ? "Read in clear, gentle Hebrew with natural cadence. Pronounce loshon-kodesh and Yiddish terms accurately."
            : "Read in a calm, warm, scholarly tone.",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("rate_limited");
      if (res.status === 402) throw new Error("out_of_credits");
      throw new Error(`TTS ${res.status}: ${body.slice(0, 300)}`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    // Worker runtime exposes Buffer via nodejs_compat.
    const base64 = Buffer.from(buf).toString("base64");
    return { audioBase64: base64, mime: "audio/mpeg" };
  });
