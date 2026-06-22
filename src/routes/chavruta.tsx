import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/top-bar";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Check, Clock, MessageCircle, Phone, Plus, Users, X } from "lucide-react";

export const Route = createFileRoute("/chavruta")({
  head: () => ({
    meta: [
      { title: "חברותות — חסידותא" },
      { name: "description", content: "מצא חברותא ללימוד חסידות לפי זמני לימוד וזמינות שבועית." },
    ],
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

function ChavrutaPage() {
  const { user, loading } = useAuth();
  const { lang, dir } = useLang();
  const qc = useQueryClient();
  const days = lang === "he" ? dayHe : dayEn;
  const [newSlot, setNewSlot] = useState({ day: 0, start: "20:00", end: "21:00" });
  const [topicInput, setTopicInput] = useState(defaultTopics.join(", "));
  const [messageDraft, setMessageDraft] = useState<Record<string, string>>({});

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
        const { data } = await db.rpc("get_chavruta_match_contact", { _match_id: m.id });
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
                    <button onClick={() => removeSlot.mutate(s.id)}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-6 min-w-0">
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
