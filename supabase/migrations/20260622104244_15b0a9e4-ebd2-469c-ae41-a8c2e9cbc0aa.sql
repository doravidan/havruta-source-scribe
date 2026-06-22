
-- Fix mutable search_path on remaining functions
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.match_chunks(vector, integer, float) SET search_path = public;

-- Restrict SECURITY DEFINER fns: revoke anon, keep what's needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten ask_sessions INSERT: enforce user_id matches caller (or null for anon)
DROP POLICY IF EXISTS "anyone insert ask" ON public.ask_sessions;
CREATE POLICY "insert own ask" ON public.ask_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
