/**
 * Performance guard for library browse.
 *
 * The `browseLibrary` server function reads ~thousands of rows from `sources`
 * on every load. We've hit "canceling statement due to statement timeout"
 * regressions here before, so this test exercises the underlying query with
 * realistic browse paths and asserts each round-trip stays comfortably under
 * the Postgres statement-timeout ceiling.
 *
 * Skips gracefully when SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY aren't set
 * (e.g. sandboxed CI without DB access).
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildLibraryNode, enrichLearningSources } from "./library-sequence";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Statement timeout on the Data API is ~8s. Keep well below it so we detect
// regressions before users see failures.
const BUDGET_MS = 4000;
const WARN_MS = 1500;

const REALISTIC_PATHS: string[][] = [
  [], // root — largest scan
  ["ליקוטי שיחות"],
  ["ספר המאמרים"],
  ["אגרות קודש"],
  ["תניא"],
];

async function runBrowse(path: string[]) {
  const sb = createClient<Database>(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const t0 = performance.now();
  const { data: rows, error } = await sb
    .from("sources")
    .select("id, title, tree, tree_parts, char_count, language")
    .gte("char_count", 250)
    .limit(6000);
  const queryMs = performance.now() - t0;

  if (error) throw new Error(`${error.code ?? ""} ${error.message}`);

  const learning = enrichLearningSources(
    (rows ?? []) as Parameters<typeof enrichLearningSources>[0],
  );
  const node = buildLibraryNode(path, learning);
  const totalMs = performance.now() - t0;

  return { queryMs, totalMs, rawRows: rows?.length ?? 0, node };
}

describe.skipIf(!SUPABASE_URL || !SUPABASE_KEY)(
  "library browse — statement-timeout guard",
  () => {
    it.each(REALISTIC_PATHS)(
      "stays under %s ms budget for path %j",
      async (...args) => {
        const path = args as unknown as string[];
        const { queryMs, totalMs, rawRows, node } = await runBrowse(path);

        // eslint-disable-next-line no-console
        console.log(
          `[library-browse-perf] path=${JSON.stringify(path)} rawRows=${rawRows} ` +
            `children=${node.children.length} leaves=${node.leaves.length} ` +
            `queryMs=${Math.round(queryMs)} totalMs=${Math.round(totalMs)}`,
        );

        if (totalMs > WARN_MS) {
          // eslint-disable-next-line no-console
          console.warn(
            `[library-browse-perf] SLOW path=${JSON.stringify(path)} totalMs=${Math.round(totalMs)}`,
          );
        }

        expect(rawRows).toBeGreaterThan(0);
        expect(queryMs).toBeLessThan(BUDGET_MS);
        expect(totalMs).toBeLessThan(BUDGET_MS);
      },
      BUDGET_MS + 5000,
    );
  },
);
