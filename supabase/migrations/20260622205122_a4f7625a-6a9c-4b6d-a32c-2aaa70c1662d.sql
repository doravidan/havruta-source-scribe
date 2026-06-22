DROP POLICY IF EXISTS "participants update matches via rpc only" ON public.chavruta_matches;

CREATE POLICY "participants update matches via rpc only"
ON public.chavruta_matches
FOR UPDATE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = suggested_user_id)
WITH CHECK (
  (auth.uid() = requester_id OR auth.uid() = suggested_user_id)
  AND requester_accepted IS NOT DISTINCT FROM (SELECT m.requester_accepted FROM public.chavruta_matches m WHERE m.id = chavruta_matches.id)
  AND suggested_accepted IS NOT DISTINCT FROM (SELECT m.suggested_accepted FROM public.chavruta_matches m WHERE m.id = chavruta_matches.id)
  AND status IS NOT DISTINCT FROM (SELECT m.status FROM public.chavruta_matches m WHERE m.id = chavruta_matches.id)
);