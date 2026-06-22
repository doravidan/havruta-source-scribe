import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  text: z.string().min(1).max(3500),
  voice: z.string().optional().default("alloy"),
  lang: z.enum(["he", "en"]).optional().default("he"),
});

/**
 * Deprecated compatibility stub.
 * Read-aloud now uses browser SpeechSynthesis in use-read-aloud.ts so the app
 * does not spend Lovable AI Gateway credits for TTS.
 */
export const synthesizeSpeechChunk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async () => {
    throw new Error("tts_replaced_by_browser_speech");
  });
