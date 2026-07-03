import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InstantMatchResult =
  | { status: "waiting" }
  | { status: "matched"; session_id: string; match_id: string };

export type InstantQueueStatus = {
  status: "idle" | "waiting" | "matched";
  session_id: string | null;
  waiting_count: number;
};

const JoinInput = z.object({
  lang: z.enum(["he", "en"]).default("he"),
});

export const joinInstantChavruta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JoinInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (context.supabase as any).rpc("join_instant_chavruta", {
      _lang: data.lang,
    });
    if (error) throw new Error(error.message);
    return result as InstantMatchResult;
  });

export const leaveInstantChavruta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).rpc("leave_instant_chavruta");
    if (error) throw new Error(error.message);
    return { left: true };
  });

export const instantChavrutaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (context.supabase as any).rpc("instant_chavruta_status");
    if (error) throw new Error(error.message);
    return result as InstantQueueStatus;
  });
