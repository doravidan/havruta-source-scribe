## Goal

Add a clear "Find me a chavruta" flow on `/chavruta` that ranks candidates by **time zone–aware availability overlap**, **language compatibility**, **learning level**, and **topic overlap**. Reuses the existing `chavruta_profiles`, `chavruta_availability`, `chavruta_matches` schema and the `propose_chavruta_match` RPC — no new RPCs.

## What exists today

- `chavruta_profiles` (display_name, bio, learning_level, preferred_lang, topics, is_active)
- `chavruta_availability` (day_of_week, start_time, end_time — stored as local clock time, no tz)
- `chavruta_matches` + `propose_chavruta_match` / `accept_chavruta_match` RPCs
- Suggestions panel on `/chavruta` already overlaps slots and ranks by topic count, but ignores tz, language, level

Gap: time zone is missing, language and level are not used for filtering/ranking, and there is no dedicated "Find me a chavruta" entry point — it's a passive sidebar.

## Changes

### 1. Migration — add time zone
- Add `time_zone TEXT NOT NULL DEFAULT 'UTC'` to `public.chavruta_profiles` (IANA name, e.g. `Asia/Jerusalem`).
- Backfill existing rows to `'Asia/Jerusalem'`.
- No new GRANTs needed (column added to existing table).

### 2. Profile form (`/chavruta`)
- Add a Time zone `<select>` populated from `Intl.supportedValuesOf('timeZone')`, defaulting to `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Persist via the existing `chavruta_profiles` upsert.

### 3. "Find me a chavruta" panel
- Prominent button + result list at the top of `/chavruta` (above the existing passive suggestions, which we keep).
- Filters (client-side, from `socialQ.data`):
  - **Language**: keep candidate if `their.preferred_lang === mine` OR either side is `both`.
  - **Level**: keep if same level, or one step apart (beginner↔intermediate, intermediate↔advanced).
  - **Time overlap**: convert each side's `{day_of_week, start_time, end_time}` into UTC minute-of-week windows using their profile `time_zone`, then intersect. Handles wrap across days.
  - **Topic**: at least one topic in common preferred but not required (used in scoring, not filter).
- Score = `language_match*3 + level_match*3 + topic_overlap*2 + overlap_minutes/30`.
- Each result shows: name, level, language, topics, and the overlap rendered in **the viewer's local tz** (so "Wed 21:00–22:00 your time"). Buttons: "Propose chavruta" (existing RPC) and "View profile".
- Empty state suggests broadening availability or topics.

### 4. UI copy & i18n
- Hebrew/English strings added to the existing inline `lang === "he"` ternaries in `chavruta.tsx`. No new i18n keys file.

### 5. Out of scope
- No new tables, no edge function, no server function — all matching is client-side over the same data already fetched by `socialQ`.
- No changes to `propose_chavruta_match` / `accept_chavruta_match`.

## Technical notes

- Time zone conversion: build a `Date` for a reference week (e.g. the upcoming Sunday 00:00 in the user's tz), add `day*1440 + minutes`, then read its UTC minute-of-week. Use `Intl.DateTimeFormat` with `timeZone` option for the offset — no extra deps. DST is handled because conversion happens through `Date`.
- Slot times remain stored as local `HH:MM` + `day_of_week` (no schema churn for availability). The tz lives on the profile and is applied at query time.
- Reuse `db` typed client already defined in `chavruta.tsx`.

## Files

- `supabase/migrations/<new>.sql` — add `time_zone` to `chavruta_profiles`.
- `src/routes/chavruta.tsx` — tz select in profile form, new `FindChavrutaPanel` section, tz-aware `overlap()` helper.

## Verification

- Build passes (TS types regenerate after migration).
- Manual: set profile tz to `Asia/Jerusalem`, second account tz `America/New_York` with overlapping evenings — confirm overlap appears in each viewer's local time.
