import { Archive, FileArchive, FolderOpen, FolderSync } from "lucide-react";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useAuth } from "@/lib/auth";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { useArchiveProjectMutation, projectKeys } from "@/features/projects/projectQueries";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/features/i18n/localeContext";

export function ProjectIdentityBar() {
  const { session } = useAuth();
  const { t } = useLocale();
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();
  const archiveProject = useArchiveProjectMutation();
  const qc = useQueryClient();
  const navigate = useNavigate();

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
    <div className="flex items-center gap-3 pl-4 border-l border-border/50">
      {activeProject ? (
        <>
          <div className="flex flex-col">
            <span className="text-sm font-medium truncate max-w-[200px]">{activeProject.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              {activeProject.source_type}
            </span>
          </div>
          <ProjectStatusBadge status={activeProject.latest_job?.status ?? activeProject.status} />
        </>
      ) : (
        <span className="text-sm text-muted-foreground italic">No Project Selected</span>
      )}

      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => {
            const sidebar = document.querySelector('[data-project-sidebar="true"]');
            if (sidebar) {
              sidebar.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <FolderSync className="size-3" />
          تبديل المشروع
        </button>

        <ProjectUploadDialog
          userId={session.user.id}
          defaultMode="zip"
          onSuccess={setSelectedProjectId}
          trigger={
            <button className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors flex items-center gap-1.5">
              <FileArchive className="size-3" />
              رفع مشروع
            </button>
          }
        />

        <ProjectUploadDialog
          userId={session.user.id}
          defaultMode="folder"
          onSuccess={setSelectedProjectId}
          trigger={
            <button className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors flex items-center gap-1.5">
              <FolderOpen className="size-3" />
              استيراد مجلد
            </button>
          }
        />

        {activeProject && (
          <button
            type="button"
            onClick={handleArchiveProject}
            disabled={archiveProject.isPending}
            className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-white/5 disabled:opacity-60 transition-colors flex items-center gap-1.5"
            title={t("archiveProject")}
          >
            <Archive className="size-3" />
            {t("archiveProject")}
          </button>
        )}
      </div>
    </div>
  );
}
