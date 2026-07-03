-- Close forged-match PII leak: all chavruta_matches writes must go through SECURITY DEFINER RPCs.
-- Also restore the hardened contact-reveal function (203000 had regressed it).

-- Remove permissive policies that allow direct INSERT/UPDATE.
DROP POLICY IF EXISTS "users create own matches" ON public.chavruta_matches;
DROP POLICY IF EXISTS "participants update matches" ON public.chavruta_matches;
DROP POLICY IF EXISTS "participants update matches via rpc only" ON public.chavruta_matches;

-- Block direct PostgREST mutations; RPCs run as definer and bypass RLS.
REVOKE INSERT, UPDATE, DELETE ON public.chavruta_matches FROM authenticated;

-- Idempotent restrictive deny policies (153314 may already have created these).
DROP POLICY IF EXISTS "no direct updates - use accept_chavruta_match rpc" ON public.chavruta_matches;
CREATE POLICY "no direct updates - use accept_chavruta_match rpc"
  ON public.chavruta_matches
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "no direct deletes on matches" ON public.chavruta_matches;
CREATE POLICY "no direct deletes on matches"
  ON public.chavruta_matches
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

-- Require both-sided acceptance before revealing contact info.
CREATE OR REPLACE FUNCTION public.get_chavruta_match_contact(_match_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH m AS (
    SELECT * FROM public.chavruta_matches
    WHERE id = _match_id
      AND status = 'accepted'
      AND requester_accepted = true
      AND suggested_accepted = true
      AND (requester_id = auth.uid() OR suggested_user_id = auth.uid())
  ), other_user AS (
    SELECT CASE WHEN requester_id = auth.uid() THEN suggested_user_id ELSE requester_id END AS id FROM m
  )
  SELECT p.user_id, p.display_name, c.phone
  FROM other_user o
  JOIN public.chavruta_profiles p ON p.user_id = o.id
  JOIN public.chavruta_contact_info c ON c.user_id = o.id;
$function$;

-- Indexes for common RLS / lookup patterns.
CREATE INDEX IF NOT EXISTS chavruta_matches_suggested_user_idx ON public.chavruta_matches(suggested_user_id);
CREATE INDEX IF NOT EXISTS chavruta_messages_sender_idx ON public.chavruta_messages(sender_id);
CREATE INDEX IF NOT EXISTS chavruta_study_progress_user_idx ON public.chavruta_study_progress(user_id);
CREATE INDEX IF NOT EXISTS chavruta_study_questions_created_by_idx ON public.chavruta_study_questions(created_by);
