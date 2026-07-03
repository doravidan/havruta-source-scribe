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
