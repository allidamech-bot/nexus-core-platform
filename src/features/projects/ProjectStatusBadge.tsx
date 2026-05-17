import type { ProjectIngestionStatus, ProjectStatus } from "./types";

const STATUS_LABELS: Record<ProjectStatus | ProjectIngestionStatus, string> = {
  pending: "Pending",
  validating: "Validating",
  uploaded: "Uploaded",
  processing: "Processing",
  indexing_mocked: "Indexed mock",
  indexed_manifest: "Manifest ready",
  completed: "Complete",
  failed: "Failed",
  archived: "Archived",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus | ProjectIngestionStatus }) {
  const tone =
    status === "failed"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : status === "completed" ||
          status === "uploaded" ||
          status === "indexing_mocked" ||
          status === "indexed_manifest"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : status === "processing"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-accent/30 bg-accent/10 text-accent";

  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${tone}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
