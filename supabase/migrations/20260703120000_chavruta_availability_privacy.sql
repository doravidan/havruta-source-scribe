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
