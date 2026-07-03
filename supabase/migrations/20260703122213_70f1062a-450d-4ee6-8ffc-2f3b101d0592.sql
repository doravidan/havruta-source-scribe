CREATE TABLE IF NOT EXISTS public.learning_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('session_started','session_completed','source_studied','streak_milestone')),
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.chavruta_study_sessions(id) ON DELETE SET NULL,
  source_title TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_activity_created_idx ON public.learning_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS learning_activity_user_idx ON public.learning_activity(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.learning_activity TO authenticated;
GRANT ALL ON public.learning_activity TO service_role;
ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read learning activity" ON public.learning_activity;
CREATE POLICY "auth read learning activity" ON public.learning_activity FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users insert own activity" ON public.learning_activity;
CREATE POLICY "users insert own activity" ON public.learning_activity FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.activity_cheers (
  activity_id UUID NOT NULL REFERENCES public.learning_activity(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '🔥' CHECK (char_length(emoji) BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.activity_cheers TO authenticated;
GRANT ALL ON public.activity_cheers TO service_role;
ALTER TABLE public.activity_cheers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read cheers" ON public.activity_cheers;
CREATE POLICY "auth read cheers" ON public.activity_cheers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users insert own cheers" ON public.activity_cheers;
CREATE POLICY "users insert own cheers" ON public.activity_cheers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own cheers" ON public.activity_cheers;
CREATE POLICY "users delete own cheers" ON public.activity_cheers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_community_feed(_limit INTEGER DEFAULT 30)
RETURNS TABLE(
  id UUID, user_id UUID, display_name TEXT, kind TEXT, source_id UUID, session_id UUID,
  source_title TEXT, meta JSONB, created_at TIMESTAMPTZ, cheer_count BIGINT, cheered_by_me BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.user_id,
    COALESCE(p.display_name, 'לומד אנונימי') AS display_name,
    a.kind, a.source_id, a.session_id, a.source_title, a.meta, a.created_at,
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

ALTER TABLE public.learning_activity REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='learning_activity'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_activity';
  END IF;
END $$;