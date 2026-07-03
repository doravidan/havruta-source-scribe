export type ChavrutaProfile = {
  user_id: string;
  display_name: string;
  bio: string | null;
  learning_level: "beginner" | "intermediate" | "advanced";
  preferred_lang: "he" | "en" | "both";
  topics: string[] | null;
  is_active: boolean;
  time_zone: string | null;
};

export type MatchingSlot = {
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type UtcInterval = { start: number; end: number };

export type FinderMatch = {
  profile: ChavrutaProfile;
  utc: UtcInterval;
  mine: { day: number; startHHMM: string; endHHMM: string };
  theirs: { day: number; startHHMM: string; endHHMM: string };
  score: number;
  reasons: { lang: boolean; level: number; topics: number; minutes: number };
};

const WEEK_MIN = 7 * 24 * 60;
const REF_SUNDAY_UTC = new Date(Date.UTC(2024, 0, 7));
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const LEVEL_ORDER: Record<ChavrutaProfile["learning_level"], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";
  } catch {
    return "Asia/Jerusalem";
  }
}

export function listTimeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof fn === "function") return fn("timeZone");
  } catch {
    /* noop */
  }
  return [
    "Asia/Jerusalem",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Mexico_City",
    "America/Argentina/Buenos_Aires",
    "America/Sao_Paulo",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland",
    "UTC",
  ];
}

function tzOffsetMinutes(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

function localToUtcMinOfWeek(day: number, hhmm: string, tz: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const naive = new Date(REF_SUNDAY_UTC.getTime() + (day * 1440 + h * 60 + m) * 60000);
  const offset = tzOffsetMinutes(naive, tz);
  const utc = naive.getTime() - offset * 60000;
  let mw = Math.round((utc - REF_SUNDAY_UTC.getTime()) / 60000);
  mw = ((mw % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
  return mw;
}

export function utcMinOfWeekToLocal(mw: number, tz: string): { day: number; hhmm: string } {
  const instant = new Date(REF_SUNDAY_UTC.getTime() + mw * 60000);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  return { day: WEEKDAY_INDEX[map.weekday] ?? 0, hhmm: `${hour}:${map.minute}` };
}

export function slotToUtcIntervals(slot: MatchingSlot, tz: string): UtcInterval[] {
  const s = localToUtcMinOfWeek(slot.day_of_week, slot.start_time, tz);
  const eRaw = localToUtcMinOfWeek(slot.day_of_week, slot.end_time, tz);
  if (eRaw > s) return [{ start: s, end: eRaw }];
  const e = eRaw === 0 ? WEEK_MIN : eRaw;
  if (e > s) return [{ start: s, end: e }];
  return [
    { start: s, end: WEEK_MIN },
    { start: 0, end: e },
  ];
}

export function intersectIntervals(a: UtcInterval, b: UtcInterval): UtcInterval | null {
  const s = Math.max(a.start, b.start);
  const e = Math.min(a.end, b.end);
  return e > s ? { start: s, end: e } : null;
}

export function languagesCompatible(
  a: ChavrutaProfile["preferred_lang"],
  b: ChavrutaProfile["preferred_lang"],
): boolean {
  if (a === "both" || b === "both") return true;
  return a === b;
}

export function levelDistance(
  a: ChavrutaProfile["learning_level"],
  b: ChavrutaProfile["learning_level"],
): number {
  return Math.abs(LEVEL_ORDER[a] - LEVEL_ORDER[b]);
}

export function computeFinderMatches(opts: {
  userId: string;
  myProfile: ChavrutaProfile;
  mySlots: MatchingSlot[];
  profiles: ChavrutaProfile[];
  slots: MatchingSlot[];
  matches: Array<{ requester_id: string; suggested_user_id: string }>;
}): FinderMatch[] {
  const { userId, myProfile, mySlots, profiles, slots, matches } = opts;
  if (mySlots.length === 0) return [];

  const myTz = myProfile.time_zone ?? detectTz();
  const myTopics = new Set(myProfile.topics ?? []);
  const existing = new Set(
    matches.map((m) => [m.requester_id, m.suggested_user_id].sort().join(":")),
  );
  const myIntervals = mySlots.flatMap((s) => slotToUtcIntervals(s, myTz));
  const out: FinderMatch[] = [];

  for (const p of profiles) {
    if (p.user_id === userId || !p.is_active) continue;
    if (existing.has([p.user_id, userId].sort().join(":"))) continue;
    if (!languagesCompatible(myProfile.preferred_lang, p.preferred_lang)) continue;
    const ldist = levelDistance(myProfile.learning_level, p.learning_level);
    if (ldist > 1) continue;

    const theirTz = p.time_zone ?? "Asia/Jerusalem";
    const theirSlots = slots.filter((s) => s.user_id === p.user_id);
    const theirIntervals = theirSlots.flatMap((s) => slotToUtcIntervals(s, theirTz));
    let best: UtcInterval | null = null;
    for (const a of myIntervals) {
      for (const b of theirIntervals) {
        const o = intersectIntervals(a, b);
        if (o && (!best || o.end - o.start > best.end - best.start)) best = o;
      }
    }
    if (!best) continue;

    const minutes = best.end - best.start;
    if (minutes < 15) continue;

    const topicOverlap = (p.topics ?? []).filter((t) => myTopics.has(t)).length;
    const langExact = myProfile.preferred_lang === p.preferred_lang;
    const score =
      (langExact ? 3 : 1) * 3 + (2 - ldist) * 3 + topicOverlap * 2 + Math.min(minutes, 180) / 30;
    const mineLocal = utcMinOfWeekToLocal(best.start, myTz);
    const mineLocalEnd = utcMinOfWeekToLocal(best.end % WEEK_MIN, myTz);
    const theirLocal = utcMinOfWeekToLocal(best.start, theirTz);
    const theirLocalEnd = utcMinOfWeekToLocal(best.end % WEEK_MIN, theirTz);
    out.push({
      profile: p,
      utc: best,
      mine: { day: mineLocal.day, startHHMM: mineLocal.hhmm, endHHMM: mineLocalEnd.hhmm },
      theirs: { day: theirLocal.day, startHHMM: theirLocal.hhmm, endHHMM: theirLocalEnd.hhmm },
      score,
      reasons: { lang: langExact, level: ldist, topics: topicOverlap, minutes },
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 10);
}
