import { useState } from "react";
import { FileArchive, Folder, Loader2, FolderOpen } from "lucide-react";
import { useProjectsQuery } from "@/features/projects/projectQueries";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/features/i18n/localeContext";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";

export function ProjectSidebar() {
  const { session } = useAuth();
  const { t, locale } = useLocale();
  const { data: projects = [], isLoading } = useProjectsQuery(!!session);
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();
  const [filter, setFilter] = useState<"all" | "ready" | "failed" | "processing">("all");

  const filteredProjects = projects.filter((p) => {
    if (filter === "all") return true;
    const status = p.latest_job?.status ?? p.status;
    if (filter === "failed") return status === "failed" || status === "rejected";
    if (filter === "ready") return status === "completed" || status === "indexed_manifest";
    if (filter === "processing")
      return (
        status === "processing" ||
        status === "uploaded" ||
        status === "indexing_mocked" ||
        status === "pending" ||
        status === "validating"
      );
    return true;
  });

  return (
    <div data-project-sidebar="true" className="flex h-full min-w-0 flex-col bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 pb-4 pt-6 backdrop-blur md:p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-foreground md:text-2xl">
              {t("projects")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {projects.length} total / {filteredProjects.length} shown
            </p>
          </div>
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
            <FolderOpen className="size-5" />
          </div>
        </div>

        {activeProject && (
          <div className="mb-4 rounded-2xl border border-accent/25 bg-accent/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              {t("activeProject")}
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">
                  {activeProject.name}
                </div>
                <div className="mt-1 truncate text-xs uppercase tracking-widest text-muted-foreground">
                  {activeProject.source_type}
                </div>
              </div>
              <ProjectStatusBadge
                status={activeProject.latest_job?.status ?? activeProject.status}
              />
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <ProjectUploadDialog
            userId={session?.user.id ?? ""}
            defaultMode="zip"
            onSuccess={setSelectedProjectId}
            trigger={
              <button className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90">
                <FileArchive className="size-5 shrink-0" />
                {t("uploadZip")}
              </button>
            }
          />
          <ProjectUploadDialog
            userId={session?.user.id ?? ""}
            defaultMode="folder"
            onSuccess={setSelectedProjectId}
            trigger={
              <button className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated">
                <FolderOpen className="size-5 shrink-0 text-accent" />
                {t("folderImport")}
              </button>
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted/50 p-1">
          {(["all", "ready", "processing", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`min-h-[40px] rounded-xl px-2 text-[11px] font-bold capitalize transition-colors ${
                filter === f
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface/70 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-3 md:p-3">
        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-4 py-10 text-center text-sm text-muted-foreground">
            <p>No projects found.</p>
            {filter !== "all" && (
              <button
                onClick={() => setFilter("all")}
                className="min-h-[44px] rounded-xl border border-border px-4 text-sm font-semibold text-accent hover:bg-muted"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          filteredProjects.map((p) => {
            const isActive = activeProject?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`flex min-h-[64px] w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "border-accent/30 bg-accent/10 text-foreground shadow-sm"
                    : "border-border bg-surface/70 text-foreground hover:bg-surface-elevated"
                }`}
              >
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    isActive ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Folder className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-base font-semibold">{p.name}</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate uppercase tracking-widest">{p.source_type}</span>
                    <span className="shrink-0">/</span>
                    <span className="shrink-0">
                      {new Date(p.updated_at || p.created_at).toLocaleDateString(locale)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  <ProjectStatusBadge status={p.latest_job?.status ?? p.status} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
