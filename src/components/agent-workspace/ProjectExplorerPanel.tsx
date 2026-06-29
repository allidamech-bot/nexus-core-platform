import { Folder, FileCode2, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";
import type {
  ProjectFile,
  ProjectIngestionJob,
  ProjectManifest,
  ProjectTextPreviewWithPath,
} from "@/features/projects/types";
import { ProjectManifestCard } from "@/features/projects/ProjectManifestCard";
import { ProjectSafePreviewPanel } from "@/features/projects/ProjectSafePreviewPanel";
import type { TranslationKey } from "@/features/i18n/translations";

interface ProjectExplorerPanelProps {
  projectId: string | null;
  projectName: string | null;
  projectStatus: string | null;
  files: ProjectFile[];
  previews: ProjectTextPreviewWithPath[];
  manifest: ProjectManifest | null;
  latestJob: ProjectIngestionJob | null;
  loading: boolean;
  error?: boolean;
  emptyMessage?: string;
  onAttach?: () => void;
  isArchived?: boolean;
}

export function ProjectExplorerPanel({
  projectId,
  projectName,
  projectStatus,
  files,
  previews,
  manifest,
  latestJob,
  loading,
  error,
  emptyMessage,
  onAttach,
  isArchived,
}: ProjectExplorerPanelProps) {
  const { t } = useLocale();

  if (!projectId) {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Folder className="size-4" />
          Project Explorer
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <ShieldCheck className="size-8 mb-2 opacity-20" />
          <p className="text-sm text-muted-foreground">No project selected</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Select a project to view files and previews
          </p>
        </div>
      </div>
    );
  }

  const hasPreviews = previews.length > 0;
  const hasFiles = files.length > 0;
  const isReady =
    manifest?.file_count !== undefined ||
    projectStatus === "indexed_manifest" ||
    latestJob?.status === "completed";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
            {projectName ?? "Project"}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          {isReady ? (
            <>
              <CheckCircle2 className="size-3 text-emerald-400" />
              <span className="text-emerald-400">Ready for analysis</span>
            </>
          ) : hasFiles ? (
            <>
              <AlertCircle className="size-3 text-amber-400" />
              <span className="text-amber-400">Processing...</span>
            </>
          ) : (
            <>
              <AlertCircle className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">Pending</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading project...</div>
        ) : hasFiles || hasPreviews ? (
          <ProjectSafePreviewPanel
            files={files}
            previews={previews}
            manifest={manifest}
            latestJob={latestJob}
            loading={loading}
            emptyMessage={emptyMessage}
          />
        ) : (
          <div className="text-xs text-muted-foreground">No files indexed yet</div>
        )}
      </div>
    </div>
  );
}
