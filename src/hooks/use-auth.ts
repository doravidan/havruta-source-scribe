import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AuthState = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isAdminLoading: boolean;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!session?.user) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }
    setIsAdminLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setIsAdmin(!!data);
          setIsAdminLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  return { session, user: session?.user ?? null, isAdmin, isAdminLoading, loading };
}
