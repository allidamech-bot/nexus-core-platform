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
    <div className="flex min-w-0 items-center gap-2 border-l border-border/50 pl-2 sm:gap-3 sm:pl-4">
      {activeProject ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {activeProject.name}
            </span>
            <span className="mt-0.5 min-w-0 truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {activeProject.source_type} /{" "}
              {(activeProject.latest_job?.status ?? activeProject.status).replace(/_/g, " ")}
            </span>
          </div>
          <div className="hidden shrink-0 lg:block">
            <ProjectStatusBadge status={activeProject.latest_job?.status ?? activeProject.status} />
          </div>
        </>
      ) : (
        <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          No Project Selected
        </span>
      )}

      <div className="ml-4 hidden items-center gap-2 md:flex">
        <button
          onClick={() => {
            const sidebar = document.querySelector('[data-project-sidebar="true"]');
            if (sidebar) {
              sidebar.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          title="تبديل المشروع"
        >
          <FolderSync className="size-3" />
          <span className="hidden md:inline">تبديل المشروع</span>
        </button>

        <ProjectUploadDialog
          userId={session.user.id}
          defaultMode="zip"
          onSuccess={setSelectedProjectId}
          trigger={
            <button
              className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              title="رفع مشروع"
            >
              <FileArchive className="size-3" />
              <span className="hidden md:inline">رفع مشروع</span>
            </button>
          }
        />

        <ProjectUploadDialog
          userId={session.user.id}
          defaultMode="folder"
          onSuccess={setSelectedProjectId}
          trigger={
            <button
              className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              title="استيراد مجلد"
            >
              <FolderOpen className="size-3" />
              <span className="hidden md:inline">استيراد مجلد</span>
            </button>
          }
        />

        {activeProject && (
          <button
            type="button"
            onClick={handleArchiveProject}
            disabled={archiveProject.isPending}
            className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
            title={t("archiveProject")}
          >
            <Archive className="size-3" />
            <span className="hidden md:inline">{t("archiveProject")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
