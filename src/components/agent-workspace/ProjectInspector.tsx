import { FileText, Code2, Activity, AlertCircle } from "lucide-react";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectFileInventory } from "@/features/projects/ProjectFileInventory";
import { ProjectPipelineDiagnosticsPanel } from "@/features/projects/ProjectPipelineDiagnosticsPanel";
import { useProjectFilesQuery } from "@/features/projects/projectQueries";
import { useLocale } from "@/features/i18n/localeContext";

export function ProjectInspector() {
  const { activeProject, activeProjectPreviews } = useProjectWorkspace();
  const { t } = useLocale();
  const { data: files = [], isLoading: loadingFiles } = useProjectFilesQuery(
    activeProject?.id ?? null,
  );

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-surface/10 h-full">
        <FileText className="size-8 mb-4 opacity-20" />
        <p className="text-sm">No project selected</p>
      </div>
    );
  }

  const status = activeProject.latest_job?.status ?? activeProject.status;
  const isFailed = status === "failed" || status === "rejected";
  const hasPreviews = activeProjectPreviews.length > 0;
  const hasFiles = files.length > 0;

  let readinessState = "empty";
  let readinessColor = "text-muted-foreground bg-surface";
  let readinessLabel = "Empty Context";

  if (isFailed) {
    readinessState = "failed";
    readinessColor = "text-destructive bg-destructive/10 border-destructive/30";
    readinessLabel = "Failed Context";
  } else if (status === "indexed_manifest" || hasPreviews) {
    readinessState = "ready";
    readinessColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    readinessLabel = "Context Ready";
  } else if (
    hasFiles ||
    status === "indexing_mocked" ||
    status === "uploaded" ||
    status === "processing" ||
    status === "pending" ||
    status === "validating"
  ) {
    readinessState = "staged";
    readinessColor = "text-amber-500 bg-amber-500/10 border-amber-500/30";
    readinessLabel = "Context Staged / Processing";
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface/10 border-l border-border">
      <div className="p-4 border-b border-border/50 bg-surface/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{activeProject.name}</h3>
            <p className="text-[11px] text-muted-foreground mt-1 truncate uppercase tracking-wider">
              {activeProject.source_type} • {activeProject.id.slice(0, 8)}
            </p>
          </div>
          <div
            className={`px-2 py-1 rounded border text-[10px] font-medium whitespace-nowrap ${readinessColor}`}
          >
            {readinessLabel}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5" title="Total Files">
            <FileText className="size-3.5" />
            <span>{files.length}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Indexed Text Previews">
            <Code2 className="size-3.5" />
            <span>{activeProjectPreviews.length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isFailed ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="size-4" />
              <h4 className="text-sm font-semibold">Project Ingestion Failed</h4>
            </div>
            <p className="text-xs text-destructive/80 mb-4 leading-relaxed">
              {activeProject.latest_job?.error_message ||
                "An unknown error occurred during ingestion."}
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 uppercase tracking-widest px-1">
            <Activity className="size-3.5 text-accent" />
            Diagnostics
          </div>
          <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden">
            <ProjectPipelineDiagnosticsPanel projectId={activeProject.id} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 uppercase tracking-widest px-1">
            <Code2 className="size-3.5 text-accent" />
            Project Files
          </div>
          <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden p-2">
            <ProjectFileInventory files={files} loading={loadingFiles} />
          </div>
        </div>
      </div>
    </div>
  );
}
