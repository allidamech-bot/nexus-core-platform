import { Boxes, Loader2 } from "lucide-react";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import type { ProjectWithLatestJob } from "./types";
import { useLocale } from "@/features/i18n/localeContext";

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
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3 animate-spin shrink-0" /> {t("loadingProjects")}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3">
        <Boxes className="mb-2 size-4 text-accent" />
        <div className="text-xs font-semibold text-zinc-200">{t("noProjectsYet")}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {t("noProjectsBody")}
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
            className={`w-full rounded-md border px-3 py-2 text-start transition-colors ${
              active
                ? "border-accent/25 bg-accent/10"
                : "border-transparent text-zinc-300 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{project.name}</span>
              <ProjectStatusBadge status={project.latest_job?.status ?? project.status} />
            </div>
            <div
              className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
              dir="ltr"
            >
              {project.source_type} / {project.id.slice(0, 8)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
