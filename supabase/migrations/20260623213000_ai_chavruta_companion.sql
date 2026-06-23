-- Allow a user to open a private AI chavruta study room when no human match is available.
-- Human rooms keep using chavruta_matches; AI rooms have match_id = null and are owned by created_by.

ALTER TABLE public.chavruta_study_sessions
  ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE public.chavruta_study_sessions
  ADD COLUMN IF NOT EXISTS companion_type TEXT NOT NULL DEFAULT 'human'
  CHECK (companion_type IN ('human','ai'));

CREATE UNIQUE INDEX IF NOT EXISTS chavruta_ai_study_sessions_user_source_idx
  ON public.chavruta_study_sessions(created_by, source_id)
  WHERE companion_type = 'ai';

DROP POLICY IF EXISTS "participants read study sessions" ON public.chavruta_study_sessions;
CREATE POLICY "participants read study sessions" ON public.chavruta_study_sessions
  FOR SELECT TO authenticated USING (
    (companion_type = 'ai' AND created_by = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.chavruta_matches m
      WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "participants create study sessions" ON public.chavruta_study_sessions;
CREATE POLICY "participants create study sessions" ON public.chavruta_study_sessions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND (
      companion_type = 'ai' OR
      EXISTS (
        SELECT 1 FROM public.chavruta_matches m
        WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "participants update study sessions" ON public.chavruta_study_sessions;
CREATE POLICY "participants update study sessions" ON public.chavruta_study_sessions
  FOR UPDATE TO authenticated USING (
    (companion_type = 'ai' AND created_by = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.chavruta_matches m
      WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid())
    )
  ) WITH CHECK (
    (companion_type = 'ai' AND created_by = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.chavruta_matches m
      WHERE m.id = match_id AND (m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "participants read study progress" ON public.chavruta_study_progress;
CREATE POLICY "participants read study progress" ON public.chavruta_study_progress
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chavruta_study_sessions s
      LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
      WHERE s.id = session_id AND (
        (s.companion_type = 'ai' AND s.created_by = auth.uid()) OR
        m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "participants upsert own study progress" ON public.chavruta_study_progress;
CREATE POLICY "participants upsert own study progress" ON public.chavruta_study_progress
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chavruta_study_sessions s
      LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
      WHERE s.id = session_id AND (
        (s.companion_type = 'ai' AND s.created_by = auth.uid()) OR
        m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "participants update own study progress" ON public.chavruta_study_progress;
CREATE POLICY "participants update own study progress" ON public.chavruta_study_progress
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chavruta_study_sessions s
      LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
      WHERE s.id = session_id AND (
        (s.companion_type = 'ai' AND s.created_by = auth.uid()) OR
        m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()
      )
    )
  ) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "participants read study questions" ON public.chavruta_study_questions;
CREATE POLICY "participants read study questions" ON public.chavruta_study_questions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chavruta_study_sessions s
      LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
      WHERE s.id = session_id AND (
        (s.companion_type = 'ai' AND s.created_by = auth.uid()) OR
        m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "participants create study questions" ON public.chavruta_study_questions;
CREATE POLICY "participants create study questions" ON public.chavruta_study_questions
  FOR INSERT TO authenticated WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid()) AND EXISTS (
      SELECT 1 FROM public.chavruta_study_sessions s
      LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
      WHERE s.id = session_id AND (
        (s.companion_type = 'ai' AND s.created_by = auth.uid()) OR
        m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "participants update study questions" ON public.chavruta_study_questions;
CREATE POLICY "participants update study questions" ON public.chavruta_study_questions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chavruta_study_sessions s
      LEFT JOIN public.chavruta_matches m ON m.id = s.match_id
      WHERE s.id = session_id AND (
        (s.companion_type = 'ai' AND s.created_by = auth.uid()) OR
        m.requester_id = auth.uid() OR m.suggested_user_id = auth.uid()
      )
    )
  );
