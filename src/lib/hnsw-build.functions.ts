import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin: kick off the HNSW index build for source_chunks.embedding_half.
 *  Runs asynchronously in a pg_cron background worker (no HTTP timeout). */
export const startHnswBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { maintenanceWorkMem?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "admin_start_hnsw_build" as any,
      { _maintenance_work_mem: data.maintenanceWorkMem ?? "256MB" },
    );
    if (error) throw new Error(error.message);
    return result as { status: string; job_id?: number; maintenance_work_mem?: string };
  });

/** Admin: report HNSW index existence, size, cron job status, and any active builds. */
export const hnswBuildStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_hnsw_build_status" as any);
    if (error) throw new Error(error.message);
    return data as {
      index_exists: boolean;
      index_size: string | null;
      job_scheduled: boolean;
      last_run: unknown;
      active_builds: unknown[];
    };
  });
