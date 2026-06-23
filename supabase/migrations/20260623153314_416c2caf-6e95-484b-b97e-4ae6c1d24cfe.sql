-- Make it explicit: no direct UPDATE or DELETE via PostgREST on chavruta_matches.
-- All status transitions must go through the accept_chavruta_match SECURITY DEFINER RPC,
-- which bypasses RLS and enforces its own authorization checks.
CREATE POLICY "no direct updates - use accept_chavruta_match rpc"
  ON public.chavruta_matches
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "no direct deletes on matches"
  ON public.chavruta_matches
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);