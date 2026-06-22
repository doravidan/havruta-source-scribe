DROP POLICY IF EXISTS "participants update matches via rpc only" ON public.chavruta_matches;
-- Direct UPDATEs from participants are no longer allowed; all mutations must go
-- through SECURITY DEFINER RPCs (accept_chavruta_match, propose_chavruta_match).
-- No UPDATE policy is created for authenticated users, so PostgREST UPDATEs
-- against this table will be denied. The RPCs run as definer and bypass RLS.
