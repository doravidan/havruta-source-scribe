-- Block any direct mutation of user_roles by authenticated users.
-- service_role bypasses RLS, so trusted server code (handle_new_user trigger,
-- admin server functions using supabaseAdmin) continues to work.

CREATE POLICY "deny_authenticated_insert_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "deny_authenticated_update_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_authenticated_delete_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "deny_anon_all_user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
