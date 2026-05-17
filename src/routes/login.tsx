import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/app" });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/app" });
  }

  return (
    <AuthShell
      title="Sign in to Nexus Core"
      subtitle="Resume your sessions and continue execution."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        <button
          disabled={loading}
          className="w-full bg-foreground text-background font-semibold rounded-md py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? "Authenticating..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        No account?{" "}
        <Link to="/signup" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
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
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}
