import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjectsQuery } from "@/features/projects/projectQueries";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { Loader2, FolderOpen } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";

export function ProjectSelectorDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (projectId: string) => void;
}) {
  const { data: projects = [], isLoading, error } = useProjectsQuery(open);
  const normalizedError = useMemo(() => (error instanceof Error ? error : null), [error]);
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl tracking-tight">{t("chooseExistingProject")}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("loadingProjects")}
            </div>
          )}

          {normalizedError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t("failedToLoadProjects")}: {normalizedError.message}
            </div>
          )}

          {!isLoading && !normalizedError && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <div className="grid size-10 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
                <FolderOpen className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("noExistingProjects")}</p>
              <p className="text-xs">{t("noProjectsBody")}</p>
            </div>
          )}

          {!isLoading && !normalizedError && projects.length > 0 && (
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    onSelect(project.id);
                  }}
                  className="flex min-h-[72px] w-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 text-left text-sm transition-colors hover:border-accent/40 hover:bg-surface-elevated"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-foreground">
                      {project.name}
                    </span>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="font-mono uppercase tracking-wider">
                      {project.source_type}
                    </span>
                    <span className="text-border">|</span>
                    <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
