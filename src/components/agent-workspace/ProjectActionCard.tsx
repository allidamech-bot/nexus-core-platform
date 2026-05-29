import { Archive, FileArchive, FolderOpen, FolderSync } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { useArchiveProjectMutation, projectKeys } from "@/features/projects/projectQueries";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useLocale } from "@/features/i18n/localeContext";

export function ProjectActionCard() {
  const { session } = useAuth();
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();
  const archiveProject = useArchiveProjectMutation();
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mx-auto mt-8">
      <ProjectUploadDialog
        userId={session.user.id}
        defaultMode="zip"
        onSuccess={setSelectedProjectId}
        trigger={
          <button className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm font-medium transition-colors text-left group">
            <div className="grid place-items-center size-8 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
              <FileArchive className="size-4" />
            </div>
            <div className="flex flex-col">
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
          <button className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm font-medium transition-colors text-left group">
            <div className="grid place-items-center size-8 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
              <FolderOpen className="size-4" />
            </div>
            <div className="flex flex-col">
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
        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm font-medium transition-colors text-left group"
      >
        <div className="grid place-items-center size-8 rounded-lg bg-foreground/10 text-foreground group-hover:bg-foreground/20 transition-colors">
          <FolderSync className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-foreground">اختيار مشروع موجود</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            Choose Existing
          </span>
        </div>
      </button>

      {activeProject &&
        (activeProject.status === "failed" || activeProject.status === "rejected") && (
          <div className="col-span-full mt-2">
            <button
              onClick={handleArchiveProject}
              disabled={archiveProject.isPending}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-sm font-medium transition-colors group"
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
  );
}
