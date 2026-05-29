import { Link } from "@tanstack/react-router";
import { Folder, Plus, Loader2 } from "lucide-react";
import { useProjectsQuery } from "@/features/projects/projectQueries";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/features/i18n/localeContext";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";

export function ProjectSidebar() {
  const { session } = useAuth();
  const { t } = useLocale();
  const { data: projects = [], isLoading } = useProjectsQuery(!!session);
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();

  return (
    <div className="flex flex-col h-full bg-surface/20">
      <div className="p-4 border-b border-border/50">
        <ProjectUploadDialog
          userId={session?.user.id ?? ""}
          trigger={
            <button className="w-full flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 transition-colors py-2 px-4 rounded-md text-sm font-medium">
              <Plus className="size-4" />
              {t("uploadOrImport") || "New Project"}
            </button>
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          {t("projects") || "Projects"}
        </div>
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 px-2">
            No projects yet.
          </div>
        ) : (
          projects.map((p) => {
            const isActive = activeProject?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                <Folder className={`size-4 shrink-0 ${isActive ? "text-accent" : ""}`} />
                <span className="truncate flex-1">{p.name}</span>
                <ProjectStatusBadge status={p.latest_job?.status ?? p.status} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
