# Chavruta Live Study Interface Plan

> **For Hermes:** Use subagent-driven-development or a gated single-agent loop to implement this plan task-by-task.

**Goal:** Build a simple shared-study room where two matched users can learn the same source together, stay synced on the current text segment, mark understanding, chat/ask questions, and let the AI chavruta generate useful questions after each segment.

**Architecture:** Add a dedicated live-study route on top of existing `chavruta_matches`, `chavruta_messages`, `SourceReader`, and AI helpers. Use Supabase tables for durable session state and Supabase Realtime channels for cursor/segment/presence sync. Keep the first version text-first: no video/voice, no complex whiteboard.

**Tech Stack:** TanStack Start/Router, React 19, Supabase Postgres/RLS/Realtime, existing `chatCompletion`, existing source corpus tables, Tailwind utility CSS.

---

## Current code facts checked

- Current match/chat UI lives in `src/routes/chavruta.tsx`.
- Existing text reader lives in `src/components/source-reader.tsx` and is modal-based.
- Existing AI Q&A lives in `src/lib/ask.functions.ts` and uses `chatCompletion` through `src/lib/ai-gateway.server.ts`.
- Current social tables: `chavruta_profiles`, `chavruta_availability`, `chavruta_matches`, `chavruta_messages`.
- There is no Realtime/presence usage yet in `src/`.
- Existing source-to-chavruta path can pass a source into `/chavruta?source=<sourceId>`.

---

## Product shape

### Core idea

The collaborative learning experience should feel like a clean digital shtender, not a Zoom clone.

Two users open the same study room. The room shows:

1. the source text split into readable segments;
2. both participants’ position and understanding state;
3. a small discussion panel;
4. AI-generated questions after each segment;
5. one obvious next action at any moment.

### Non-goals for version 1

- No video/audio call.
- No screen sharing.
- No free-form document editing.
- No complex whiteboard.
- No multi-person groups beyond the matched chavruta pair.
- No public rooms.

---

## UX direction

### Route

Add:

```text
/chavruta/study/$sessionId
```

Entry points:

- From an accepted/chatting match card: `לימוד משותף`.
- From source-to-chavruta flow: after opening a chat with a selected source, show `פתח חדר לימוד למקור הזה`.
- From `/beit-midrash`: active chavruta sessions list.

### Desktop layout

```text
┌──────────────────────────────────────────────────────────────┐
│ top strip: source title · participants · online status · end  │
├───────────────┬──────────────────────────────┬───────────────┤
│ segments      │ active source text            │ guide panel    │
│ outline       │                              │               │
│               │ [קטע נוכחי highlighted]       │ AI questions   │
│  1 ✓✓          │                              │ understanding  │
│  2 ✓○          │ buttons: הקרא · שאל · הבנתי  │ chat           │
│  3 active      │                              │ next action    │
│  4 locked      │                              │               │
└───────────────┴──────────────────────────────┴───────────────┘
```

### Mobile layout

Use tabs, not squeezed columns:

```text
[טקסט] [שאלות] [שיחה]
```

Sticky bottom action:

```text
הבנתי את הקטע · שאל שאלה · הבא
```

### Main interaction loop

For every segment:

1. both users read the highlighted segment;
2. either user can press `שאל על הקטע`;
3. each user presses `הבנתי` when ready;
4. when both pressed, AI generates 2–3 questions;
5. users answer/discuss briefly;
6. one user presses `המשך לקטע הבא`;
7. room syncs everyone to the next segment.

### Understanding states

Per segment and participant:

- `קורא` — default/currently reading.
- `צריך הסבר` — user is stuck.
- `הבנתי` — ready.
- `נענה` — AI/help question handled.

Visual treatment:

```text
דור: הבנתי ✓
חברותא: צריך הסבר ?
```

If one participant marks `צריך הסבר`, the room should not auto-advance. The guide panel should show:

```text
מה לא ברור?
[מושג] [מהלך] [תרגום] [הקשר]
```

---

## Data model

Create migration:

```text
supabase/migrations/YYYYMMDDHHMMSS_chavruta_live_study.sql
```

### `chavruta_study_sessions`

```sql
create table public.chavruta_study_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.chavruta_matches(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  current_segment_index integer not null default 0,
  status text not null default 'active' check (status in ('active','completed','archived')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_id, source_id)
);
```

### `chavruta_study_progress`

Stores each participant’s state per segment.

```sql
create table public.chavruta_study_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chavruta_study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_index integer not null,
  status text not null default 'reading' check (status in ('reading','confused','understood','answered')),
  note text,
  updated_at timestamptz not null default now(),
  unique(session_id, user_id, segment_index)
);
```

### `chavruta_study_questions`

AI or human questions tied to a segment.

```sql
create table public.chavruta_study_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chavruta_study_sessions(id) on delete cascade,
  segment_index integer not null,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null default 'human' check (kind in ('human','agent','system')),
  question text not null check (char_length(question) between 3 and 1200),
  answer text,
  created_at timestamptz not null default now()
);
```

### RLS

Only participants of the underlying match can read/write session rows.

Use helper condition repeatedly:

```sql
exists (
  select 1 from public.chavruta_matches m
  where m.id = match_id
    and (m.requester_id = auth.uid() or m.suggested_user_id = auth.uid())
)
```

For child tables, join through `chavruta_study_sessions -> chavruta_matches`.

---

## Realtime model

Use Supabase Realtime for instant UI sync.

Channel name:

```ts
const channel = supabase.channel(`chavruta-study:${sessionId}`);
```

Subscribe to:

```ts
postgres_changes on chavruta_study_sessions where id=sessionId
postgres_changes on chavruta_study_progress where session_id=sessionId
postgres_changes on chavruta_study_questions where session_id=sessionId
broadcast: cursor
broadcast: typing
presence: online users
```

Broadcast payloads:

```ts
type CursorBroadcast = {
  userId: string;
  segmentIndex: number;
  scrollPct: number;
};

type TypingBroadcast = {
  userId: string;
  area: 'chat' | 'question';
  active: boolean;
};
```

Realtime is for immediacy. Postgres rows remain the source of truth.

---

## Text segmentation

For version 1, segment on the client/server from source text, no separate segments table.

Create:

```text
src/lib/source-segments.ts
```

Rules:

1. strip HTML tags safely or reuse parsed text output if available;
2. split by paragraphs first;
3. if paragraph is too long, split by sentence-ish punctuation;
4. target 450–900 Hebrew chars per segment;
5. keep original order and stable index.

Type:

```ts
export type StudySegment = {
  index: number;
  title: string;
  text: string;
  charCount: number;
};
```

---

## AI guide behavior

Create server function:

```text
src/lib/chavruta-study.functions.ts
```

Functions:

```ts
createStudySession({ matchId, sourceId })
getStudySession({ sessionId })
setSegmentStatus({ sessionId, segmentIndex, status, note? })
advanceSegment({ sessionId, nextSegmentIndex })
generateSegmentQuestions({ sessionId, segmentIndex })
askSegmentQuestion({ sessionId, segmentIndex, question })
```

### `generateSegmentQuestions`

Prompt shape:

```text
אתה מנחה לימוד חסידות חב״ד בחברותא.
קבל קטע מקור אחד, וכתוב 3 שאלות קצרות:
1. שאלת הבנה פשוטה
2. שאלת דיוק במילים/מבנה
3. שאלת העמקה או יישום בעבודת ה׳
אל תמציא מעבר לקטע. אם חסר הקשר, אמור זאת בעדינות.
ענה בעברית בלבד.

קטע:
...
```

Output should be structured JSON internally if possible:

```ts
{
  questions: [
    { type: 'comprehension', text: '...' },
    { type: 'precision', text: '...' },
    { type: 'reflection', text: '...' }
  ]
}
```

If model fails, deterministic fallback:

```text
מה המהלך המרכזי בקטע הזה?
איזו מילה או ביטוי צריך לדייק כאן?
איך היית מסביר את הקטע לחברותא במילים שלך?
```

### When to auto-generate

Trigger when:

- both participants marked current segment `understood`, OR
- one participant presses `שאל אותנו על הקטע`, OR
- user opens guide panel and no questions exist yet.

Do not generate repeatedly. Cache in `chavruta_study_questions` with `kind='agent'`.

---

## UI components

Create directory:

```text
src/components/chavruta-study/
```

Components:

```text
StudyRoomShell.tsx
StudyTopStrip.tsx
SegmentOutline.tsx
SharedSourcePane.tsx
UnderstandingControls.tsx
GuidePanel.tsx
StudyChatPanel.tsx
PresencePills.tsx
MobileStudyTabs.tsx
```

### `StudyRoomShell`

Owns:

- session data query;
- source fetch;
- segmentation;
- realtime subscriptions;
- active segment state;
- mobile tab state.

### `SharedSourcePane`

Shows:

- current segment large and readable;
- previous/next segment previews lightly faded;
- active participant cursor markers;
- buttons: `הקרא`, `שאל`, `הבנתי`, `צריך הסבר`.

### `GuidePanel`

Shows:

- AI questions for current segment;
- manual “generate questions” button;
- ask-the-agent input scoped to current segment;
- concise answer cards;
- “mark answered” action.

### `StudyChatPanel`

Reuse `chavruta_messages` for now, but display inside the room. Later, if needed, split study-specific messages into a separate table.

---

## Route integration

Add:

```text
src/routes/chavruta.study.$sessionId.tsx
```

or if TanStack file naming is awkward:

```text
src/routes/chavruta-study.$sessionId.tsx
```

Preferred URL:

```text
/chavruta/study/$sessionId
```

If nested routing becomes messy, use:

```text
/study/$sessionId
```

### Changes in `src/routes/chavruta.tsx`

For every match card:

- if source intent exists, add `צור חדר לימוד למקור הזה`;
- if match has accepted/chatting status, show `פתח לימוד משותף`;
- on click, call `createStudySession({ matchId, sourceId })`, then navigate.

Source selection fallback:

- If match has no source, open a compact source picker/search before creating session.

---

## Visual design

Keep current warm editorial system, but make study room more focused:

- background: parchment, not dark;
- center text pane should feel like a page on a shtender;
- side panels subdued, not equal visual weight;
- one primary action at a time;
- no decorative AI sparkles;
- use status colors sparingly:
  - green/moss: understood/online;
  - oxblood: needs explanation/current attention;
  - saffron: AI guide/questions.

Desktop hierarchy:

1. active text segment;
2. current action controls;
3. AI guide questions;
4. chat;
5. outline.

Mobile hierarchy:

1. text;
2. sticky action bar;
3. questions;
4. chat.

---

## Implementation tasks

### Task 1: Add DB migration for live study tables

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_chavruta_live_study.sql`
- Modify: `src/integrations/supabase/types.ts` after Supabase type generation/manual sync if needed.

**Verify:**

```bash
./scripts/check_chavruta_db.sh
```

If DB env vars are unavailable locally, at least run SQL lint by inspection and verify build after type updates.

### Task 2: Add source segmentation utility

**Files:**

- Create: `src/lib/source-segments.ts`

**Tests/manual gate:**

- Run a small Node/Bun script over a known source text.
- Confirm segments are stable and readable.

### Task 3: Add study server functions

**Files:**

- Create: `src/lib/chavruta-study.functions.ts`

Functions:

- `createStudySession`
- `getStudySession`
- `setSegmentStatus`
- `advanceSegment`
- `generateSegmentQuestions`
- `askSegmentQuestion`

**Gate:**

```bash
bunx eslint src/lib/chavruta-study.functions.ts
bun run build
```

### Task 4: Build room route skeleton

**Files:**

- Create: `src/routes/chavruta-study.$sessionId.tsx` or supported route equivalent.
- Create: `src/components/chavruta-study/StudyRoomShell.tsx`

**Gate:**

- route loads for fake session id and shows auth/empty/error cleanly;
- no mobile overflow.

### Task 5: Build shared source pane

**Files:**

- Create: `SharedSourcePane.tsx`
- Create: `UnderstandingControls.tsx`
- Create: `SegmentOutline.tsx`

**Gate:**

- current segment visually highlighted;
- next/prev works locally;
- status buttons update via server function.

### Task 6: Add Realtime presence and sync

**Files:**

- Modify: `StudyRoomShell.tsx`
- Create: `src/hooks/use-study-room-realtime.ts`

**Gate:**

- open two browser contexts;
- changing segment in one updates the other;
- presence pills show both users when authenticated test users are available.

### Task 7: Add AI guide panel

**Files:**

- Create: `GuidePanel.tsx`
- Modify: `src/lib/chavruta-study.functions.ts`

**Gate:**

- generating questions creates `chavruta_study_questions` rows;
- repeated opening does not duplicate agent questions;
- fallback questions appear if model errors.

### Task 8: Integrate from match cards

**Files:**

- Modify: `src/routes/chavruta.tsx`

**Gate:**

- match card creates/opens a study room;
- source intent flow creates room with selected source;
- no regression in existing chat/match UI.

### Task 9: Full QA

Run:

```bash
bunx eslint src/routes/chavruta.tsx src/routes/chavruta-study.$sessionId.tsx src/components/chavruta-study/*.tsx src/lib/chavruta-study.functions.ts src/lib/source-segments.ts
bun run build
python3 scripts/playwright_qa.py
```

Browser QA:

- `/`
- `/chavruta`
- `/study/<session>` or `/chavruta/study/<session>`
- `/beit-midrash`
- mobile 390px
- desktop 1440px

---

## Acceptance criteria

The feature is successful when:

- a matched pair can open a room for one source;
- both see the same source and current segment;
- pressing next/current status syncs between clients;
- each participant can mark `הבנתי` or `צריך הסבר`;
- AI can generate 2–3 useful questions for the active segment;
- users can ask the AI a question scoped to that segment;
- chat remains available in the same room;
- mobile layout is usable with tabs and no horizontal overflow;
- all changed files pass targeted lint and build.

---

## Recommended phase-1 scope

Build this first:

1. DB tables + RLS.
2. `/study/:sessionId` route.
3. Source text segmented locally.
4. Current segment sync.
5. `הבנתי / צריך הסבר` per user.
6. AI question generation per segment.
7. Chat panel using existing `chavruta_messages`.

Skip for later:

- audio/video;
- group rooms;
- saved notes export;
- complex scheduling inside the room;
- fine-grained word-level cursor sync.

This keeps the product simple and immediately useful.
