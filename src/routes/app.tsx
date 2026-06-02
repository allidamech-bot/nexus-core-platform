import { Link, Navigate, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  LogOut,
  Boxes,
  Loader2,
  Settings,
  Menu,
  Activity,
  FolderKanban,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ProjectWorkspaceProvider } from "@/features/projects/ProjectWorkspaceProvider";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { projectKeys, useArchiveProjectMutation } from "@/features/projects/projectQueries";
import { useIsAdminQuery } from "@/features/admin/adminQueries";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import { ProjectSidebar } from "@/components/agent-workspace/ProjectSidebar";
import { ProjectInspector } from "@/components/agent-workspace/ProjectInspector";
import { ProjectIdentityBar } from "@/components/agent-workspace/ProjectIdentityBar";
import { ThemeSelector } from "@/features/theme/ThemeSelector";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

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
    <div className="h-[100dvh] w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Navigation */}
      <header className="min-h-14 shrink-0 px-2 md:px-6 border-b border-border flex items-center justify-between bg-surface/80 backdrop-blur gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden md:gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <button className="-ml-2 grid min-h-[44px] min-w-[44px] place-items-center text-muted-foreground hover:text-foreground md:hidden">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[95vw] max-w-md p-0 flex flex-col md:w-[350px]">
              <SheetTitle className="sr-only">Projects</SheetTitle>
              <ProjectSidebar />
            </SheetContent>
          </Sheet>

          <Link to="/app" className="flex min-h-[44px] shrink-0 items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
              <span className="font-mono text-[11px] font-bold">NX</span>
            </div>
            <span className="hidden text-sm font-bold tracking-tighter uppercase md:inline">
              Nexus
            </span>
          </Link>
          <div className="min-w-0 flex-1 truncate">
            <ProjectIdentityBar />
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <ThemeSelector compact />
            <LanguageSwitcher />
            {isAdmin && (
              <Link
                to="/app/admin"
                className="px-2.5 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
              >
                <Boxes className="size-3.5" /> {t("adminControl")}
              </Link>
            )}
            <Link
              to="/app/settings"
              className="px-2.5 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
            >
              <Settings className="size-3.5" /> {t("settings")}
            </Link>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <button className="grid min-h-[44px] min-w-[44px] place-items-center text-muted-foreground hover:text-foreground xl:hidden">
                <Activity className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[95vw] max-w-md p-0 flex flex-col overflow-y-auto xl:w-[400px]"
            >
              <SheetTitle className="sr-only">Project Inspector</SheetTitle>
              <ProjectInspector />
            </SheetContent>
          </Sheet>

          <button
            onClick={async () => {
              await signOut();
              qc.clear();
              navigate({ to: "/" });
            }}
            className="hidden min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md border border-border transition-colors hover:bg-muted md:ml-2 md:grid md:min-h-8 md:min-w-8"
            title={t("signOut")}
            aria-label={t("signOut")}
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="w-72 shrink-0 border-r border-border hidden md:flex flex-col">
          <ProjectSidebar />
        </aside>

        {/* Center */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Right Inspector */}
        <aside className="w-[22rem] shrink-0 border-l border-border hidden xl:flex flex-col bg-surface/10">
          <ProjectInspector />
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-2xl backdrop-blur md:hidden">
        <div className="mx-auto grid min-h-14 max-w-md grid-cols-3 gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <FolderKanban className="mb-1 size-5" />
                Projects
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[95vw] max-w-md p-0 flex flex-col">
              <SheetTitle className="sr-only">Projects</SheetTitle>
              <ProjectSidebar />
            </SheetContent>
          </Sheet>

          <Link
            to="/app"
            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl bg-accent/10 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/15"
          >
            <MessageSquare className="mb-1 size-5" />
            Workspace
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <button className="flex min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Activity className="mb-1 size-5" />
                Inspector
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[95vw] max-w-md p-0 flex flex-col overflow-y-auto"
            >
              <SheetTitle className="sr-only">Project Inspector</SheetTitle>
              <ProjectInspector />
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
