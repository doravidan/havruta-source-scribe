-- Batch contact reveal for accepted matches (one round-trip instead of N RPC calls).

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
