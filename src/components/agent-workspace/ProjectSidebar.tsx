import { useState } from "react";
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
    <div className="flex flex-col h-full bg-surface/20">
      <div className="p-4 border-b border-border/50">
        <ProjectUploadDialog
          userId={session?.user.id ?? ""}
          onSuccess={setSelectedProjectId}
          trigger={
            <button className="w-full flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 transition-colors py-2 px-4 rounded-md text-sm font-medium">
              <Plus className="size-4" />
              {t("uploadOrImport") || "New Project"}
            </button>
          }
        />
      </div>
      <div className="px-4 py-2 border-b border-border/30 bg-surface/10 flex gap-2 overflow-x-auto no-scrollbar">
        {(["all", "ready", "processing", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
              filter === f ? "bg-accent/20 text-accent" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 px-2 flex flex-col items-center gap-4">
            <p>No projects found.</p>
            {filter !== "all" && (
              <button
                onClick={() => setFilter("all")}
                className="text-xs text-accent hover:underline"
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
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                <Folder className={`size-4 shrink-0 mt-0.5 ${isActive ? "text-accent" : ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="truncate mb-1">{p.name}</div>
                  <div className="flex items-center justify-between text-[10px] opacity-80">
                    <span className="uppercase tracking-widest">{p.source_type}</span>
                    <span>{new Date(p.updated_at || p.created_at).toLocaleDateString(locale)}</span>
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
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
