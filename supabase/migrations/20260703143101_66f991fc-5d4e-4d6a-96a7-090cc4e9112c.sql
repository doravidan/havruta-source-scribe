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

GRANT SELECT ON public.chavruta_queue TO authenticated;
GRANT ALL ON public.chavruta_queue TO service_role;

ALTER TABLE public.chavruta_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own queue row" ON public.chavruta_queue;
CREATE POLICY "users read own queue row" ON public.chavruta_queue
  FOR SELECT TO authenticated USING (user_id = auth.uid());

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

  SELECT exclude_user_id INTO _prev_partner FROM public.chavruta_queue WHERE user_id = _me;

  INSERT INTO public.chavruta_queue (user_id, lang, status, matched_session_id, exclude_user_id, enqueued_at)
  VALUES (_me, COALESCE(_lang, 'he'), 'waiting', NULL, _prev_partner, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'waiting',
        matched_session_id = NULL,
        lang = EXCLUDED.lang,
        enqueued_at = now();

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