CREATE TABLE IF NOT EXISTS public.study_progress (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id  uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  section    text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_progress TO authenticated;
GRANT ALL ON public.study_progress TO service_role;

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_progress_select_own" ON public.study_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "study_progress_insert_own" ON public.study_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_progress_delete_own" ON public.study_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_progress_user_date
  ON public.study_progress (user_id, completed_at DESC);

CREATE OR REPLACE FUNCTION public.study_section_counts(_user_id uuid)
RETURNS TABLE(section text, total bigint, done bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(s.tree_parts->>0, ''), 'Other') AS section,
         COUNT(*)::bigint AS total,
         COUNT(sp.source_id)::bigint AS done
  FROM public.sources s
  LEFT JOIN public.study_progress sp
    ON sp.source_id = s.id AND sp.user_id = _user_id
  GROUP BY 1
  ORDER BY done DESC, total DESC
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.study_section_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.study_active_dates(_user_id uuid)
RETURNS TABLE(d date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
  FROM public.study_progress
  WHERE user_id = _user_id
  ORDER BY d DESC
  LIMIT 365;
$$;

GRANT EXECUTE ON FUNCTION public.study_active_dates(uuid) TO authenticated;