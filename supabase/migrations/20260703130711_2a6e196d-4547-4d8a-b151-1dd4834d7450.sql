
-- 1. learning_activity: restrict SELECT to own rows
DROP POLICY IF EXISTS "auth read learning activity" ON public.learning_activity;
CREATE POLICY "own learning activity read" ON public.learning_activity
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. activity_cheers: restrict SELECT to own rows (feed aggregates via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "auth read cheers" ON public.activity_cheers;
CREATE POLICY "own cheers read" ON public.activity_cheers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. ai_usage_buckets: allow users to read their own quota
CREATE POLICY "own usage read" ON public.ai_usage_buckets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_chavruta_matching_slots() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_study_realtime_channel(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_ai_rate_limit(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_community_feed(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.get_chavruta_matching_slots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_study_realtime_channel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_feed(integer) TO authenticated;
