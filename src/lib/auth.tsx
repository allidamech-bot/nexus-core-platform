import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

function getAuthSetupMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    message.includes("Missing Supabase environment variable") ||
    message.includes("SUPABASE_URL") ||
    message.includes("SUPABASE_PUBLISHABLE_KEY")
  ) {
    return "Supabase is not configured. Connect Supabase in Lovable Cloud or add the required environment variables.";
  }
  return "Authentication is temporarily unavailable. Check the Supabase configuration and try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        if (!active) return;
        setSession(s);
        setError(null);
        setLoading(false);
      });

      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          setSession(data.session);
          setError(null);
        })
        .catch((authError) => {
          if (!active) return;
          setSession(null);
          setError(getAuthSetupMessage(authError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    } catch (authError) {
      setSession(null);
      setError(getAuthSetupMessage(authError));
      setLoading(false);
      return () => {
        active = false;
      };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        error,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
