
# Havruta Chabad — Build Plan

A bilingual (Hebrew RTL / English LTR) source-reader and AI chavruta for Chabad/Chassidus. Every answer is grounded in sources stored in Lovable Cloud — no external read-on-site flow.

## Stack

- TanStack Start (current template) + Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase) — Postgres + pgvector + Auth
- Lovable AI Gateway — `google/gemini-3-flash-preview` for answers, `google/gemini-embedding-001` (3072-dim) for retrieval
- Server functions (`createServerFn`) for ingestion, search, get-source, and ask-havruta. No Supabase Edge Functions.

## Database (one migration, with GRANTs)

Extensions: `vector`, `pg_trgm`, `unaccent`.

Tables (public schema):

- `sources` — id, source_provider, source_id, title, tree, tree_parts jsonb, content_type, language, text, excerpt, char_count, raw_payload, source_url, sha256, fetched_at, timestamps. Unique `(source_provider, source_id)`. Indexes: GIN tsvector (`hebrew`/`simple` config), trigram on title/tree, btree on char_count.
- `source_chunks` — id, source_id (fk cascade), chunk_index, text, token_count, embedding `vector(3072)`, created_at. Indexes: btree source_id, HNSW vector_cosine_ops, GIN tsvector on text.
- `ask_sessions` — id, user_id (nullable), lang, question, answer, source_ids uuid[], mode, latency_ms, created_at.
- `profiles` — id (fk auth.users), display_name, preferred_lang ('he'|'en'), timestamps. Auto-created via `handle_new_user` trigger.
- `app_role` enum (`admin`, `user`) + `user_roles` table + `has_role(uuid, app_role)` SECURITY DEFINER function.

Bootstrap admin: trigger on `auth.users` insert checks `NEW.email = 'avidandor@gmail.com'` and inserts an `admin` row into `user_roles`; otherwise inserts `user`. Profile row created in same trigger.

RLS + GRANTs for every table:
- `sources`, `source_chunks`: SELECT to anon + authenticated (public reading), INSERT/UPDATE/DELETE only when `has_role(auth.uid(),'admin')`.
- `ask_sessions`: anyone can INSERT; SELECT only own rows or admin.
- `profiles`: own row read/update; admins read all.
- `user_roles`: SELECT authenticated; writes admin-only.

DB RPC: `match_chunks(query_embedding vector(3072), match_count int, min_similarity float)` returning chunk + source metadata + cosine similarity for hybrid retrieval.

## Server functions (`src/lib/*.functions.ts`)

All read `LOVABLE_API_KEY` / `SUPABASE_*` inside handlers. Admin-only fns use `requireSupabaseAuth` middleware + `has_role` check, then dynamically import `@/integrations/supabase/client.server` for service-role writes.

- `ingest-source` (admin) — accepts one source or batch; normalizes whitespace, computes sha256, upserts `sources`, splits text into ~800-char paragraph-aware chunks with 100-char overlap, embeds each chunk via Lovable AI Gateway `/v1/embeddings`, upserts `source_chunks`. Returns `{inserted, updated, chunks, embedded}`.
- `seed-corpus` (admin) — ingests ~10 bundled public-domain Hebrew Chassidus excerpts (Tanya Likutei Amarim 1–5, Kuntres Acharon snippets, Iggeret HaKodesh excerpt, Iggeret HaTeshuvah excerpt, Sha'ar HaYichud opening). Bundled JSON in `src/data/seed-sources.json`.
- `search-sources` (public) — hybrid: Postgres FTS (`websearch_to_tsquery`) on title/tree/text + trigram fallback. Filters `char_count > 200`. Returns top N with excerpt + score.
- `get-source` (public) — returns full source row from `sources` table; no external fetch.
- `ask-havruta` (public, optional auth) — embeds question, calls `match_chunks` (top 8), packs into prompt, calls Gemini with strict system prompt: answer only in requested lang (he/en), only from provided sources, refuse if weak. Post-validates output language (reject CJK/Cyrillic/Arabic chars not in Hebrew block); on reject, retries once with stricter instruction, else returns a safe fallback. Persists to `ask_sessions`. Returns `{answer, sources:[{id,title,tree,excerpt}], mode, latency_ms, lang}`.
- `corpus-stats` (public) — counts sources, chunks, total chars; cached 60s.

## Frontend routes

- `/` — landing app shell: top bar (brand, lang toggle, corpus stats), hero, ask panel, recent answers, search panel below.
- `/auth` — email/password sign-in/up + Google OAuth via Lovable broker.
- `/_authenticated/admin` — admin-only ingestion screen. Non-admins redirected.
- Root route owns `html lang` / `dir` via `head()` based on lang context.

## UI components

- `LanguageProvider` (context + localStorage) — exposes `lang`, `t(key)`, `dir`. Updates `documentElement.lang/dir` on change.
- `i18n.ts` — flat dictionary covering every UI string, placeholder, example chip, loading/error state, reader label.
- `TopBar`, `Hero`, `AskPanel` (textarea + example chips + submit), `AnswerCard` (markdown-safe render of answer + source cards), `SourceCard`, `SearchPanel`, `SearchResultCard`.
- `SourceReader` (shadcn Dialog/Drawer responsive) — title, breadcrumb chips, metadata row, font-size +/- (3 steps stored in localStorage), in-source search with highlighted matches, copy-all button, paragraph-preserving render (`white-space: pre-wrap`, `max-w-prose`, RTL-aware). No external link CTA.
- `YiddishHelper` + `RashiHelper` — deterministic client-side cards with a small built-in dictionary and Rashi-script letter chart (SVG/SVG-font fallback).
- `AdminIngestion` — JSON paste/upload, preview count, run ingest button, progress + result toast, "Seed sample corpus" button.

## Design system

Dark premium scholarly. Tokens in `src/styles.css`:
- background `oklch(0.14 0.01 60)` (near-black warm)
- foreground `oklch(0.95 0.02 80)`
- primary (gold) `oklch(0.78 0.13 80)`
- accent (restrained indigo glow) `oklch(0.55 0.12 280)` used only for subtle ring/glow
- card with thin border + soft inner shadow; gradient utility `--gradient-scholar`
- Fonts via `@fontsource`: `@fontsource/frank-ruhl-libre` (Hebrew serif, headings + Hebrew body), `@fontsource/inter` (English body), `@fontsource/noto-serif-hebrew` fallback. Imported in `src/main.tsx` and registered in styles.css `@theme` font-family vars.
- Mobile: no horizontal overflow (`overflow-x-hidden` on body, `max-w-full` everywhere), reader toolbar wraps, 44px min touch targets, focus rings visible, `prefers-reduced-motion` respected.

## Language behavior

`useLang()` drives:
- `<html dir lang>` via TanStack `head()` + a small effect
- Every text via `t(key)` — no hardcoded English in components
- AI `lang` field on `ask-havruta`
- Example chip set (Hebrew vs English)
- Tailwind logical properties (`ps-*`, `pe-*`, `text-start`) for RTL safety

## Auth

- Email/password + Google (broker `lovable.auth.signInWithOAuth("google", ...)`); call `supabase--configure_social_auth` for google.
- `profiles` + `user_roles` auto-populated by trigger; first signup with `avidandor@gmail.com` becomes admin.
- Anonymous use allowed for search/ask/read. Ingestion requires admin.

## Acceptance verification (run before declaring done)

1. Migration applies cleanly; tables + GRANTs + RLS + trigger + RPC exist.
2. Seed corpus inserts ≥10 sources + chunks + embeddings.
3. Search returns DB rows.
4. Clicking a result opens reader with formatted text.
5. Ask flow returns grounded answer + source cards; non-He/En output is filtered.
6. He mode: RTL, Hebrew copy, Hebrew examples. En mode: LTR, English copy.
7. Mobile (375px viewport via Playwright): no horizontal scroll on home, reader, admin.
8. Admin route gated; non-admin redirected.
9. Build passes.

## Technical notes

- pgvector column sized `vector(3072)` to match `gemini-embedding-001` default; HNSW index `vector_cosine_ops`.
- Embedding calls batched (≤16 inputs/request) inside `ingest-source` handler with retry on 429.
- Chunking: paragraph-first split, then sentence split if chunk > 1500 chars, 100-char overlap, store `chunk_index`.
- `ask-havruta` prompt is fixed server-side; user input only flows in as the question + retrieved context.
- Language guard regex: reject if response contains chars in U+0400–U+04FF, U+0600–U+06FF (Arabic, when lang=he allow Hebrew U+0590–U+05FF only; when lang=en reject any non-Latin/Hebrew script in citations).
- All server fn modules live in `src/lib/`, never `src/server/`. `client.server.ts` imported only inside handlers via `await import(...)`.
- Public routes (`/`) do NOT call protected fns in their loader — ask/search are invoked from components via `useServerFn` + react-query.

## Implementation order

1. Enable Lovable Cloud + provision `LOVABLE_API_KEY`.
2. Migration: extensions, enum, tables, GRANTs, RLS, trigger, RPC.
3. Configure Google social auth.
4. `i18n.ts` + `LanguageProvider` + design tokens + fonts.
5. Server fns: corpus-stats, search-sources, get-source.
6. Ingestion server fn + seed JSON + seed fn.
7. ask-havruta server fn with language guard.
8. UI: TopBar, Hero, AskPanel, SearchPanel, SourceReader, AnswerCard, helpers.
9. Auth pages + `_authenticated/admin` ingestion screen.
10. Auto-trigger seed on first admin visit if corpus empty.
11. Mobile/RTL polish + Playwright verification of acceptance criteria.
