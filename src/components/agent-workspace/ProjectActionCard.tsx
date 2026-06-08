import { Archive, FileArchive, FolderOpen, FolderSync, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { useArchiveProjectMutation, useSeedDemoProjectMutation, projectKeys } from "@/features/projects/projectQueries";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useLocale } from "@/features/i18n/localeContext";
import { GithubRepoSelector } from "@/features/github/GithubRepoSelector";
import { Github } from "lucide-react";

export function ProjectActionCard() {
  const { session } = useAuth();
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();
  const archiveProject = useArchiveProjectMutation();
  const seedDemoProject = useSeedDemoProjectMutation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useLocale();

  if (!session) return null;

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

  async function handleSeedDemo() {
    if (seedDemoProject.isPending) return;
    try {
      const { projectId } = await seedDemoProject.mutateAsync();
      setSelectedProjectId(projectId);
      toast.success("Demo workspace seeded successfully!");
    } catch {
      toast.error("Failed to seed demo workspace.");
    }
  }

  return (
    <div className="mx-auto mt-5 flex w-full max-w-none min-w-0 flex-col gap-3 md:max-w-3xl">
      <button
        onClick={handleSeedDemo}
        disabled={seedDemoProject.isPending}
        className="group relative overflow-hidden flex min-h-[88px] min-w-0 items-center justify-between gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-left text-sm font-medium shadow-sm transition-all hover:bg-accent/20 hover:border-accent hover:shadow-accent/20 hover:shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground shadow-md">
            {seedDemoProject.isPending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground text-base font-bold">Try Demo Workspace</span>
            <span className="text-xs text-muted-foreground mt-0.5">
              Explore with a pre-configured sample project
            </span>
          </div>
        </div>
        <div className="hidden sm:flex relative z-10 items-center gap-2 rounded-full bg-background/50 px-3 py-1 text-[10px] font-bold tracking-widest text-foreground border border-border">
          ONE-CLICK
        </div>
      </button>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-4">
      <ProjectUploadDialog
        userId={session.user.id}
        defaultMode="zip"
        onSuccess={setSelectedProjectId}
        trigger={
          <button className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm font-medium shadow-sm transition-colors hover:bg-surface-elevated">
            <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
              <FileArchive className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground">رفع مشروع ZIP</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Upload Archive
              </span>
            </div>
          </button>
        }
      />

      <ProjectUploadDialog
        userId={session.user.id}
        defaultMode="folder"
        onSuccess={setSelectedProjectId}
        trigger={
          <button className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm font-medium shadow-sm transition-colors hover:bg-surface-elevated">
            <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
              <FolderOpen className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground">استيراد مجلد</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Import Folder
              </span>
            </div>
          </button>
        }
      />

      <button
        onClick={() => {
          const sidebar = document.querySelector('[data-project-sidebar="true"]');
          if (sidebar) {
            sidebar.scrollIntoView({ behavior: "smooth" });
          }
        }}
        className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm font-medium shadow-sm transition-colors hover:bg-surface-elevated"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-surface-elevated">
          <FolderSync className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground">اختيار مشروع موجود</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            Choose Existing
          </span>
        </div>
      </button>

      <GithubRepoSelector
        onSuccess={setSelectedProjectId}
        trigger={
          <button className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm font-medium shadow-sm transition-colors hover:bg-surface-elevated">
            <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
              <Github className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground">ربط حساب GitHub</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Connect GitHub
              </span>
            </div>
          </button>
        }
      />

      {activeProject &&
        (activeProject.status === "failed" || activeProject.status === "rejected") && (
          <div className="col-span-full mt-2">
            <button
              onClick={handleArchiveProject}
              disabled={archiveProject.isPending}
              className="group flex min-h-[72px] w-full min-w-0 items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium transition-colors hover:bg-destructive/20"
            >
              <div className="grid place-items-center size-8 rounded-lg bg-destructive/20 text-destructive group-hover:bg-destructive/30 transition-colors">
                <Archive className="size-4" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-destructive">أرشفة المشروع الحالي وبدء مشروع جديد</span>
                <span className="text-[10px] text-destructive/70 uppercase tracking-widest mt-0.5">
                  Archive & Start Fresh
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
