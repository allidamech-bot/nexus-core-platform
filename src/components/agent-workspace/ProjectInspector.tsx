import { FileText, Code2, Activity, AlertCircle, Loader2 } from "lucide-react";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectFileInventory } from "@/features/projects/ProjectFileInventory";
import { ProjectPipelineDiagnosticsPanel } from "@/features/projects/ProjectPipelineDiagnosticsPanel";
import {
  useProjectFilesQuery,
  usePatchPreviewsQuery,
  usePatchSnapshotsQuery,
  useWritebackRequestsQuery,
  useWorkingCopiesQuery,
  useCreatePatchPreviewMutation,
  usePatchPreviewSandboxMutation,
  useCreatePatchSnapshotMutation,
  useCreateWritebackRequestMutation,
} from "@/features/projects/projectQueries";
import { useLocale } from "@/features/i18n/localeContext";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function ProjectInspector() {
  const { activeProject, activeProjectPreviews } = useProjectWorkspace();
  const { t } = useLocale();
  const { session } = useAuth();
  const [isGeneratingPatch, setIsGeneratingPatch] = useState(false);
  const [isVerifyingSandbox, setIsVerifyingSandbox] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isRequestingWriteback, setIsRequestingWriteback] = useState(false);
  const createPatchPreview = useCreatePatchPreviewMutation();
  const sandboxPreview = usePatchPreviewSandboxMutation();
  const createPatchSnapshot = useCreatePatchSnapshotMutation(activeProject?.id ?? "");
  const createWritebackRequest = useCreateWritebackRequestMutation(activeProject?.id ?? "");
  const { data: files = [], isLoading: loadingFiles } = useProjectFilesQuery(
    activeProject?.id ?? null,
  );
  const { data: patchPreviews = [] } = usePatchPreviewsQuery(activeProject?.id ?? null);
  const { data: patchSnapshots = [] } = usePatchSnapshotsQuery(activeProject?.id ?? null);
  const { data: writebackRequests = [] } = useWritebackRequestsQuery(activeProject?.id ?? null);
  const { data: workingCopies = [] } = useWorkingCopiesQuery(activeProject?.id ?? null);

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

  const latestSnapshot = patchSnapshots[0];
  const activeWritebackForSnapshot = latestSnapshot
    ? writebackRequests.find(
        (r) =>
          r.snapshotId === latestSnapshot.id &&
          ["draft", "submitted", "approved", "blocked"].includes(r.status),
      )
    : null;
  const canRequestWriteback = !!latestSnapshot && !activeWritebackForSnapshot;
  const hasFiles = files.length > 0;

  const handleGeneratePatch = async () => {
    if (!activeProject || !session?.user?.id || activeProjectPreviews.length === 0) return;

    let targetPreviewPath = "unknown";
    let oldTextLength = 0;

    try {
      setIsGeneratingPatch(true);

      const eligiblePreviews = activeProjectPreviews.filter((p) => {
        if (!p.preview_text) return false;
        const lines = p.preview_text.split("\n");
        return lines.some((l) => l.trim().length >= 6);
      });

      let targetPreview = eligiblePreviews.find((p) => p.path.endsWith("src/App.tsx"));
      if (!targetPreview) {
        targetPreview = eligiblePreviews.find((p) => p.path.endsWith("package.json"));
      }
      if (!targetPreview) {
        targetPreview = eligiblePreviews[0];
      }

      if (!targetPreview) {
        toast.error("No eligible safe preview text found.");
        setIsGeneratingPatch(false);
        return;
      }

      if (targetPreview.path.match(/\.json$/i)) {
        const commentSafe = eligiblePreviews.find((p) => p.path.match(/\.(tsx|ts|jsx|js|css)$/i));
        if (commentSafe) {
          targetPreview = commentSafe;
        }
      }

      targetPreviewPath = targetPreview.path;

      const lines = targetPreview.preview_text!.split("\n");
      const oldText = lines.find((l) => l.trim().length >= 6) || "";
      oldTextLength = oldText.length;

      let newText = "";
      if (targetPreview.path.match(/\.(tsx|ts|jsx|js)$/i)) {
        newText = oldText + " // Nexus grounded preview";
      } else if (targetPreview.path.match(/\.css$/i)) {
        newText = oldText + " /* Nexus grounded preview */";
      } else {
        newText = oldText + " ";
      }

      await createPatchPreview.mutateAsync({
        projectId: activeProject.id,
        userId: session.user.id,
        fileId: targetPreview.file_id,
        title: "Test deterministic patch",
        summary: "Created via smoke test UI",
        oldText,
        newText,
      });
      toast.success("Patch preview generated successfully");
    } catch (error) {
      console.error(
        "Context:",
        { projectId: activeProject.id, path: targetPreviewPath, oldTextLength },
        error,
      );
      toast.error(error instanceof Error ? error.message : "Failed to generate patch preview");
    } finally {
      setIsGeneratingPatch(false);
    }
  };

  const handleRunSandbox = async () => {
    const readyPreview = patchPreviews.find((p) => p.status === "ready");
    if (!readyPreview) return;

    try {
      setIsVerifyingSandbox(true);
      const result = await sandboxPreview.mutateAsync(readyPreview.id);
      if (result.status === "blocked" || result.status === "failed") {
        const errorMsg = result.blockers.map((b) => b.message).join(", ") || "Verification failed";
        toast.error(`Sandbox verification failed: ${errorMsg}`);
      } else {
        toast.success(
          `Sandbox verification successful! Applied ${result.summary.changesApplied} changes across ${result.summary.changedFiles} files.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run sandbox verification");
    } finally {
      setIsVerifyingSandbox(false);
    }
  };

  const handleCreateSnapshot = async () => {
    const readyPreview = patchPreviews.find((p) => p.status === "ready");
    if (!readyPreview) return;

    try {
      setIsCreatingSnapshot(true);
      const result = await createPatchSnapshot.mutateAsync(readyPreview.id);
      if (result.alreadyExists) {
        toast.info("A patch snapshot already exists for this preview.");
      } else {
        toast.success(
          `Patch snapshot created successfully! Modified ${result.snapshot.changedFilesCount} files.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create patch snapshot");
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRequestWriteback = async () => {
    const latestSnapshot = patchSnapshots[0];
    if (!latestSnapshot) return;

    try {
      setIsRequestingWriteback(true);
      const result = await createWritebackRequest.mutateAsync({ snapshotId: latestSnapshot.id });
      if (result.alreadyExists) {
        toast.info("A writeback request already exists for this snapshot.");
      } else {
        toast.success("Writeback review requested successfully.");
      }
    } catch (err) {
      const error = err as Error & { code?: string; details?: string; hint?: string };
      console.error("Writeback request failed", {
        snapshotId: latestSnapshot.id,
        projectId: activeProject?.id,
        userId: session?.user?.id,
        error,
      });
      const supabaseDetails = error?.code
        ? ` (Code: ${error.code}) ${error.details || ""} ${error.hint || ""}`
        : "";
      toast.error(
        `Failed to request writeback review: ${error.message || "Unknown error"}${supabaseDetails}`,
      );
    } finally {
      setIsRequestingWriteback(false);
    }
  };

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
              {activeProject.source_type} â€¢ {activeProject.id.slice(0, 8)}
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
            <ProjectPipelineDiagnosticsPanel
              projectId={activeProject.id}
              safePreviews={activeProjectPreviews}
              patchPreviews={patchPreviews}
              patchSnapshots={patchSnapshots}
              writebackRequests={writebackRequests}
              workingCopies={workingCopies}
            />
          </div>
        </div>

        {hasPreviews && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 uppercase tracking-widest px-1">
              <Activity className="size-3.5 text-accent" />
              Pipeline actions
            </div>
            <div className="flex flex-wrap gap-2 w-full">
              {patchPreviews.some((p) => p.status === "ready") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs flex-1 min-w-[200px]"
                    disabled={isCreatingSnapshot}
                    onClick={handleCreateSnapshot}
                  >
                    {isCreatingSnapshot && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {isCreatingSnapshot ? "Creating snapshot..." : "Create patch snapshot"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs flex-1 min-w-[200px]"
                    disabled={isVerifyingSandbox}
                    onClick={handleRunSandbox}
                  >
                    {isVerifyingSandbox && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {isVerifyingSandbox ? "Verifying sandbox..." : "Run sandbox verification"}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex-1 min-w-[200px]"
                disabled={isGeneratingPatch}
                onClick={handleGeneratePatch}
              >
                {isGeneratingPatch && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {isGeneratingPatch ? "Generating preview..." : "Generate grounded patch preview"}
              </Button>
              {canRequestWriteback && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1 min-w-[200px]"
                  disabled={isRequestingWriteback}
                  onClick={handleRequestWriteback}
                >
                  {isRequestingWriteback && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  {isRequestingWriteback
                    ? "Requesting review..."
                    : "Request source writeback review"}
                </Button>
              )}
            </div>
          </div>
        )}

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
