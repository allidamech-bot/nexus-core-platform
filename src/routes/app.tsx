import { Link, Navigate, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, LogOut, Boxes, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ProjectWorkspaceProvider } from "@/features/projects/ProjectWorkspaceProvider";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { projectKeys, useArchiveProjectMutation } from "@/features/projects/projectQueries";
import { useIsAdminQuery } from "@/features/admin/adminQueries";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, signOut, user, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold">Authentication unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProjectWorkspaceProvider enabled={!!session}>
      <AppWorkspace session={session} signOut={signOut} userEmail={user?.email ?? null} />
    </ProjectWorkspaceProvider>
  );
}

function AppWorkspace({
  session,
  signOut,
  userEmail,
}: {
  session: NonNullable<ReturnType<typeof useAuth>["session"]>;
  signOut: () => Promise<void>;
  userEmail: string | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeProject } = useProjectWorkspace();
  const archiveProject = useArchiveProjectMutation();
  const { data: isAdmin = false } = useIsAdminQuery(!!session, session.user.id);
  const { t } = useLocale();

  async function handleArchiveProject() {
    if (!activeProject || archiveProject.isPending) return;
    const confirmed = window.confirm(
      `${t("archiveProjectConfirm")}\n\n${t("archiveProjectWarning")}`,
    );
    if (!confirmed) return;

    try {
      await archiveProject.mutateAsync(activeProject.id);
      await qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success(t("projectArchivedCanCreate"));
      navigate({ to: "/app" });
    } catch {
      toast.error(t("archiveProjectFailed"));
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 shrink-0 px-6 border-b border-border flex items-center justify-between bg-surface/30">
        <div className="flex items-center gap-4">
          <Link to="/app" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
              <span className="font-mono text-[11px] font-bold">NX</span>
            </div>
            <span className="text-sm font-bold tracking-tighter uppercase">Nexus</span>
          </Link>
          {activeProject && (
            <div className="flex items-center gap-3 pl-4 border-l border-border/50">
              <span className="text-sm font-medium truncate max-w-[200px]">
                {activeProject.name}
              </span>
              <ProjectStatusBadge
                status={activeProject.latest_job?.status ?? activeProject.status}
              />
              <button
                type="button"
                onClick={handleArchiveProject}
                disabled={archiveProject.isPending}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-white/5 disabled:opacity-60"
                title={t("archiveProject")}
              >
                <Archive className="me-1 inline size-3" />
                {t("archiveProject")}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isAdmin && (
            <Link
              to="/app/admin"
              className="px-2.5 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-white/5 flex items-center gap-1.5 transition-colors"
            >
              <Boxes className="size-3.5" /> {t("adminControl")}
            </Link>
          )}
          <Link
            to="/app/settings"
            className="px-2.5 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-white/5 flex items-center gap-1.5 transition-colors"
          >
            <Settings className="size-3.5" /> {t("settings")}
          </Link>
          <button
            onClick={async () => {
              await signOut();
              qc.clear();
              navigate({ to: "/" });
            }}
            className="size-8 shrink-0 grid place-items-center rounded-md border border-border hover:bg-white/5 ml-2 transition-colors"
            title={t("signOut")}
            aria-label={t("signOut")}
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
