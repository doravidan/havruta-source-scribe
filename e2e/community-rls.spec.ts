import { test, expect, type APIResponse } from "@playwright/test";
import { mainSignInLink, routes, waitForAppReady } from "./helpers";

/**
 * End-to-end verification that a non-owner (anonymous) client cannot bypass
 * RLS on the social-learning tables and that /community is auth-gated.
 *
 * The community feed only reaches unprivileged users through the
 * SECURITY DEFINER RPC `get_community_feed`, whose EXECUTE was revoked from
 * `anon`. Direct SELECTs on `learning_activity` and `activity_cheers` must
 * return zero rows for an anon caller.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://mfqpoclgxuxbnnexzxoq.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

test.describe("Community feed RLS (non-owner / anonymous)", () => {
  test("shows sign-in gate on /community without leaking feed items", async ({ page }) => {
    await page.goto("/community");
    await waitForAppReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /לומדים ביחד|Learning together/i,
    );
    await expect(mainSignInLink(page)).toBeVisible();

    // No feed list / cheer buttons rendered for guests.
    await expect(page.locator("ol li")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /cheer|עידוד/i })).toHaveCount(0);
  });

  test.describe("Supabase Data API + RPC as anon", () => {
    test.skip(!SUPABASE_ANON_KEY, "Anon key not available in env");

    const headers = () => ({
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    });

    const parseRows = async (res: APIResponse) => {
      if (!res.ok()) return [] as unknown[];
      try {
        const body = await res.json();
        return Array.isArray(body) ? body : [];
      } catch {
        return [];
      }
    };

    test("learning_activity is not readable by anon", async ({ request }) => {
      const res = await request.get(
        `${SUPABASE_URL}/rest/v1/learning_activity?select=id,user_id&limit=5`,
        { headers: headers() },
      );
      // RLS with no anon policy → either 200 with [] or 401/403.
      expect([200, 401, 403]).toContain(res.status());
      expect(await parseRows(res)).toHaveLength(0);
    });

    test("activity_cheers is not readable by anon", async ({ request }) => {
      const res = await request.get(
        `${SUPABASE_URL}/rest/v1/activity_cheers?select=activity_id,user_id&limit=5`,
        { headers: headers() },
      );
      expect([200, 401, 403]).toContain(res.status());
      expect(await parseRows(res)).toHaveLength(0);
    });

    test("get_community_feed RPC rejects anon callers", async ({ request }) => {
      const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_community_feed`, {
        headers: headers(),
        data: { _limit: 5 },
      });
      // EXECUTE was revoked from anon in 20260703130711 — expect a permission error,
      // never a payload with rows.
      expect(res.ok()).toBeFalsy();
      expect([401, 403, 404]).toContain(res.status());
      expect(await parseRows(res)).toHaveLength(0);
    });
  });
});
