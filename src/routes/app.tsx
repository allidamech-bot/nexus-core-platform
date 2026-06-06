import { Link, Navigate, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  LogOut,
  Boxes,
  FileArchive,
  FolderOpen,
  Loader2,
  Settings,
  Menu,
  Activity,
  Home,
  Inbox,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
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
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { ThemeSelector } from "@/features/theme/ThemeSelector";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, signOut, error } = useAuth();

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
      <AppWorkspace session={session} signOut={signOut} />
    </ProjectWorkspaceProvider>
  );
}

function AppWorkspace({
  session,
  signOut,
}: {
  session: NonNullable<ReturnType<typeof useAuth>["session"]>;
  signOut: () => Promise<void>;
}) {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();
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
      <header className="min-h-[calc(56px+env(safe-area-inset-top))] shrink-0 border-b border-border bg-surface/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:min-h-14 md:px-6 md:pt-0">
        <div className="flex min-h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden md:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <button className="-ml-1 grid min-h-[48px] min-w-[48px] place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden">
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[95vw] max-w-md p-0 flex flex-col md:w-[350px]"
              >
                <SheetTitle className="sr-only">Projects</SheetTitle>
                <SheetDescription className="sr-only">
                  Open the mobile Projects panel to select, upload, or import project context.
                </SheetDescription>
                <ProjectSidebar />
              </SheetContent>
            </Sheet>

            <button
              onClick={() => setIsLeftSidebarOpen((o) => !o)}
              className="hidden md:grid min-h-[44px] min-w-[44px] place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={isLeftSidebarOpen ? "Collapse Projects" : "Expand Projects"}
            >
              {isLeftSidebarOpen ? (
                <PanelLeftClose className="size-5" />
              ) : (
                <PanelLeftOpen className="size-5" />
              )}
            </button>

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

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
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
                <button className="grid min-h-[48px] min-w-[48px] place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:min-h-[44px] md:min-w-[44px] xl:hidden">
                  <Activity className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[95vw] max-w-md p-0 flex flex-col overflow-y-auto xl:w-[400px]"
              >
                <SheetTitle className="sr-only">Project Inspector</SheetTitle>
                <SheetDescription className="sr-only">
                  Open project diagnostics, governed pipeline actions, and file inventory.
                </SheetDescription>
                <ProjectInspector />
              </SheetContent>
            </Sheet>

            <button
              onClick={() => setIsRightSidebarOpen((o) => !o)}
              className="hidden xl:grid min-h-[44px] min-w-[44px] place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={isRightSidebarOpen ? "Collapse Inspector" : "Expand Inspector"}
            >
              {isRightSidebarOpen ? (
                <PanelRightClose className="size-5" />
              ) : (
                <PanelRightOpen className="size-5" />
              )}
            </button>

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
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        {isLeftSidebarOpen && (
          <aside className="w-72 shrink-0 border-r border-border hidden md:flex flex-col">
            <ProjectSidebar />
          </aside>
        )}

        {/* Center */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Right Inspector */}
        {isRightSidebarOpen && (
          <aside className="w-[22rem] shrink-0 border-l border-border hidden xl:flex flex-col bg-surface/10">
            <ProjectInspector />
          </aside>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-2xl backdrop-blur md:hidden">
        <div className="mx-auto grid min-h-[64px] max-w-md grid-cols-4 gap-1.5">
          <Link
            to="/app"
            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-accent/10 active:text-accent [&.active]:text-accent [&.active]:bg-accent/10 [&.active]:font-semibold"
            activeProps={{ className: "text-accent bg-accent/10 font-semibold" }}
          >
            <Home className="mb-1 size-5" />
            {t("home") || "Home"}
          </Link>

          <Link
            to="/app/inbox"
            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-accent/10 active:text-accent [&.active]:text-accent [&.active]:bg-accent/10 [&.active]:font-semibold"
            activeProps={{ className: "text-accent bg-accent/10 font-semibold" }}
          >
            <div className="relative">
              <Inbox className="mb-1 size-5" />
            </div>
            {t("inbox") || "Inbox"}
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <button className="flex min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-accent/10 active:text-accent">
                <FolderKanban className="mb-1 size-5" />
                {t("projects")}
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[95vw] max-w-md p-0 flex flex-col">
              <SheetTitle className="sr-only">{t("projects")}</SheetTitle>
              <SheetDescription className="sr-only">
                Open the mobile Projects panel to select, upload, or import project context.
              </SheetDescription>
              <ProjectSidebar />
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <button className="flex min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-accent/10 active:text-accent">
                <MoreHorizontal className="mb-1 size-5" />
                {t("more")}
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[88dvh] rounded-t-2xl border-border bg-background p-0"
            >
              <SheetTitle className="sr-only">{t("more")}</SheetTitle>
              <SheetDescription className="sr-only">
                Open mobile navigation, preferences, project tools, and account controls.
              </SheetDescription>
              <div className="flex max-h-[88dvh] min-w-0 flex-col overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-4 backdrop-blur">
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
                    Nexus
                  </div>
                  <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">
                    {t("more")}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t("moreSheetSubtitle")}
                  </p>
                </div>

                <div className="space-y-5 px-4 py-4">
                  <section className="space-y-2">
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("navigation")}
                    </div>
                    <Link
                      to="/app/settings"
                      className="flex min-h-[56px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-foreground transition-colors hover:bg-surface-elevated"
                    >
                      <Settings className="size-5 shrink-0 text-accent" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{t("settings")}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {t("settingsMoreSubtitle")}
                        </span>
                      </span>
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/app/admin"
                        className="flex min-h-[56px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-foreground transition-colors hover:bg-surface-elevated"
                      >
                        <Boxes className="size-5 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">
                            {t("adminControl")}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {t("adminMoreSubtitle")}
                          </span>
                        </span>
                      </Link>
                    )}
                  </section>

                  <section className="space-y-2">
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("preferences")}
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <div className="mb-3 text-sm font-bold text-foreground">
                          {t("language")}
                        </div>
                        <LanguageSwitcher />
                      </div>

                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <ThemeSelector />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("projectTools")}
                    </div>
                    <ProjectUploadDialog
                      userId={session.user.id}
                      defaultMode="zip"
                      onSuccess={setSelectedProjectId}
                      trigger={
                        <button className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90">
                          <FileArchive className="size-5 shrink-0" />
                          {t("uploadZip")}
                        </button>
                      }
                    />
                    <ProjectUploadDialog
                      userId={session.user.id}
                      defaultMode="folder"
                      onSuccess={setSelectedProjectId}
                      trigger={
                        <button className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated">
                          <FolderOpen className="size-5 shrink-0 text-accent" />
                          {t("folderImport")}
                        </button>
                      }
                    />
                  </section>

                  {activeProject && (
                    <section className="space-y-2">
                      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-destructive">
                        {t("dangerZone")}
                      </div>
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                        <button
                          onClick={handleArchiveProject}
                          disabled={archiveProject.isPending}
                          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-background/60 px-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {archiveProject.isPending ? (
                            <Loader2 className="size-5 shrink-0 animate-spin" />
                          ) : (
                            <Archive className="size-5 shrink-0" />
                          )}
                          {t("archiveProject")}
                        </button>
                        <p className="mt-2 text-xs leading-relaxed text-destructive/80">
                          {t("archiveProjectWarning")}
                        </p>
                      </div>
                    </section>
                  )}

                  <section className="space-y-2">
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("account")}
                    </div>
                    <button
                      onClick={async () => {
                        await signOut();
                        qc.clear();
                        navigate({ to: "/" });
                      }}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated"
                    >
                      <LogOut className="size-5 shrink-0 text-muted-foreground" />
                      {t("signOut")}
                    </button>
                  </section>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
