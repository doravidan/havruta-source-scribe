REVOKE EXECUTE ON FUNCTION public.instant_chavruta_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_instant_chavruta(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_instant_chavruta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instant_chavruta_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_instant_chavruta(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_instant_chavruta() TO authenticated;