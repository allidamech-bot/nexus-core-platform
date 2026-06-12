import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthNotice, AuthShell, Field, friendlyAuthError } from "./login";
import { useLocale } from "@/features/i18n/localeContext";

export const Route = createFileRoute("/signup")({
  component: SignupRoute,
});

function SignupRoute() {
  return (
    <AuthProvider>
      <SignupPage />
    </AuthProvider>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const { session, error: authError } = useAuth();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/app" });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error(t("authEmailPasswordRequired"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("authPasswordMinLength"));
      return;
    }

    const redirectUrl = `${window.location.origin}/app`;
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) {
        toast.error(friendlyAuthError(error, t));
        return;
      }
      toast.success(t("signupSuccess"));
    } catch (error) {
      toast.error(friendlyAuthError(error, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      {authError && <AuthNotice message={friendlyAuthError(authError, t)} />}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={t("workEmailLabel")}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label={t("passwordLabel")}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <button
          disabled={loading}
          className="w-full bg-foreground text-background font-semibold rounded-md py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? t("creatingAccount") : t("createAccount")}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        {t("alreadyHaveAccount")}{" "}
        <Link to="/login" className="text-accent hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
