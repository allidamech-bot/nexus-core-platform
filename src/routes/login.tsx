import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import type { TranslationKey } from "@/features/i18n/translations";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  return (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}

function LoginPage() {
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

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        toast.error(friendlyAuthError(error, t));
        return;
      }
      navigate({ to: "/app" });
    } catch (error) {
      toast.error(friendlyAuthError(error, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      {authError && <AuthNotice message={friendlyAuthError(authError, t)} />}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={t("emailLabel")}
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
          autoComplete="current-password"
          required
        />
        <button
          disabled={loading}
          className="w-full bg-foreground text-background font-semibold rounded-md py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        {t("noAccount")}{" "}
        <Link to="/signup" className="text-accent hover:underline">
          {t("createOne")}
        </Link>
      </p>
    </AuthShell>
  );
}

type AuthTranslator = (key: TranslationKey) => string;

export function friendlyAuthError(error: unknown, t?: AuthTranslator) {
  const pick = (key: TranslationKey, fallback: string) => (t ? t(key) : fallback);
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    message.includes("Missing Supabase environment variable") ||
    message.includes("Supabase is not configured") ||
    message.includes("SUPABASE_URL") ||
    message.includes("SUPABASE_PUBLISHABLE_KEY")
  ) {
    return pick(
      "authSupabaseMissing",
      "Supabase is not configured. Connect Supabase in Lovable Cloud or add the required environment variables.",
    );
  }
  if (message.includes("Invalid login credentials")) {
    return pick("authInvalidCredentials", "Email or password is incorrect.");
  }
  if (message.includes("Email not confirmed")) {
    return pick("authEmailNotConfirmed", "Confirm your email before signing in.");
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return pick(
      "authServiceUnreachable",
      "Authentication service is unreachable. Check your connection and Supabase configuration.",
    );
  }
  if (message.includes("Authentication is temporarily unavailable")) {
    return pick("authFailed", "Authentication failed. Please try again.");
  }
  return message || pick("authFailed", "Authentication failed. Please try again.");
}

export function AuthNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
      {message}
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
            <span className="font-mono text-[11px] font-bold">NX</span>
          </div>
          <span className="text-sm font-bold tracking-tighter uppercase">Nexus Core</span>
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="p-6 rounded-xl border border-border bg-surface">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
  autoComplete,
  minLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}
