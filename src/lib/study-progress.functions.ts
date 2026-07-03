import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SourceIdInput = z.object({ sourceId: z.string().uuid() });

export type StudySummary = {
  loggedIn: true;
  streak: { current: number; longest: number; lastActiveDate: string | null };
  totals: { done: number; total: number };
  sections: { section: string; total: number; done: number }[];
};

function computeStreaks(dates: string[]): { current: number; longest: number; lastActiveDate: string | null } {
  if (dates.length === 0) return { current: 0, longest: 0, lastActiveDate: null };
  // dates: YYYY-MM-DD descending
  const sorted = [...dates].sort().reverse();
  const lastActiveDate = sorted[0];
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const msDay = 86400_000;

  // current streak: contiguous days ending today or yesterday
  let current = 0;
  let cursor = todayUtc.getTime();
  const set = new Set(sorted);
  // allow starting from yesterday
  if (!set.has(formatUtc(cursor))) {
    cursor -= msDay;
    if (!set.has(formatUtc(cursor))) {
      current = 0;
    }
  }
  while (set.has(formatUtc(cursor))) {
    current++;
    cursor -= msDay;
  }

  // longest streak across history
  let longest = 0;
  let run = 1;
  const asc = [...sorted].reverse();
  for (let i = 1; i < asc.length; i++) {
    const prev = Date.parse(asc[i - 1] + "T00:00:00Z");
    const cur = Date.parse(asc[i] + "T00:00:00Z");
    if (cur - prev === msDay) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);

  return { current, longest, lastActiveDate };
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const getStudySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudySummary> => {
    const { supabase, userId } = context;

    const [sectionsRes, datesRes] = await Promise.all([
      supabase.rpc("study_section_counts", { _user_id: userId }),
      supabase.rpc("study_active_dates", { _user_id: userId }),
    ]);

    if (sectionsRes.error) throw new Error(sectionsRes.error.message);
    if (datesRes.error) throw new Error(datesRes.error.message);

    const sections = (sectionsRes.data ?? []).map((r: { section: string; total: number | string; done: number | string }) => ({
      section: r.section,
      total: Number(r.total),
      done: Number(r.done),
    }));
    const totals = sections.reduce(
      (acc, s) => ({ done: acc.done + s.done, total: acc.total + s.total }),
      { done: 0, total: 0 },
    );
    const dates = (datesRes.data ?? []).map((r: { d: string }) => r.d);
    const streak = computeStreaks(dates);

    return { loggedIn: true, streak, totals, sections };
  });

export const toggleSourceStudied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SourceIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing, error: selErr } = await supabase
      .from("study_progress")
      .select("source_id")
      .eq("user_id", userId)
      .eq("source_id", data.sourceId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    if (existing) {
      const { error } = await supabase
        .from("study_progress")
        .delete()
        .eq("user_id", userId)
        .eq("source_id", data.sourceId);
      if (error) throw new Error(error.message);
      return { studied: false };
    }

    // Look up section (top-level tree part) for analytics rollups.
    const { data: src } = await supabase
      .from("sources")
      .select("tree_parts")
      .eq("id", data.sourceId)
      .maybeSingle();
    const treeParts = (src?.tree_parts as string[] | null) ?? [];
    const section = treeParts[0] ?? null;

    const { error } = await supabase
      .from("study_progress")
      .insert({ user_id: userId, source_id: data.sourceId, section });
    if (error) throw new Error(error.message);
    return { studied: true };
  });

export const isSourceStudied = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SourceIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("study_progress")
      .select("source_id")
      .eq("user_id", userId)
      .eq("source_id", data.sourceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { studied: !!row };
  });
