import { Boxes, Loader2 } from "lucide-react";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import type { ProjectWithLatestJob } from "./types";

export function ProjectList({
  projects,
  selectedProjectId,
  loading,
  onSelect,
}: {
  projects: ProjectWithLatestJob[];
  selectedProjectId: string | null;
  loading: boolean;
  onSelect: (projectId: string) => void;
}) {
  if (loading) {
    return (
      <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3 animate-spin" /> Loading projects
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3">
        <Boxes className="mb-2 size-4 text-accent" />
        <div className="text-xs font-semibold text-zinc-200">No projects yet</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Upload a ZIP to create the first real project record and ingestion job.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {projects.map((project) => {
        const active = project.id === selectedProjectId;
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelect(project.id)}
            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
              active
                ? "border-accent/25 bg-accent/10"
                : "border-transparent text-zinc-300 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{project.name}</span>
              <ProjectStatusBadge status={project.latest_job?.status ?? project.status} />
            </div>
            <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {project.source_type} / {project.id.slice(0, 8)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
