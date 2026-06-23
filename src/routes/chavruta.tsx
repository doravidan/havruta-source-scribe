import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopBar } from "@/components/top-bar";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import { createAiStudySession, createStudySession } from "@/lib/chavruta-study.functions";
import {
  CalendarClock,
  Check,
  Clock,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/chavruta")({
  head: () => ({
    meta: [
      { title: "חברותות — חסידותא · Chassiduta" },
      { name: "description", content: "מצא חברותא ללימוד חסידות לפי זמני לימוד וזמינות שבועית." },
      { property: "og:title", content: "חברותות — חסידותא · Chassiduta" },
      {
        property: "og:description",
        content: "מצא חברותא ללימוד חסידות לפי זמני לימוד וזמינות שבועית.",
      },
      { property: "og:url", content: "https://chassiduta.lovable.app/chavruta" },
      { name: "twitter:title", content: "חברותות — חסידותא · Chassiduta" },
      {
        name: "twitter:description",
        content: "מצא חברותא ללימוד חסידות לפי זמני לימוד וזמינות שבועית.",
      },
    ],
    links: [{ rel: "canonical", href: "https://chassiduta.lovable.app/chavruta" }],
  }),

  component: ChavrutaPage,
});

type Profile = {
  user_id: string;
  display_name: string;
  bio: string | null;
  learning_level: "beginner" | "intermediate" | "advanced";
  preferred_lang: "he" | "en" | "both";
  topics: string[] | null;
  is_active: boolean;
  time_zone: string | null;
};

type Availability = {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  note: string | null;
  is_havruta_available: boolean;
};

type Match = {
  id: string;
  requester_id: string;
  suggested_user_id: string;
  status: "chatting" | "accepted" | "declined" | "cancelled";
  overlap_day: number | null;
  overlap_start: string | null;
  overlap_end: string | null;
  requester_accepted: boolean;
  suggested_accepted: boolean;
  created_at: string;
};

type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type SourceIntent = {
  id: string;
  title: string;
  tree: string | null;
};

type DbError = { message: string };
type DbResult<T = unknown> = { data: T | null; error: DbError | null };
type DbChain<T = unknown> = PromiseLike<DbResult<T>> & {
  select(columns?: string): DbChain<T>;
  eq(column: string, value: unknown): DbChain<T>;
  order(column: string, opts?: { ascending?: boolean }): DbChain<T>;
  maybeSingle(): Promise<DbResult<T>>;
  insert(values: unknown): Promise<DbResult<T>>;
  upsert(values: unknown, opts?: unknown): Promise<DbResult<T>>;
  delete(): DbChain<T>;
  limit(count: number): DbChain<T>;
};
type DbClient = {
  from<T = unknown>(table: string): DbChain<T>;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<DbResult<T>>;
};

const db = supabase as unknown as DbClient;
const dayHe = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const dayEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbat"];
const defaultTopics = ["תניא", "מאמרים", "לקוטי שיחות", "אגרות קודש", "חסידות כללית"];

function mins(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function time(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function overlap(a: Availability, b: Availability) {
  if (a.day_of_week !== b.day_of_week) return null;
  const start = Math.max(mins(a.start_time), mins(b.start_time));
  const end = Math.min(mins(a.end_time), mins(b.end_time));
  return end > start ? { day: a.day_of_week, start: time(start), end: time(end) } : null;
}

// ---------- Time-zone aware matching ----------
const WEEK_MIN = 7 * 24 * 60;
// Sunday 2024-01-07 00:00:00 UTC — reference week start
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

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";
  } catch {
    return "Asia/Jerusalem";
  }
}

function listTimeZones(): string[] {
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

// offset = (local time in tz) - UTC, in minutes, for the given instant
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

// Convert a (day, "HH:MM") wall-clock in tz to UTC minute-of-week relative to REF_SUNDAY_UTC.
function localToUtcMinOfWeek(day: number, hhmm: string, tz: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const naive = new Date(REF_SUNDAY_UTC.getTime() + (day * 1440 + h * 60 + m) * 60000);
  const offset = tzOffsetMinutes(naive, tz);
  const utc = naive.getTime() - offset * 60000;
  let mw = Math.round((utc - REF_SUNDAY_UTC.getTime()) / 60000);
  mw = ((mw % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
  return mw;
}

function utcMinOfWeekToLocal(mw: number, tz: string): { day: number; hhmm: string } {
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

type UtcInterval = { start: number; end: number };

function slotToUtcIntervals(slot: Availability, tz: string): UtcInterval[] {
  const s = localToUtcMinOfWeek(slot.day_of_week, slot.start_time, tz);
  const eRaw = localToUtcMinOfWeek(slot.day_of_week, slot.end_time, tz);
  // Local end > local start within a slot, so if eRaw <= s we crossed the UTC week boundary.
  if (eRaw > s) return [{ start: s, end: eRaw }];
  const e = eRaw === 0 ? WEEK_MIN : eRaw;
  if (e > s) return [{ start: s, end: e }];
  return [
    { start: s, end: WEEK_MIN },
    { start: 0, end: e },
  ];
}

function intersectIntervals(a: UtcInterval, b: UtcInterval): UtcInterval | null {
  const s = Math.max(a.start, b.start);
  const e = Math.min(a.end, b.end);
  return e > s ? { start: s, end: e } : null;
}

function languagesCompatible(a: Profile["preferred_lang"], b: Profile["preferred_lang"]): boolean {
  if (a === "both" || b === "both") return true;
  return a === b;
}

const LEVEL_ORDER: Record<Profile["learning_level"], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};
function levelDistance(a: Profile["learning_level"], b: Profile["learning_level"]): number {
  return Math.abs(LEVEL_ORDER[a] - LEVEL_ORDER[b]);
}

function ChavrutaPage() {
  const { user, loading } = useAuth();
  const { lang, dir } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createStudyFn = useServerFn(createStudySession);
  const createAiStudyFn = useServerFn(createAiStudySession);
  const days = lang === "he" ? dayHe : dayEn;
  const [newSlot, setNewSlot] = useState({ day: 0, start: "20:00", end: "21:00" });
  const [topicInput, setTopicInput] = useState(defaultTopics.join(", "));
  const [messageDraft, setMessageDraft] = useState<Record<string, string>>({});
  const [sourceIntentId, setSourceIntentId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSourceIntentId(new URLSearchParams(window.location.search).get("source"));
  }, []);

  const profileQ = useQuery({
    queryKey: ["chavruta-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await db
        .from<Profile>("chavruta_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { data: contact } = await db
        .from<{ phone: string }>("chavruta_contact_info")
        .select("phone")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (profile?.topics?.length) setTopicInput(profile.topics.join(", "));
      return { profile: profile as Profile | null, phone: contact?.phone ?? "" };
    },
  });

  const availabilityQ = useQuery({
    queryKey: ["chavruta-availability", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("chavruta_availability")
        .select("*")
        .eq("user_id", user!.id)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as Availability[];
    },
  });

  const socialQ = useQuery({
    queryKey: ["chavruta-social", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profiles }, { data: slots }, { data: matches }, { data: messages }] =
        await Promise.all([
          db.from("chavruta_profiles").select("*").eq("is_active", true),
          db.from("chavruta_availability").select("*").eq("is_havruta_available", true),
          db.from("chavruta_matches").select("*").order("updated_at", { ascending: false }),
          db.from("chavruta_messages").select("*").order("created_at", { ascending: true }),
        ]);
      return {
        profiles: (profiles ?? []) as Profile[],
        slots: (slots ?? []) as Availability[],
        matches: (matches ?? []) as Match[],
        messages: (messages ?? []) as Message[],
      };
    },
  });

  const sourceIntentQ = useQuery({
    queryKey: ["chavruta-source-intent", sourceIntentId],
    enabled: !!user && !!sourceIntentId,
    queryFn: async () => {
      const { data, error } = await db
        .from<SourceIntent>("sources")
        .select("id, title, tree")
        .eq("id", sourceIntentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myProfile = profileQ.data?.profile;
  const mySlots = useMemo(() => availabilityQ.data ?? [], [availabilityQ.data]);

  const suggestions = useMemo(() => {
    if (!user || !socialQ.data || mySlots.length === 0) return [];
    const existing = new Set(
      (socialQ.data.matches ?? []).map((m) =>
        [m.requester_id, m.suggested_user_id].sort().join(":"),
      ),
    );
    const out: Array<{
      profile: Profile;
      slot: Availability;
      overlap: { day: number; start: string; end: string };
      score: number;
    }> = [];
    for (const p of socialQ.data.profiles) {
      if (p.user_id === user.id || !p.is_active) continue;
      if (existing.has([p.user_id, user.id].sort().join(":"))) continue;
      const theirSlots = socialQ.data.slots.filter((s) => s.user_id === p.user_id);
      for (const mine of mySlots)
        for (const theirs of theirSlots) {
          const o = overlap(mine, theirs);
          if (!o) continue;
          const topicScore = (p.topics ?? []).filter((x) =>
            (myProfile?.topics ?? []).includes(x),
          ).length;
          out.push({
            profile: p,
            slot: theirs,
            overlap: o,
            score: topicScore * 10 + (mins(o.end) - mins(o.start)),
          });
        }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [socialQ.data, mySlots, myProfile?.topics, user]);

  const saveProfile = useMutation({
    mutationFn: async (form: FormData) => {
      const profile = {
        user_id: user!.id,
        display_name: String(form.get("display_name") || user?.email?.split("@")[0] || "חברותא"),
        bio: String(form.get("bio") || ""),
        learning_level: String(form.get("learning_level") || "beginner"),
        preferred_lang: String(form.get("preferred_lang") || "he"),
        time_zone: String(form.get("time_zone") || detectTz()),
        topics: topicInput
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        is_active: form.get("is_active") === "on",
      };
      const phone = String(form.get("phone") || "").trim();
      const { error } = await db
        .from("chavruta_profiles")
        .upsert(profile, { onConflict: "user_id" });
      if (error) throw error;
      if (phone) {
        const { error: cErr } = await db
          .from("chavruta_contact_info")
          .upsert({ user_id: user!.id, phone }, { onConflict: "user_id" });
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chavruta-profile", user?.id] }),
  });

  const addSlot = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("chavruta_availability").insert({
        user_id: user!.id,
        day_of_week: newSlot.day,
        start_time: newSlot.start,
        end_time: newSlot.end,
        is_havruta_available: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chavruta-availability", user?.id] });
      qc.invalidateQueries({ queryKey: ["chavruta-social", user?.id] });
    },
  });

  const removeSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("chavruta_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chavruta-availability", user?.id] }),
  });

  const propose = useMutation({
    mutationFn: async (s: (typeof suggestions)[number]) => {
      const { error } = await db.rpc("propose_chavruta_match", {
        _target_user_id: s.profile.user_id,
        _day: s.overlap.day,
        _start: s.overlap.start,
        _end: s.overlap.end,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chavruta-social", user?.id] }),
  });

  const viewerTz = myProfile?.time_zone ?? detectTz();

  const finderMatches = useMemo(() => {
    if (!user || !socialQ.data || !myProfile || mySlots.length === 0) return [];
    const myTz = myProfile.time_zone ?? detectTz();
    const myTopics = new Set(myProfile.topics ?? []);
    const existing = new Set(
      (socialQ.data.matches ?? []).map((m) =>
        [m.requester_id, m.suggested_user_id].sort().join(":"),
      ),
    );
    const myIntervals = mySlots.flatMap((s) => slotToUtcIntervals(s, myTz));
    type FinderResult = {
      profile: Profile;
      utc: UtcInterval;
      mine: { day: number; startHHMM: string; endHHMM: string };
      theirs: { day: number; startHHMM: string; endHHMM: string };
      score: number;
      reasons: { lang: boolean; level: number; topics: number; minutes: number };
    };
    const out: FinderResult[] = [];
    for (const p of socialQ.data.profiles) {
      if (p.user_id === user.id || !p.is_active) continue;
      if (existing.has([p.user_id, user.id].sort().join(":"))) continue;
      if (!languagesCompatible(myProfile.preferred_lang, p.preferred_lang)) continue;
      const ldist = levelDistance(myProfile.learning_level, p.learning_level);
      if (ldist > 1) continue;
      const theirTz = p.time_zone ?? "Asia/Jerusalem";
      const theirSlots = socialQ.data.slots.filter((s) => s.user_id === p.user_id);
      const theirIntervals = theirSlots.flatMap((s) => slotToUtcIntervals(s, theirTz));
      let best: UtcInterval | null = null;
      for (const a of myIntervals)
        for (const b of theirIntervals) {
          const o = intersectIntervals(a, b);
          if (o && (!best || o.end - o.start > best.end - best.start)) best = o;
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
  }, [user, socialQ.data, myProfile, mySlots]);

  const proposeFinder = useMutation({
    mutationFn: async (r: {
      profile: Profile;
      mine: { day: number; startHHMM: string; endHHMM: string };
    }) => {
      const { data: matchId, error } = await db.rpc<string>("propose_chavruta_match", {
        _target_user_id: r.profile.user_id,
        _day: r.mine.day,
        _start: r.mine.startHHMM,
        _end: r.mine.endHHMM,
      });
      if (error) throw error;
      if (matchId && sourceIntentQ.data) {
        const body =
          lang === "he"
            ? `רוצה ללמוד יחד את ${sourceIntentQ.data.title}?${sourceIntentQ.data.tree ? ` (${sourceIntentQ.data.tree})` : ""}`
            : `Want to learn ${sourceIntentQ.data.title} together?${sourceIntentQ.data.tree ? ` (${sourceIntentQ.data.tree})` : ""}`;
        await db.from("chavruta_messages").insert({ match_id: matchId, sender_id: user!.id, body });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chavruta-social", user?.id] }),
  });

  const sendMessage = useMutation({
    mutationFn: async (matchId: string) => {
      const body = (messageDraft[matchId] ?? "").trim();
      if (!body) return;
      const { error } = await db
        .from("chavruta_messages")
        .insert({ match_id: matchId, sender_id: user!.id, body });
      if (error) throw error;
      setMessageDraft((d) => ({ ...d, [matchId]: "" }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chavruta-social", user?.id] }),
  });

  const openStudyRoom = useMutation({
    mutationFn: async (matchId: string) => {
      if (!sourceIntentQ.data?.id) throw new Error("source_required");
      return createStudyFn({ data: { matchId, sourceId: sourceIntentQ.data.id } });
    },
    onSuccess: (room) => {
      navigate({ to: "/study/$sessionId", params: { sessionId: room.id } });
    },
  });

  const openAiStudyRoom = useMutation({
    mutationFn: async () => {
      if (!sourceIntentQ.data?.id) throw new Error("source_required");
      return createAiStudyFn({ data: { sourceId: sourceIntentQ.data.id } });
    },
    onSuccess: (room) => {
      navigate({ to: "/study/$sessionId", params: { sessionId: room.id } });
    },
  });

  const accept = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await db.rpc("accept_chavruta_match", { _match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chavruta-social", user?.id] }),
  });

  const contactQ = useQuery({
    queryKey: ["chavruta-contacts", socialQ.data?.matches?.map((m) => m.id).join(",")],
    enabled: !!user && !!socialQ.data?.matches?.some((m) => m.status === "accepted"),
    queryFn: async () => {
      const contacts: Record<string, { display_name: string; phone: string }> = {};
      for (const m of socialQ.data!.matches.filter((x) => x.status === "accepted")) {
        const { data } = await db.rpc<{ display_name: string; phone: string }[]>(
          "get_chavruta_match_contact",
          { _match_id: m.id },
        );
        if (data?.[0]) contacts[m.id] = data[0];
      }
      return contacts;
    },
  });

  if (loading) return <div className="min-h-screen" />;
  if (!user) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="scholar-card p-8">
            <Users className="mx-auto h-10 w-10 text-primary mb-4" />
            <h1 className="text-3xl gold-text">
              {lang === "he" ? "מצא חברותא לחסידות" : "Find a Chassidus chavruta"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "he"
                ? "צריך להתחבר כדי לפרסם זמינות ולדבר עם חברותות."
                : "Sign in to publish availability and chat with matches."}
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-primary-foreground"
            >
              {lang === "he" ? "התחברות" : "Sign in"}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const nameById = new Map((socialQ.data?.profiles ?? []).map((p) => [p.user_id, p.display_name]));
  const matches = socialQ.data?.matches ?? [];
  const messages = socialQ.data?.messages ?? [];
  const setupSteps = [
    {
      done: !!myProfile?.display_name && !!profileQ.data?.phone,
      label: lang === "he" ? "שם וטלפון שמור" : "Name and phone saved",
    },
    {
      done: (myProfile?.topics?.length ?? 0) > 0,
      label: lang === "he" ? "נושאי לימוד" : "Learning topics",
    },
    {
      done: mySlots.length > 0,
      label: lang === "he" ? "זמינות שבועית" : "Weekly availability",
    },
    {
      done: !!myProfile?.is_active,
      label: lang === "he" ? "פעיל להצעות" : "Active for matches",
    },
  ];
  const completion = Math.round(
    (setupSteps.filter((s) => s.done).length / setupSteps.length) * 100,
  );

  return (
    <div className="min-h-screen" dir={dir}>
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-10">
        <header className="mb-8 grid lg:grid-cols-[1fr_auto] gap-5 items-end">
          <div>
            <div className="eyebrow mb-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/45 px-3 py-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              {lang === "he" ? "רשת חברותות" : "chavruta network"}
            </div>
            <h1 className="text-4xl sm:text-5xl gold-text">
              {lang === "he" ? "לומדים חסידות ביחד" : "Learn Chassidus together"}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
              {lang === "he"
                ? "פרסם זמני לימוד וזמני זמינות לחברותא. המערכת תציע התאמות, אפשר להתכתב קודם, ומספרי טלפון נחשפים רק אחרי ששני הצדדים מאשרים."
                : "Publish study and chavruta availability. The app suggests matches, lets you chat first, and reveals phone numbers only after both sides accept."}
            </p>
          </div>
        </header>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="scholar-card p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="eyebrow">
                  {lang === "he" ? "הגדרת חברותא מודרכת" : "Guided chavruta setup"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {lang === "he"
                    ? "השלם את ארבעת השלבים כדי לקבל התאמות טובות יותר ולחשוף טלפון רק אחרי אישור הדדי."
                    : "Complete these four steps for better matches, with phone reveal only after mutual acceptance."}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3 text-center">
                <div className="text-2xl font-semibold text-primary tabular-nums">
                  {completion}%
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === "he" ? "השלמה" : "complete"}
                </div>
              </div>
            </div>
            <div className="mt-5 grid sm:grid-cols-4 gap-2">
              {setupSteps.map((step, i) => (
                <div
                  key={step.label}
                  className="rounded-xl border border-border/70 bg-background/30 p-3 text-sm"
                >
                  <div
                    className={`mb-2 grid h-7 w-7 place-items-center rounded-full text-xs ${step.done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
                  >
                    {step.done ? "✓" : i + 1}
                  </div>
                  <div className={step.done ? "text-foreground" : "text-muted-foreground"}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {sourceIntentQ.data && (
            <div className="scholar-card p-5 sm:p-6 border-primary/35">
              <h2 className="eyebrow">
                {lang === "he" ? "לימוד מקור עם חברותא" : "Source-to-chavruta"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {lang === "he"
                  ? "נפתח ממקור בקורא. כשתפתח שיחה, נשלח הודעת פתיחה עם שם המקור."
                  : "Opened from the reader. When you start a chat, we send a source-specific opener."}
              </p>
              <div className="mt-4 rounded-xl border border-border/70 bg-background/30 p-3">
                <div className="font-medium text-foreground">{sourceIntentQ.data.title}</div>
                {sourceIntentQ.data.tree && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {sourceIntentQ.data.tree}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => openAiStudyRoom.mutate()}
                disabled={openAiStudyRoom.isPending}
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {lang === "he" ? "למד עכשיו עם חברותא AI" : "Study now with AI chavruta"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "he"
                  ? "אם עוד לא מצאת חברותא אמיתי, האייג׳נט יתקדם איתך קטע-קטע וישאל שאלות הבנה."
                  : "If you have not found a real partner yet, the agent studies segment-by-segment and asks comprehension questions."}
              </p>
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
          <aside className="space-y-6 lg:sticky lg:top-24">
            <form
              action={(fd) => saveProfile.mutate(fd)}
              className="scholar-card p-5 sm:p-6 space-y-4"
            >
              <h2 className="eyebrow">{lang === "he" ? "הפרופיל שלי" : "My profile"}</h2>
              <input
                name="display_name"
                defaultValue={
                  profileQ.data?.profile?.display_name ?? user.email?.split("@")[0] ?? ""
                }
                placeholder={lang === "he" ? "שם לתצוגה" : "Display name"}
                className="w-full h-11 rounded-xl border border-border bg-background/45 px-3 outline-none"
              />
              <input
                name="phone"
                defaultValue={profileQ.data?.phone ?? ""}
                placeholder={
                  lang === "he" ? "טלפון לחשיפה אחרי אישור" : "Phone revealed after acceptance"
                }
                className="w-full h-11 rounded-xl border border-border bg-background/45 px-3 outline-none"
              />
              <textarea
                name="bio"
                defaultValue={profileQ.data?.profile?.bio ?? ""}
                placeholder={
                  lang === "he"
                    ? "כמה מילים על הלימוד שאתה מחפש"
                    : "What kind of learning are you looking for?"
                }
                rows={3}
                className="w-full rounded-xl border border-border bg-background/45 p-3 outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  name="learning_level"
                  defaultValue={profileQ.data?.profile?.learning_level ?? "beginner"}
                  className="h-11 rounded-xl border border-border bg-background/45 px-3"
                >
                  <option value="beginner">{lang === "he" ? "מתחיל" : "Beginner"}</option>
                  <option value="intermediate">{lang === "he" ? "בינוני" : "Intermediate"}</option>
                  <option value="advanced">{lang === "he" ? "מתקדם" : "Advanced"}</option>
                </select>
                <select
                  name="preferred_lang"
                  defaultValue={profileQ.data?.profile?.preferred_lang ?? "he"}
                  className="h-11 rounded-xl border border-border bg-background/45 px-3"
                >
                  <option value="he">עברית</option>
                  <option value="en">English</option>
                  <option value="both">{lang === "he" ? "שתיהן" : "Both"}</option>
                </select>
              </div>
              <select
                name="time_zone"
                defaultValue={profileQ.data?.profile?.time_zone ?? detectTz()}
                className="w-full h-11 rounded-xl border border-border bg-background/45 px-3"
                aria-label={lang === "he" ? "אזור זמן" : "Time zone"}
              >
                {listTimeZones().map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder={lang === "he" ? "נושאים, מופרדים בפסיקים" : "Topics, comma separated"}
                className="w-full h-11 rounded-xl border border-border bg-background/45 px-3 outline-none"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={profileQ.data?.profile?.is_active ?? true}
                />{" "}
                {lang === "he" ? "פעיל להצעות חברותא" : "Active for matches"}
              </label>
              <button
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium"
                disabled={saveProfile.isPending}
              >
                {lang === "he" ? "שמור פרופיל" : "Save profile"}
              </button>
            </form>

            <section className="scholar-card p-5 sm:p-6 space-y-4">
              <h2 className="eyebrow flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                {lang === "he" ? "זמינות שבועית" : "Weekly availability"}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newSlot.day}
                  onChange={(e) => setNewSlot({ ...newSlot, day: Number(e.target.value) })}
                  className="h-10 rounded-xl border border-border bg-background/45 px-2"
                >
                  {days.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newSlot.start}
                  onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background/45 px-2"
                />
                <input
                  type="time"
                  value={newSlot.end}
                  onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-background/45 px-2"
                />
              </div>
              <button
                onClick={() => addSlot.mutate()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/40 px-3 text-primary"
              >
                <Plus className="h-4 w-4" />
                {lang === "he" ? "הוסף זמן" : "Add time"}
              </button>
              <div className="space-y-2">
                {mySlots.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-sm"
                  >
                    <span>
                      {days[s.day_of_week]} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                    <button
                      onClick={() => removeSlot.mutate(s.id)}
                      aria-label={lang === "he" ? "הסר זמן" : "Remove time slot"}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-6 min-w-0">
            <div className="scholar-card p-5 sm:p-6 border border-primary/40">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="eyebrow flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {lang === "he" ? "מצא לי חברותא" : "Find me a chavruta"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "he"
                      ? `התאמה לפי אזור זמן (${viewerTz}), שפה, רמה ונושאים`
                      : `Matched by time zone (${viewerTz}), language, level, and topics`}
                  </p>
                </div>
                <button
                  onClick={() => qc.invalidateQueries({ queryKey: ["chavruta-social", user?.id] })}
                  className="h-9 rounded-xl border border-primary/40 px-3 text-sm text-primary"
                >
                  {lang === "he" ? "רענן" : "Refresh"}
                </button>
              </div>
              {!myProfile ? (
                <p className="text-sm text-muted-foreground">
                  {lang === "he"
                    ? "שמור פרופיל כדי לקבל התאמות."
                    : "Save your profile to get matches."}
                </p>
              ) : mySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lang === "he"
                    ? "הוסף לפחות זמן זמינות אחד כדי שנמצא חברותא."
                    : "Add at least one availability slot so we can match you."}
                </p>
              ) : finderMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lang === "he"
                    ? "אין כרגע התאמות חדשות. נסה להרחיב זמנים או נושאים."
                    : "No new matches yet. Try broadening your availability or topics."}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {finderMatches.map((r) => (
                    <article
                      key={`${r.profile.user_id}-${r.utc.start}`}
                      className="rounded-2xl border border-border/80 bg-background/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{r.profile.display_name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {
                              (lang === "he"
                                ? { beginner: "מתחיל", intermediate: "בינוני", advanced: "מתקדם" }
                                : {
                                    beginner: "Beginner",
                                    intermediate: "Intermediate",
                                    advanced: "Advanced",
                                  })[r.profile.learning_level]
                            }
                            {" · "}
                            {r.profile.preferred_lang === "he"
                              ? "עברית"
                              : r.profile.preferred_lang === "en"
                                ? "English"
                                : lang === "he"
                                  ? "עברית/אנגלית"
                                  : "Hebrew/English"}
                            {" · "}
                            {r.profile.time_zone ?? "—"}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-2 text-center">
                          <div className="text-sm font-semibold text-primary tabular-nums">
                            {Math.min(99, Math.round(r.score * 6))}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {lang === "he" ? "התאמה" : "fit"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            {lang === "he" ? "אצלך: " : "Your time: "}
                          </span>
                          {days[r.mine.day]} · {r.mine.startHHMM}–{r.mine.endHHMM}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lang === "he" ? "אצלם: " : "Their time: "}
                          {days[r.theirs.day]} · {r.theirs.startHHMM}–{r.theirs.endHHMM}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(r.profile.topics ?? []).slice(0, 4).map((x) => (
                          <span
                            key={x}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              (myProfile?.topics ?? []).includes(x)
                                ? "border-primary/60 text-primary"
                                : "border-border/70 text-muted-foreground"
                            }`}
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {lang === "he"
                            ? `${r.reasons.minutes} דק׳ חפיפה · ${r.reasons.topics} נושאים משותפים`
                            : `${r.reasons.minutes} min overlap · ${r.reasons.topics} shared topics`}
                        </span>
                        <button
                          onClick={() => proposeFinder.mutate(r)}
                          disabled={proposeFinder.isPending}
                          className="h-9 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
                        >
                          {lang === "he" ? "פתח שיחה" : "Start chat"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="scholar-card p-5 sm:p-6">
              <h2 className="eyebrow mb-4">
                {lang === "he" ? "הצעות התאמה" : "Suggested matches"}
              </h2>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lang === "he"
                    ? "הוסף זמני זמינות כדי לקבל הצעות."
                    : "Add availability to see suggestions."}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {suggestions.map((s) => (
                    <article
                      key={`${s.profile.user_id}-${s.overlap.day}-${s.overlap.start}`}
                      className="rounded-2xl border border-border/80 bg-background/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{s.profile.display_name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {s.profile.bio ||
                              (lang === "he"
                                ? "מחפש חברותא ללימוד חסידות"
                                : "Looking for a Chassidus chavruta")}
                          </p>
                        </div>
                        <Clock className="h-4 w-4 text-primary shrink-0" />
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        {days[s.overlap.day]} · {s.overlap.start}–{s.overlap.end}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(s.profile.topics ?? []).slice(0, 3).map((x) => (
                          <span
                            key={x}
                            className="rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground"
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => propose.mutate(s)}
                        className="mt-4 h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                      >
                        {lang === "he" ? "פתח שיחה" : "Start chat"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="scholar-card p-5 sm:p-6">
              <h2 className="eyebrow mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                {lang === "he" ? "שיחות והתאמות" : "Chats and matches"}
              </h2>
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lang === "he" ? "עוד אין שיחות חברותא." : "No chavruta chats yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {matches.map((m) => {
                    const other = m.requester_id === user.id ? m.suggested_user_id : m.requester_id;
                    const myAccepted =
                      m.requester_id === user.id ? m.requester_accepted : m.suggested_accepted;
                    const theirAccepted =
                      m.requester_id === user.id ? m.suggested_accepted : m.requester_accepted;
                    const contact = contactQ.data?.[m.id];
                    const thread = messages.filter((x) => x.match_id === m.id);
                    return (
                      <article
                        key={m.id}
                        className="rounded-2xl border border-border/80 bg-background/30 p-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h3 className="font-medium">
                              {nameById.get(other) ?? (lang === "he" ? "חברותא" : "Chavruta")}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {m.overlap_day != null
                                ? `${days[m.overlap_day]} · ${m.overlap_start?.slice(0, 5)}–${m.overlap_end?.slice(0, 5)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="rounded-full border border-border/70 px-2 py-1">
                              {m.status}
                            </span>
                            <span className="text-muted-foreground">
                              {myAccepted ? "✓" : "○"} {lang === "he" ? "אני" : "me"} ·{" "}
                              {theirAccepted ? "✓" : "○"} {lang === "he" ? "הצד השני" : "them"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 max-h-48 overflow-auto space-y-2 rounded-xl border border-border/70 bg-card/25 p-3">
                          {thread.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {lang === "he"
                                ? "כתוב הודעה כדי לבדוק התאמה לפני חשיפת טלפון."
                                : "Send a message before revealing phone numbers."}
                            </p>
                          ) : (
                            thread.map((msg) => (
                              <div
                                key={msg.id}
                                className={`text-sm ${msg.sender_id === user.id ? "text-primary" : "text-foreground"}`}
                              >
                                <span className="text-muted-foreground">
                                  {msg.sender_id === user.id
                                    ? lang === "he"
                                      ? "אני"
                                      : "me"
                                    : (nameById.get(msg.sender_id) ?? "חברותא")}
                                  :{" "}
                                </span>
                                {msg.body}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <input
                            value={messageDraft[m.id] ?? ""}
                            onChange={(e) =>
                              setMessageDraft((d) => ({ ...d, [m.id]: e.target.value }))
                            }
                            placeholder={lang === "he" ? "כתוב הודעה..." : "Write a message..."}
                            className="flex-1 h-10 rounded-xl border border-border bg-background/45 px-3 outline-none"
                          />
                          <button
                            onClick={() => sendMessage.mutate(m.id)}
                            className="h-10 rounded-xl border border-border px-4"
                          >
                            {lang === "he" ? "שלח" : "Send"}
                          </button>
                          {m.status !== "accepted" && (
                            <button
                              onClick={() => accept.mutate(m.id)}
                              className="h-10 rounded-xl bg-primary px-4 text-primary-foreground inline-flex items-center gap-2"
                            >
                              <Check className="h-4 w-4" />
                              {lang === "he" ? "מאשר התאמה" : "Accept"}
                            </button>
                          )}
                          {sourceIntentQ.data ? (
                            <button
                              onClick={() => openStudyRoom.mutate(m.id)}
                              disabled={openStudyRoom.isPending}
                              className="h-10 rounded-xl border border-primary/40 px-4 text-primary inline-flex items-center gap-2 disabled:opacity-50"
                            >
                              <Users className="h-4 w-4" />
                              {lang === "he" ? "פתח לימוד + אודיו" : "Study + audio"}
                            </button>
                          ) : (
                            <Link
                              to="/library"
                              title={
                                lang === "he"
                                  ? "בחר מקור כדי לפתוח חדר לימוד"
                                  : "Pick a source to open a study room"
                              }
                              className="h-10 rounded-xl border border-border px-4 text-muted-foreground inline-flex items-center gap-2"
                            >
                              <Users className="h-4 w-4" />
                              {lang === "he" ? "בחר מקור לחדר לימוד" : "Pick a source for study"}
                            </Link>
                          )}
                        </div>
                        {m.status === "accepted" && (
                          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm inline-flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            {contact
                              ? `${contact.display_name}: ${contact.phone}`
                              : lang === "he"
                                ? "הטלפון יופיע כאן אחרי טעינה."
                                : "Phone will appear here after loading."}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
