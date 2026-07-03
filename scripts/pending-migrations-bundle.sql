-- Close forged-match PII leak: all chavruta_matches writes must go through SECURITY DEFINER RPCs.
-- Also restore the hardened contact-reveal function (203000 had regressed it).

-- Remove permissive policies that allow direct INSERT/UPDATE.
DROP POLICY IF EXISTS "users create own matches" ON public.chavruta_matches;
DROP POLICY IF EXISTS "participants update matches" ON public.chavruta_matches;
DROP POLICY IF EXISTS "participants update matches via rpc only" ON public.chavruta_matches;

-- Block direct PostgREST mutations; RPCs run as definer and bypass RLS.
REVOKE INSERT, UPDATE, DELETE ON public.chavruta_matches FROM authenticated;

-- Idempotent restrictive deny policies (153314 may already have created these).
DROP POLICY IF EXISTS "no direct updates - use accept_chavruta_match rpc" ON public.chavruta_matches;
CREATE POLICY "no direct updates - use accept_chavruta_match rpc"
  ON public.chavruta_matches
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "no direct deletes on matches" ON public.chavruta_matches;
CREATE POLICY "no direct deletes on matches"
  ON public.chavruta_matches
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

-- Require both-sided acceptance before revealing contact info.
CREATE OR REPLACE FUNCTION public.get_chavruta_match_contact(_match_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH m AS (
    SELECT * FROM public.chavruta_matches
    WHERE id = _match_id
      AND status = 'accepted'
      AND requester_accepted = true
      AND suggested_accepted = true
      AND (requester_id = auth.uid() OR suggested_user_id = auth.uid())
  ), other_user AS (
    SELECT CASE WHEN requester_id = auth.uid() THEN suggested_user_id ELSE requester_id END AS id FROM m
  )
  SELECT p.user_id, p.display_name, c.phone
  FROM other_user o
  JOIN public.chavruta_profiles p ON p.user_id = o.id
  JOIN public.chavruta_contact_info c ON c.user_id = o.id;
$function$;

-- Indexes for common RLS / lookup patterns.
CREATE INDEX IF NOT EXISTS chavruta_matches_suggested_user_idx ON public.chavruta_matches(suggested_user_id);
CREATE INDEX IF NOT EXISTS chavruta_messages_sender_idx ON public.chavruta_messages(sender_id);
CREATE INDEX IF NOT EXISTS chavruta_study_progress_user_idx ON public.chavruta_study_progress(user_id);
CREATE INDEX IF NOT EXISTS chavruta_study_questions_created_by_idx ON public.chavruta_study_questions(created_by);
-- Per-user AI usage buckets for rate limiting expensive model calls.

CREATE TABLE IF NOT EXISTS public.ai_usage_buckets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);

ALTER TABLE public.ai_usage_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_usage_buckets FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.ai_usage_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  _bucket TEXT,
  _max_per_window INTEGER,
  _window_seconds INTEGER DEFAULT 3600
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _window_start TIMESTAMPTZ;
  _count INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _max_per_window < 1 OR _window_seconds < 60 THEN
    RAISE EXCEPTION 'invalid_rate_limit_config';
  END IF;

  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.ai_usage_buckets (user_id, bucket, window_start, count)
  VALUES (_uid, _bucket, _window_start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET count = public.ai_usage_buckets.count + 1
  RETURNING count INTO _count;

  RETURN _count <= _max_per_window;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;
-- Add halfvec column + HNSW index for scalable semantic search at 3072 dimensions.

ALTER TABLE public.source_chunks
  ADD COLUMN IF NOT EXISTS embedding_half halfvec(3072);

UPDATE public.source_chunks
SET embedding_half = embedding::halfvec(3072)
WHERE embedding IS NOT NULL AND embedding_half IS NULL;

CREATE OR REPLACE FUNCTION public.sync_source_chunk_embedding_half()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    NEW.embedding_half := NEW.embedding::halfvec(3072);
  ELSE
    NEW.embedding_half := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS source_chunks_embedding_half_sync ON public.source_chunks;
CREATE TRIGGER source_chunks_embedding_half_sync
  BEFORE INSERT OR UPDATE OF embedding ON public.source_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_source_chunk_embedding_half();

CREATE INDEX IF NOT EXISTS source_chunks_embedding_half_hnsw_idx
  ON public.source_chunks
  USING hnsw (embedding_half halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  match_count INTEGER DEFAULT 8,
  min_similarity FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  chunk_index INTEGER,
  text TEXT,
  similarity FLOAT,
  title TEXT,
  tree TEXT,
  tree_parts JSONB,
  language TEXT
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT c.id, c.source_id, c.chunk_index, c.text,
         1 - (c.embedding_half <=> query_embedding::halfvec(3072)) AS similarity,
         s.title, s.tree, s.tree_parts, s.language
  FROM public.source_chunks c
  JOIN public.sources s ON s.id = c.source_id
  WHERE c.embedding_half IS NOT NULL
    AND 1 - (c.embedding_half <=> query_embedding::halfvec(3072)) >= min_similarity
  ORDER BY c.embedding_half <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer, float) TO anon, authenticated;
-- Authorize Realtime broadcast/presence channels for study session participants only.

CREATE OR REPLACE FUNCTION public.can_access_study_realtime_channel(_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chavruta_study_sessions s
    LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
    WHERE (
      _topic = 'chavruta-audio:' || s.id::text
      OR _topic = 'chavruta-presence:' || s.id::text
    )
    AND auth.uid() IS NOT NULL
    AND (
      (s.companion_type = 'ai' AND s.created_by = auth.uid())
      OR m.requester_id = auth.uid()
      OR m.suggested_user_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_study_realtime_channel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_study_realtime_channel(text) TO authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study participants read realtime" ON realtime.messages;
CREATE POLICY "study participants read realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.can_access_study_realtime_channel(realtime.topic())
  );

DROP POLICY IF EXISTS "study participants send realtime" ON realtime.messages;
CREATE POLICY "study participants send realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.can_access_study_realtime_channel(realtime.topic())
  );
-- Restrict availability reads to own rows; expose schedule (without notes) via RPC for matching.

DROP POLICY IF EXISTS "auth read chavruta availability" ON public.chavruta_availability;

CREATE POLICY "users read own availability" ON public.chavruta_availability
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_chavruta_matching_slots()
RETURNS TABLE(
  user_id uuid,
  day_of_week integer,
  start_time time,
  end_time time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id, a.day_of_week, a.start_time, a.end_time
  FROM public.chavruta_availability a
  INNER JOIN public.chavruta_profiles p ON p.user_id = a.user_id
  WHERE a.is_havruta_available = true
    AND p.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_chavruta_matching_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chavruta_matching_slots() TO authenticated;
-- Batch contact reveal for accepted matches (one round-trip instead of N RPC calls).

CREATE OR REPLACE FUNCTION public.get_chavruta_match_contacts(_match_ids uuid[])
 RETURNS TABLE(match_id uuid, user_id uuid, display_name text, phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    m.id AS match_id,
    p.user_id,
    p.display_name,
    c.phone
  FROM public.chavruta_matches m
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN m.requester_id = auth.uid() THEN m.suggested_user_id
      ELSE m.requester_id
    END AS other_id
  ) o
  JOIN public.chavruta_profiles p ON p.user_id = o.other_id
  JOIN public.chavruta_contact_info c ON c.user_id = o.other_id
  WHERE m.id = ANY(_match_ids)
    AND m.status = 'accepted'
    AND m.requester_accepted = true
    AND m.suggested_accepted = true
    AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid());
$function$;

REVOKE EXECUTE ON FUNCTION public.get_chavruta_match_contacts(uuid[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chavruta_match_contacts(uuid[]) TO authenticated;


-- ============================================================
-- 20260703150000_social_learning.sql
-- ============================================================

-- Social learning layer: community activity feed + cheers.
-- Feeds "who is learning what" into a shared timeline, with lightweight reactions.

CREATE TABLE IF NOT EXISTS public.learning_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'session_started',
    'session_completed',
    'source_studied',
    'streak_milestone'
  )),
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.chavruta_study_sessions(id) ON DELETE SET NULL,
  source_title TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_activity_created_idx
  ON public.learning_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS learning_activity_user_idx
  ON public.learning_activity(user_id, created_at DESC);

ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.learning_activity TO authenticated;
GRANT ALL ON public.learning_activity TO service_role;

DROP POLICY IF EXISTS "auth read learning activity" ON public.learning_activity;
CREATE POLICY "auth read learning activity" ON public.learning_activity
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users insert own activity" ON public.learning_activity;
CREATE POLICY "users insert own activity" ON public.learning_activity
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Cheers: one row per (activity, user). Toggled on/off.
CREATE TABLE IF NOT EXISTS public.activity_cheers (
  activity_id UUID NOT NULL REFERENCES public.learning_activity(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '🔥' CHECK (char_length(emoji) BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);

ALTER TABLE public.activity_cheers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.activity_cheers TO authenticated;
GRANT ALL ON public.activity_cheers TO service_role;

DROP POLICY IF EXISTS "auth read cheers" ON public.activity_cheers;
CREATE POLICY "auth read cheers" ON public.activity_cheers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users insert own cheers" ON public.activity_cheers;
CREATE POLICY "users insert own cheers" ON public.activity_cheers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own cheers" ON public.activity_cheers;
CREATE POLICY "users delete own cheers" ON public.activity_cheers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Feed RPC: activity + display name + cheer count + whether caller cheered.
-- SECURITY DEFINER so display names resolve even for inactive profiles.
CREATE OR REPLACE FUNCTION public.get_community_feed(_limit INTEGER DEFAULT 30)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  display_name TEXT,
  kind TEXT,
  source_id UUID,
  session_id UUID,
  source_title TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ,
  cheer_count BIGINT,
  cheered_by_me BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.user_id,
    COALESCE(p.display_name, 'לומד אנונימי') AS display_name,
    a.kind,
    a.source_id,
    a.session_id,
    a.source_title,
    a.meta,
    a.created_at,
    COUNT(c.user_id) AS cheer_count,
    BOOL_OR(c.user_id = auth.uid()) IS TRUE AS cheered_by_me
  FROM public.learning_activity a
  LEFT JOIN public.chavruta_profiles p ON p.user_id = a.user_id
  LEFT JOIN public.activity_cheers c ON c.activity_id = a.id
  WHERE auth.uid() IS NOT NULL
  GROUP BY a.id, p.display_name
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_community_feed(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_feed(INTEGER) TO authenticated;

-- Realtime: feed updates push to connected clients.
ALTER TABLE public.learning_activity REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'learning_activity'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_activity';
  END IF;
END
$$;


-- ============================================================
-- 20260703160000_instant_chavruta.sql
-- ============================================================

-- Instant chavruta: Omegle-style live matching queue.
-- One row per user; SECURITY DEFINER RPCs pair the two oldest waiters atomically.

CREATE TABLE IF NOT EXISTS public.chavruta_queue (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he','en')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','matched')),
  matched_session_id UUID REFERENCES public.chavruta_study_sessions(id) ON DELETE SET NULL,
  exclude_user_id UUID,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chavruta_queue_waiting_idx
  ON public.chavruta_queue(enqueued_at)
  WHERE status = 'waiting';

ALTER TABLE public.chavruta_queue ENABLE ROW LEVEL SECURITY;

-- Users may only see their own queue row (matched_session_id arrives via realtime on it).
GRANT SELECT ON public.chavruta_queue TO authenticated;
GRANT ALL ON public.chavruta_queue TO service_role;

DROP POLICY IF EXISTS "users read own queue row" ON public.chavruta_queue;
CREATE POLICY "users read own queue row" ON public.chavruta_queue
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Join the queue and try to pair immediately.
-- Returns: {status:'waiting'} or {status:'matched', session_id, match_id}
CREATE OR REPLACE FUNCTION public.join_instant_chavruta(_lang TEXT DEFAULT 'he')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _partner UUID;
  _left UUID;
  _right UUID;
  _match_id UUID;
  _source_id UUID;
  _source_title TEXT;
  _session_id UUID;
  _prev_partner UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Remember who we skipped so "next" doesn't instantly re-pair the same two.
  SELECT exclude_user_id INTO _prev_partner FROM public.chavruta_queue WHERE user_id = _me;

  INSERT INTO public.chavruta_queue (user_id, lang, status, matched_session_id, exclude_user_id, enqueued_at)
  VALUES (_me, COALESCE(_lang, 'he'), 'waiting', NULL, _prev_partner, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'waiting',
        matched_session_id = NULL,
        lang = EXCLUDED.lang,
        enqueued_at = now();

  -- Grab the oldest compatible waiter (not me, not mutually excluded).
  SELECT q.user_id INTO _partner
  FROM public.chavruta_queue q
  WHERE q.status = 'waiting'
    AND q.user_id <> _me
    AND (q.exclude_user_id IS NULL OR q.exclude_user_id <> _me)
    AND (_prev_partner IS NULL OR q.user_id <> _prev_partner)
    AND q.enqueued_at > now() - interval '10 minutes'
  ORDER BY q.enqueued_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _partner IS NULL THEN
    RETURN jsonb_build_object('status', 'waiting');
  END IF;

  -- Random study-worthy source for the pair.
  SELECT s.id, s.title INTO _source_id, _source_title
  FROM public.sources s
  WHERE s.char_count BETWEEN 900 AND 9000
    AND s.language = 'he'
    AND s.title !~ '(תוכן|מפתח|שער|לוח)'
  ORDER BY random()
  LIMIT 1;

  IF _source_id IS NULL THEN
    SELECT s.id, s.title INTO _source_id, _source_title
    FROM public.sources s
    WHERE s.char_count >= 500
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF _source_id IS NULL THEN
    RAISE EXCEPTION 'no_sources_available';
  END IF;

  _left := LEAST(_me, _partner);
  _right := GREATEST(_me, _partner);

  INSERT INTO public.chavruta_matches (requester_id, suggested_user_id, status, overlap_day, overlap_start, overlap_end)
  VALUES (_left, _right, 'chatting', EXTRACT(dow FROM now())::int, now()::time, (now() + interval '1 hour')::time)
  ON CONFLICT (requester_id, suggested_user_id) DO UPDATE
    SET status = CASE
          WHEN public.chavruta_matches.status IN ('declined','cancelled') THEN 'chatting'
          ELSE public.chavruta_matches.status
        END,
        updated_at = now()
  RETURNING id INTO _match_id;

  INSERT INTO public.chavruta_study_sessions (match_id, source_id, created_by, companion_type, title)
  VALUES (_match_id, _source_id, _me, 'human', _source_title)
  ON CONFLICT (match_id, source_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO _session_id;

  UPDATE public.chavruta_queue
  SET status = 'matched', matched_session_id = _session_id, exclude_user_id = _me
  WHERE user_id = _partner;

  UPDATE public.chavruta_queue
  SET status = 'matched', matched_session_id = _session_id, exclude_user_id = _partner
  WHERE user_id = _me;

  RETURN jsonb_build_object('status', 'matched', 'session_id', _session_id, 'match_id', _match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_instant_chavruta()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.chavruta_queue WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.instant_chavruta_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
       'status', q.status,
       'session_id', q.matched_session_id,
       'waiting_count', (SELECT count(*) FROM public.chavruta_queue w
                         WHERE w.status = 'waiting'
                           AND w.enqueued_at > now() - interval '10 minutes')
     )
     FROM public.chavruta_queue q WHERE q.user_id = auth.uid()),
    jsonb_build_object(
      'status', 'idle',
      'session_id', NULL,
      'waiting_count', (SELECT count(*) FROM public.chavruta_queue w
                        WHERE w.status = 'waiting'
                          AND w.enqueued_at > now() - interval '10 minutes')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.join_instant_chavruta(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_instant_chavruta() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.instant_chavruta_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_instant_chavruta(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_instant_chavruta() TO authenticated;
GRANT EXECUTE ON FUNCTION public.instant_chavruta_status() TO authenticated;

-- Realtime: waiting clients learn about their match via their own queue row update.
ALTER TABLE public.chavruta_queue REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chavruta_queue'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chavruta_queue';
  END IF;
END
$$;
