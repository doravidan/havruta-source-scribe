import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHABAD_ROOT_IDS } from "./chabad-clean";

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("forbidden");
}

/** Seed the crawl queue with all 8 root volumes (idempotent). */
export const startFullCrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = CHABAD_ROOT_IDS.map((r) => ({
      chabad_id: r.id,
      root_id: r.id,
      status: "pending",
    }));
    const { error } = await supabaseAdmin
      .from("chabad_crawl_queue")
      .upsert(rows, { onConflict: "chabad_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { enqueued: rows.length };
  });

/** Reset all failed items back to pending so they get retried. */
export const retryFailedCrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("chabad_crawl_queue")
      .update({ status: "pending", attempts: 0, last_error: null }, { count: "exact" })
      .eq("status", "failed");
    if (error) throw new Error(error.message);
    return { retried: count ?? 0 };
  });

/** Current queue counts by status. */
export const crawlQueueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("chabad_crawl_queue")
      .select("status");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = { pending: 0, processing: 0, done: 0, failed: 0 };
    for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return { counts, total: data?.length ?? 0 };
  });
