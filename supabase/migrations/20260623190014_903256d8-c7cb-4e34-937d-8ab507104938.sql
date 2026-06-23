-- Live shared chavruta study rooms
CREATE TABLE IF NOT EXISTS public.chavruta_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.chavruta_matches(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_segment_index INTEGER NOT NULL DEFAULT 0 CHECK (current_segment_index >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, source_id)
);

CREATE TABLE IF NOT EXISTS public.chavruta_study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chavruta_study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL CHECK (segment_index >= 0),
  status TEXT NOT NULL DEFAULT 'reading' CHECK (status IN ('reading','confused','understood','answered')),
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, segment_index)
);

CREATE TABLE IF NOT EXISTS public.chavruta_study_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chavruta_study_sessions(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL CHECK (segment_index >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'human' CHECK (kind IN ('human','agent','system')),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 3 AND 1200),
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chavruta_study_sessions_match_idx ON public.chavruta_study_sessions(match_id);
CREATE INDEX IF NOT EXISTS chavruta_study_sessions_source_idx ON public.chavruta_study_sessions(source_id);
CREATE INDEX IF NOT EXISTS chavruta_study_progress_session_idx ON public.chavruta_study_progress(session_id, segment_index);
CREATE INDEX IF NOT EXISTS chavruta_study_questions_session_idx ON public.chavruta_study_questions(session_id, segment_index, created_at);

DROP TRIGGER IF EXISTS chavruta_study_sessions_touch ON public.chavruta_study_sessions;
CREATE TRIGGER chavruta_study_sessions_touch BEFORE UPDATE ON public.chavruta_study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS chavruta_study_progress_touch ON public.chavruta_study_progress;
CREATE TRIGGER chavruta_study_progress_touch BEFORE UPDATE ON public.chavruta_study_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.chavruta_study_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chavruta_study_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chavruta_study_questions TO authenticated;
GRANT ALL ON public.chavruta_study_sessions TO service_role;
GRANT ALL ON public.chavruta_study_progress TO service_role;
GRANT ALL ON public.chavruta_study_questions TO service_role;

ALTER TABLE public.chavruta_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chavruta_study_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chavruta_study_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants read study sessions" ON public.chavruta_study_sessions;
CREATE POLICY "participants read study sessions" ON public.chavruta_study_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chavruta_matches m WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants create study sessions" ON public.chavruta_study_sessions;
CREATE POLICY "participants create study sessions" ON public.chavruta_study_sessions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.chavruta_matches m WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants update study sessions" ON public.chavruta_study_sessions;
CREATE POLICY "participants update study sessions" ON public.chavruta_study_sessions
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chavruta_matches m WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.chavruta_matches m WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants read study progress" ON public.chavruta_study_progress;
CREATE POLICY "participants read study progress" ON public.chavruta_study_progress
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chavruta_study_sessions s JOIN public.chavruta_matches m ON m.id = s.match_id WHERE s.id = session_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants upsert own study progress" ON public.chavruta_study_progress;
CREATE POLICY "participants upsert own study progress" ON public.chavruta_study_progress
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chavruta_study_sessions s JOIN public.chavruta_matches m ON m.id = s.match_id WHERE s.id = session_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants update own study progress" ON public.chavruta_study_progress;
CREATE POLICY "participants update own study progress" ON public.chavruta_study_progress
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chavruta_study_sessions s JOIN public.chavruta_matches m ON m.id = s.match_id WHERE s.id = session_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  ) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "participants read study questions" ON public.chavruta_study_questions;
CREATE POLICY "participants read study questions" ON public.chavruta_study_questions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chavruta_study_sessions s JOIN public.chavruta_matches m ON m.id = s.match_id WHERE s.id = session_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants create study questions" ON public.chavruta_study_questions;
CREATE POLICY "participants create study questions" ON public.chavruta_study_questions
  FOR INSERT TO authenticated WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid()) AND EXISTS (SELECT 1 FROM public.chavruta_study_sessions s JOIN public.chavruta_matches m ON m.id = s.match_id WHERE s.id = session_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "participants update study questions" ON public.chavruta_study_questions;
CREATE POLICY "participants update study questions" ON public.chavruta_study_questions
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chavruta_study_sessions s JOIN public.chavruta_matches m ON m.id = s.match_id WHERE s.id = session_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chavruta_study_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chavruta_study_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chavruta_study_questions;