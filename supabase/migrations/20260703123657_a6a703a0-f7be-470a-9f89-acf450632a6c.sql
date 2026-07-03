-- 1) Authorize Realtime broadcast/presence channels for study session participants only.
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

-- 2) Restrict availability reads to own rows; expose schedule (without notes) via RPC.
DROP POLICY IF EXISTS "auth read chavruta availability" ON public.chavruta_availability;

DROP POLICY IF EXISTS "users read own availability" ON public.chavruta_availability;
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

-- 3) Batch contact reveal for accepted matches.
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