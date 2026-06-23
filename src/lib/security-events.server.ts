// Server-only helper for writing rows to public.security_events.
// Loaded inside server-function handlers via dynamic import — never imported
// at module scope of client-reachable modules.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SecurityEventInput = {
  kind: string;
  severity?: "info" | "warn" | "critical";
  source?: string;
  matched_patterns?: string[];
  sample?: string | null;
  context?: Record<string, unknown>;
  user_id?: string | null;
};

export async function logSecurityEvent(evt: SecurityEventInput): Promise<void> {
  try {
    await supabaseAdmin.from("security_events").insert({
      kind: evt.kind,
      severity: evt.severity ?? "info",
      source: evt.source ?? null,
      matched_patterns: evt.matched_patterns ?? [],
      sample: evt.sample ? evt.sample.slice(0, 500) : null,
      context: evt.context ?? {},
      user_id: evt.user_id ?? null,
    });
  } catch (e) {
    // Never let logging failures bubble up into user-facing errors.
    console.error("logSecurityEvent failed", e);
  }
}
