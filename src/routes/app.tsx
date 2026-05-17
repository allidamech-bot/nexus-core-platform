import { Link, Outlet, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Plus, LogOut, Boxes, Workflow as WorkflowIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ThreadRow } from "@/lib/types";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  const { data: threads } = useQuery({
    enabled: !!session,
    queryKey: ["threads"],
    queryFn: async (): Promise<ThreadRow[]> => {
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ThreadRow[];
    },
  });

  async function newSession() {
    if (!session) return;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: session.user.id, title: "New Session", mode: "engineering" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/app/$threadId", params: { threadId: data.id } });
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-surface">
        <div className="px-4 h-14 flex items-center justify-between border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
              <span className="font-mono text-[11px] font-bold">NX</span>
            </div>
            <span className="text-sm font-bold tracking-tighter uppercase">Nexus</span>
          </Link>
        </div>

        <div className="p-3">
          <button
            onClick={newSession}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-semibold rounded-md py-2 text-sm hover:bg-zinc-200 transition-colors"
          >
            <Plus className="size-4" /> New Session
          </button>
        </div>

        <div className="px-3 mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-2">
            Quick Actions
          </div>
          <div className="space-y-0.5">
            <ActionRow icon={Boxes} label="Upload Project" disabled />
            <ActionRow icon={WorkflowIcon} label="Business Workflow" disabled />
          </div>
        </div>

        <div className="px-3 mt-6 flex-1 overflow-y-auto">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-2">
            Sessions
          </div>
          <div className="space-y-0.5">
            {threads?.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">No sessions yet.</div>
            )}
            {threads?.map((t) => {
              const active = params.threadId === t.id;
              return (
                <Link
                  key={t.id}
                  to="/app/$threadId"
                  params={{ threadId: t.id }}
                  className={`block px-3 py-2 rounded-md text-sm truncate transition-colors ${
                    active
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-zinc-300 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {t.title || "Untitled"}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border p-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{user?.email}</div>
            <div className="text-[10px] text-muted-foreground">Workspace owner</div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="size-7 grid place-items-center rounded-md border border-border hover:bg-white/5"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

function ActionRow({ icon: Icon, label, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-white/5 disabled:cursor-not-allowed text-left"
    >
      <Icon className="size-3.5" /> {label}
      {disabled && <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Soon</span>}
    </button>
  );
}
