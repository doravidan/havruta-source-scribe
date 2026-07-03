import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type RateBucket = "ask" | "summarize" | "study_ai";

const LIMITS: Record<RateBucket, { maxPerWindow: number; windowSeconds: number }> = {
  ask: { maxPerWindow: 30, windowSeconds: 3600 },
  summarize: { maxPerWindow: 20, windowSeconds: 3600 },
  study_ai: { maxPerWindow: 60, windowSeconds: 3600 },
};

export async function assertAiRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: RateBucket,
): Promise<void> {
  const { maxPerWindow, windowSeconds } = LIMITS[bucket];
  const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
    _bucket: bucket,
    _max_per_window: maxPerWindow,
    _window_seconds: windowSeconds,
  });

  if (error) {
    if (error.message.includes("not_authenticated")) throw new Error("Unauthorized");
    throw new Error(error.message);
  }
  if (!data) throw new Error("rate_limited");
}
