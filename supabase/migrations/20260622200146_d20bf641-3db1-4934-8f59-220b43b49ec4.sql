
-- 1. Chavruta matches: lock UPDATE policy so participants cannot self-elevate status/acceptance.
DROP POLICY IF EXISTS "participants update matches" ON public.chavruta_matches;
CREATE POLICY "participants update matches via rpc only"
  ON public.chavruta_matches
  FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid() OR suggested_user_id = auth.uid())
  WITH CHECK (
    (requester_id = auth.uid() OR suggested_user_id = auth.uid())
    AND status <> 'accepted'
    AND requester_accepted IS NOT DISTINCT FROM (SELECT m.requester_accepted FROM public.chavruta_matches m WHERE m.id = chavruta_matches.id)
    AND suggested_accepted IS NOT DISTINCT FROM (SELECT m.suggested_accepted FROM public.chavruta_matches m WHERE m.id = chavruta_matches.id)
  );

-- 2. Contact reveal: require both-sided acceptance, not just status flag.
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

-- 3. Study progress RPCs: enforce caller identity.
CREATE OR REPLACE FUNCTION public.study_section_counts(_user_id uuid)
 RETURNS TABLE(section text, total bigint, done bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT COALESCE(NULLIF(s.tree_parts->>0, ''), 'Other') AS section,
           COUNT(*)::bigint AS total,
           COUNT(sp.source_id)::bigint AS done
    FROM public.sources s
    LEFT JOIN public.study_progress sp
      ON sp.source_id = s.id AND sp.user_id = _user_id
    GROUP BY 1
    ORDER BY done DESC, total DESC
    LIMIT 30;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_active_dates(_user_id uuid)
 RETURNS TABLE(d date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
    FROM public.study_progress
    WHERE user_id = _user_id
    ORDER BY d DESC
    LIMIT 365;
END;
$function$;

-- 4. Revoke anon EXECUTE on chavruta RPCs (authenticated-only).
REVOKE EXECUTE ON FUNCTION public.propose_chavruta_match(uuid, integer, time, time) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_chavruta_match(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_chavruta_match_contact(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_chavruta_match(uuid, integer, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chavruta_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chavruta_match_contact(uuid) TO authenticated;
