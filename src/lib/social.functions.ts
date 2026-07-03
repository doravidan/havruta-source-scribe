/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeedMeta = {
  companion?: string;
  questions?: number;
  understood_segments?: number;
};

export type FeedItem = {
  id: string;
  user_id: string;
  display_name: string;
  kind: "session_started" | "session_completed" | "source_studied" | "streak_milestone";
  source_id: string | null;
  session_id: string | null;
  source_title: string | null;
  meta: FeedMeta;
  created_at: string;
  cheer_count: number;
  cheered_by_me: boolean;
};

const FeedInput = z.object({
  limit: z.number().int().min(1).max(100).default(30),
});

export const getCommunityFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeedInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb.rpc("get_community_feed", { _limit: data.limit });
    if (error) throw new Error(error.message);
    return (rows ?? []) as FeedItem[];
  });

const CheerInput = z.object({
  activityId: z.string().uuid(),
  emoji: z.string().min(1).max(8).default("🔥"),
});

export const toggleCheer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CheerInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: existing, error: readError } = await sb
      .from("activity_cheers")
      .select("activity_id")
      .eq("activity_id", data.activityId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing) {
      const { error } = await sb
        .from("activity_cheers")
        .delete()
        .eq("activity_id", data.activityId)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { cheered: false };
    }

    const { error } = await sb.from("activity_cheers").insert({
      activity_id: data.activityId,
      user_id: context.userId,
      emoji: data.emoji,
    });
    if (error) throw new Error(error.message);
    return { cheered: true };
  });

/** Fire-and-forget activity logging from other server functions. */
export async function logLearningActivity(
  sb: any,
  userId: string,
  entry: {
    kind: FeedItem["kind"];
    sourceId?: string | null;
    sessionId?: string | null;
    sourceTitle?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await sb.from("learning_activity").insert({
    user_id: userId,
    kind: entry.kind,
    source_id: entry.sourceId ?? null,
    session_id: entry.sessionId ?? null,
    source_title: entry.sourceTitle ?? null,
    meta: entry.meta ?? {},
  });
  if (error) console.warn("logLearningActivity failed:", error.message);
}
