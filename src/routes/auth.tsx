import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Havruta Chabad" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) nav({ to: "/" });
  }, [session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message ?? t.authError);
    } finally { setBusy(false); }
  };

  const google = async () => {
    setErr(null); setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { setErr(String((r as any).error?.message ?? "OAuth error")); setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-scholar)" }}>
      <div className="w-full max-w-md scholar-card p-6 sm:p-8">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← {lang === "he" ? "חזרה" : "Back"}</Link>
        <h1 className="mt-2 text-2xl font-semibold gold-text">{mode === "in" ? t.signIn : t.signUp}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.brand}</p>

        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="mt-6 w-full h-11 rounded-md border border-border bg-card/40 hover:bg-card font-medium"
        >
          {t.continueWithGoogle}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />{t.or}<div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.displayName}
              className="w-full px-3 h-11 rounded-md border border-border bg-background/50 outline-none" />
          )}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email}
            className="w-full px-3 h-11 rounded-md border border-border bg-background/50 outline-none" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password}
            className="w-full px-3 h-11 rounded-md border border-border bg-background/50 outline-none" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button type="submit" disabled={busy} className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "in" ? t.signIn : t.signUp}
          </button>
        </form>

        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
          {mode === "in"
            ? (lang === "he" ? "אין לך חשבון? הרשם" : "No account? Sign up")
            : (lang === "he" ? "יש לך חשבון? התחבר" : "Have an account? Sign in")}
        </button>
      </div>
    </div>
  );
}
