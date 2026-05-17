import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
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
    const redirectUrl = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your inbox to confirm your account.");
  }

  return (
    <AuthShell title="Create your workspace" subtitle="Deploy your first verified agent in under a minute.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Work email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        <button
          disabled={loading}
          className="w-full bg-foreground text-background font-semibold rounded-md py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? "Provisioning…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
