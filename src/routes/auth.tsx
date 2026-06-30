import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — חסידותא · Chassiduta" },
      {
        name: "description",
        content:
          "Sign in or create an account on חסידותא · Chassiduta to track study progress, find a chavruta, and ask sourced Chassidus questions.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sign in — חסידותא · Chassiduta" },
      { property: "og:description", content: "Sign in to your חסידותא · Chassiduta account." },
      { property: "og:url", content: "https://chassiduta.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://chassiduta.lovable.app/auth" }],
  }),
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
    setErr(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
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
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t.authError);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) {
      setErr(r.error instanceof Error ? r.error.message : "OAuth error");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-5 sm:py-10" id="main-content">
      <div className="grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-[0.9fr_1fr]">
        <section className="scholar-card p-6 sm:p-8 hidden lg:flex flex-col justify-between">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              {lang === "he" ? "חזרה לחסידותא" : "Back to Chassiduta"}
            </Link>
            <h1 className="mt-10 text-4xl leading-tight gold-text">
              {lang === "he" ? "התחברות למאגר הלימוד שלך." : "Sign in to your study corpus."}
            </h1>
            <p className="mt-4 text-muted-foreground leading-7">
              {lang === "he"
                ? "שמור התקדמות, סמן מקורות שלמדת, וחזור לשאלות ולמקורות שלך בלי לאבד הקשר."
                : "Track progress, mark learned sources, and return to your questions without losing context."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            {lang === "he"
              ? "המקורות נקראים מתוך המאגר, לא דרך קישורים חיצוניים."
              : "Sources are read from the database, not external links."}
          </div>
        </section>

        <section className="scholar-card mx-auto w-full max-w-md p-6 sm:p-8">
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-full px-1 text-sm text-muted-foreground hover:text-foreground lg:hidden"
          >
            ← {lang === "he" ? "חזרה" : "Back"}
          </Link>
          <h1 className="mt-2 text-3xl font-semibold gold-text">
            {mode === "in" ? t.signIn : t.signUp}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {lang === "he"
              ? "המשך ללמוד מהמקום שבו עצרת."
              : "Continue learning where you left off."}
          </p>

          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="mt-7 w-full h-12 rounded-xl border border-border bg-background/35 hover:bg-secondary font-medium"
          >
            {t.continueWithGoogle}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            {t.or}
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.displayName}
                className="w-full px-3 h-12 rounded-xl border border-border bg-background/45 outline-none"
              />
            )}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.email}
              className="w-full px-3 h-12 rounded-xl border border-border bg-background/45 outline-none"
            />
            <input
              type="password"
              required
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.password}
              className="w-full px-3 h-12 rounded-xl border border-border bg-background/45 outline-none"
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "in" ? t.signIn : t.signUp}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
          >
            {mode === "in"
              ? lang === "he"
                ? "אין לך חשבון? הרשם"
                : "No account? Sign up"
              : lang === "he"
                ? "יש לך חשבון? התחבר"
                : "Have an account? Sign in"}
          </button>
        </section>
      </div>
    </div>
  );
}
