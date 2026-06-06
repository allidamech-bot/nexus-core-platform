import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  Loader2,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/features/i18n/localeContext";
import { AI_PATCH_LIMITS } from "./aiPatchPreview";
import {
  useCreateAiPatchPreviewMutation,
  useCreatePatchPreviewMutation,
  useCreatePatchSnapshotMutation,
  useAiPatchPreviewReadinessQuery,
  useCreateWritebackRequestMutation,
  useDownloadPatchSnapshotExportMutation,
  useDownloadWorkingCopyExportMutation,
  useExecuteWritebackRequestMutation,
  useLatestWorkingCopyForRequestQuery,
  usePatchPreviewsQuery,
  usePatchSnapshotFilesQuery,
  usePatchSnapshotsQuery,
  usePatchPreviewSandboxMutation,
  usePreviewablePatchTargetsQuery,
  useCancelWritebackRequestMutation,
  useSubmitWritebackRequestMutation,
  useWritebackRequestsQuery,
  useWorkingCopyFilesQuery,
  useWorkingCopiesQuery,
} from "./projectQueries";
import { ProjectPipelineDiagnosticsPanel } from "./ProjectPipelineDiagnosticsPanel";
import type { PatchSandboxResult } from "./patchApplySandbox";
import type { ProjectPatchSnapshot, ProjectPatchSnapshotFile } from "./patchSnapshot";
import type { ProjectWritebackRequest } from "./projectWritebackRequestService";
import type { ProjectWorkingCopy, ProjectWorkingCopyFile } from "./projectWorkingCopyService";
import type { GroundedPatchPreview, ProjectFile, ProjectTextPreviewWithPath } from "./types";

function shortHash(value: string | null) {
  return value ? value.slice(0, 12) : "unavailable";
}

export function ProjectPatchPreviewPanel({
  projectId,
  userId,
  previews,
  disabled,
}: {
  projectId: string;
  userId: string;
  previews: ProjectTextPreviewWithPath[];
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const { data: targets = [], isLoading: targetsLoading } =
    usePreviewablePatchTargetsQuery(projectId);
  const { data: patchPreviews = [], isLoading: previewsLoading } = usePatchPreviewsQuery(projectId);
  const { data: aiPatchPreviewReadiness = null, error: aiPatchPreviewReadinessError = null } =
    useAiPatchPreviewReadinessQuery(Boolean(projectId));
  const { data: patchSnapshots = [] } = usePatchSnapshotsQuery(projectId);
  const { data: writebackRequests = [] } = useWritebackRequestsQuery(projectId);
  const { data: workingCopies = [] } = useWorkingCopiesQuery(projectId);
  const createPreview = useCreatePatchPreviewMutation();
  const createAiPreview = useCreateAiPatchPreviewMutation();
  const sandboxPreview = usePatchPreviewSandboxMutation();
  const createSnapshot = useCreatePatchSnapshotMutation(projectId);
  const downloadSnapshotExport = useDownloadPatchSnapshotExportMutation();
  const downloadWorkingCopyExport = useDownloadWorkingCopyExportMutation();
  const createWritebackRequest = useCreateWritebackRequestMutation(projectId);
  const submitWritebackRequest = useSubmitWritebackRequestMutation(projectId);
  const cancelWritebackRequest = useCancelWritebackRequestMutation(projectId);
  const executeWritebackRequest = useExecuteWritebackRequestMutation(projectId);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [selectedAiFileIds, setSelectedAiFileIds] = useState<string[]>([]);
  const [selectedPatchPreviewId, setSelectedPatchPreviewId] = useState("");
  const [createdSnapshotFiles, setCreatedSnapshotFiles] = useState<ProjectPatchSnapshotFile[]>([]);
  const [title, setTitle] = useState("");
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [requesterNote, setRequesterNote] = useState("");

  const previewsByFileId = useMemo(
    () => new Map(previews.map((preview) => [preview.file_id, preview])),
    [previews],
  );
  const previewableTargets = targets.filter((target) => previewsByFileId.has(target.id));
  const selectedTarget = previewableTargets.find((target) => target.id === selectedFileId) ?? null;
  const selectedPatchPreview =
    patchPreviews.find((preview) => preview.id === selectedPatchPreviewId) ??
    patchPreviews[0] ??
    null;
  const latestSnapshotForSelected = selectedPatchPreview
    ? (patchSnapshots.find((snapshot) => snapshot.patchPreviewId === selectedPatchPreview.id) ??
      null)
    : null;
  const latestWritebackRequestForSnapshot = latestSnapshotForSelected
    ? (writebackRequests.find((request) => request.snapshotId === latestSnapshotForSelected.id) ??
      null)
    : null;
  const { data: latestSnapshotFiles = [] } = usePatchSnapshotFilesQuery(
    latestSnapshotForSelected?.id ?? null,
  );
  const { data: latestWorkingCopy = null } = useLatestWorkingCopyForRequestQuery(
    latestWritebackRequestForSnapshot?.id ?? null,
  );
  const { data: latestWorkingCopyFiles = [] } = useWorkingCopyFilesQuery(
    latestWorkingCopy?.id ?? null,
  );
  const displayedSnapshotFiles =
    createdSnapshotFiles.length > 0 ? createdSnapshotFiles : latestSnapshotFiles;
  const busy =
    createPreview.isPending ||
    createAiPreview.isPending ||
    sandboxPreview.isPending ||
    createSnapshot.isPending ||
    downloadSnapshotExport.isPending ||
    downloadWorkingCopyExport.isPending ||
    createWritebackRequest.isPending ||
    submitWritebackRequest.isPending ||
    cancelWritebackRequest.isPending ||
    executeWritebackRequest.isPending;

  useEffect(() => {
    if (!selectedFileId && previewableTargets[0]) {
      setSelectedFileId(previewableTargets[0].id);
    }
  }, [previewableTargets, selectedFileId]);

  useEffect(() => {
    if (selectedAiFileIds.length === 0 && previewableTargets[0]) {
      setSelectedAiFileIds([previewableTargets[0].id]);
    }
  }, [previewableTargets, selectedAiFileIds.length]);

  useEffect(() => {
    if (!selectedPatchPreviewId && patchPreviews[0]) {
      setSelectedPatchPreviewId(patchPreviews[0].id);
    }
  }, [patchPreviews, selectedPatchPreviewId]);

  useEffect(() => {
    setCreatedSnapshotFiles([]);
  }, [selectedPatchPreviewId]);

  function toggleAiFile(fileId: string) {
    setSelectedAiFileIds((current) => {
      if (current.includes(fileId)) return current.filter((id) => id !== fileId);
      return [...current, fileId].slice(0, AI_PATCH_LIMITS.maxSelectedFiles);
    });
  }

  async function handleGeneratePreview() {
    if (!selectedTarget || disabled) return;
    if (!oldText.trim()) {
      toast.error(t("patchPreviewFailed"));
      return;
    }

    const result = await createPreview.mutateAsync({
      projectId,
      userId,
      fileId: selectedTarget.id,
      title,
      oldText,
      newText,
    });

    if (result.status === "ready") {
      toast.success(t("patchPreviewCreated"));
      return;
    }
    toast.error(result.warnings[0]?.message ?? t("patchPreviewFailed"));
  }

  async function handleGenerateAiPreview() {
    if (disabled || busy) return;
    if (selectedAiFileIds.length === 0) {
      toast.error(t("selectAtLeastOnePreviewableFile"));
      return;
    }
    if (selectedAiFileIds.length > AI_PATCH_LIMITS.maxSelectedFiles) {
      toast.error(t("tooManyFilesSelected"));
      return;
    }
    if (aiInstruction.length > AI_PATCH_LIMITS.maxInstructionChars) {
      toast.error(t("instructionTooLong"));
      return;
    }
    if (!aiInstruction.trim()) {
      toast.error(t("aiPatchPreviewFailed"));
      return;
    }

    const result = await createAiPreview.mutateAsync({
      projectId,
      fileIds: selectedAiFileIds,
      title: title || t("aiPatchPreview"),
      instruction: aiInstruction,
    });

    if (result.status === "ready") {
      toast.success(t("aiPatchPreviewCreated"));
      return;
    }
    toast.error(result.warnings[0]?.message ?? t("aiPatchPreviewFailed"));
  }

  async function handleVerifySandbox() {
    if (!selectedPatchPreview || disabled || sandboxPreview.isPending) return;
    try {
      const result = await sandboxPreview.mutateAsync(selectedPatchPreview.id);
      if (result.status === "verified") {
        toast.success(t("sandboxVerified"));
      } else if (result.status === "blocked") {
        toast.error(t("sandboxBlocked"));
      } else if (result.status === "partial") {
        toast.warning(t("sandboxPartial"));
      } else {
        toast.error(t("sandboxFailed"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sandboxFailed"));
    }
  }

  async function handleCreateSnapshot() {
    if (!selectedPatchPreview || disabled || createSnapshot.isPending) return;
    try {
      const result = await createSnapshot.mutateAsync(selectedPatchPreview.id);
      setCreatedSnapshotFiles(result.files);
      toast.success(result.alreadyExists ? t("snapshotAlreadyExists") : t("snapshotCreated"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("snapshotCreationFailed");
      toast.error(
        message.includes("blocked sandbox") ? t("cannotCreateSnapshotFromBlockedSandbox") : message,
      );
    }
  }

  async function handleDownloadSnapshotExport(snapshotId: string) {
    if (disabled || downloadSnapshotExport.isPending) return;
    try {
      await downloadSnapshotExport.mutateAsync(snapshotId);
      toast.success(t("exportCreated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("exportFailed"));
    }
  }

  async function handleCreateWritebackRequest(snapshotId: string) {
    if (disabled || createWritebackRequest.isPending) return;
    try {
      const result = await createWritebackRequest.mutateAsync({
        snapshotId,
        requesterNote,
      });
      toast.success(
        result.alreadyExists ? t("writebackRequestCreated") : t("writebackRequestCreated"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("writebackRequestBlocked"));
    }
  }

  async function handleSubmitWritebackRequest(requestId: string) {
    if (disabled || submitWritebackRequest.isPending) return;
    try {
      await submitWritebackRequest.mutateAsync(requestId);
      toast.success(t("writebackRequestSubmitted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("writebackRequestBlocked"));
    }
  }

  async function handleCancelWritebackRequest(requestId: string) {
    if (disabled || cancelWritebackRequest.isPending) return;
    try {
      await cancelWritebackRequest.mutateAsync(requestId);
      toast.success(t("writebackRequestCancelled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("writebackRequestBlocked"));
    }
  }

  async function handleExecuteWritebackRequest(requestId: string) {
    if (disabled || executeWritebackRequest.isPending) return;
    try {
      const result = await executeWritebackRequest.mutateAsync(requestId);
      toast.success(result.alreadyExists ? t("workingCopyAlreadyExists") : t("workingCopyCreated"));
    } catch (err) {
      const error = err as Error & { code?: string; details?: string; hint?: string };
      const details = error?.code
        ? ` (Code: ${error.code}) ${error.details || ""} ${error.hint || ""}`
        : "";
      toast.error(
        error instanceof Error
          ? `${error.message}${details}`
          : `${t("workingCopyCreationFailed")}${details}`,
      );
    }
  }

  async function handleDownloadWorkingCopyExport(workingCopyId: string) {
    if (disabled || downloadWorkingCopyExport.isPending) return;
    try {
      await downloadWorkingCopyExport.mutateAsync(workingCopyId);
      toast.success(t("workingCopyExportCreated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("workingCopyExportFailed"));
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <ShieldCheck className="size-3 text-accent" />
          {t("patchPreviewOnly")}
        </div>
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          {t("thisPatchNotApplied")} {t("previewLimitedToIndexedText")}
        </div>
      </div>

      <ProjectPipelineDiagnosticsPanel
        projectId={projectId}
        safePreviews={previews}
        patchPreviews={patchPreviews}
        patchSnapshots={patchSnapshots}
        writebackRequests={writebackRequests}
        workingCopies={workingCopies}
        workingCopyFiles={latestWorkingCopyFiles}
        uploadQuotaAvailable={null}
        aiPatchPreviewConfigured={aiPatchPreviewReadiness?.configured ?? false}
        aiPatchPreviewGatewayError={
          aiPatchPreviewReadinessError instanceof Error
            ? aiPatchPreviewReadinessError.message
            : null
        }
      />

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("selectPreviewableFile")}
        </label>
        <select
          value={selectedFileId}
          onChange={(event) => setSelectedFileId(event.target.value)}
          disabled={disabled || targetsLoading || busy}
          className="h-8 w-full rounded-md border border-border bg-background/60 px-2 font-mono text-[11px] text-zinc-200 outline-none focus:border-accent/40 disabled:opacity-60"
        >
          {previewableTargets.length === 0 && <option value="">{t("noPreviewAvailable")}</option>}
          {previewableTargets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.path}
            </option>
          ))}
        </select>
        {selectedTarget && <GroundedFileMeta file={selectedTarget} />}
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("createPatchPreview")}
        disabled={disabled || busy}
        className="h-8 w-full rounded-md border border-border bg-background/60 px-2 text-xs text-zinc-200 outline-none placeholder:text-muted-foreground focus:border-accent/40 disabled:opacity-60"
      />
      <textarea
        value={oldText}
        onChange={(event) => setOldText(event.target.value)}
        placeholder={t("searchText")}
        disabled={disabled || busy}
        className="min-h-20 w-full rounded-md border border-border bg-background/60 px-2 py-2 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-muted-foreground focus:border-accent/40 disabled:opacity-60"
      />
      <textarea
        value={newText}
        onChange={(event) => setNewText(event.target.value)}
        placeholder={t("replacementText")}
        disabled={disabled || busy}
        className="min-h-20 w-full rounded-md border border-border bg-background/60 px-2 py-2 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-muted-foreground focus:border-accent/40 disabled:opacity-60"
      />

      <button
        type="button"
        onClick={handleGeneratePreview}
        disabled={disabled || busy || !selectedTarget || !oldText.trim()}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
        {t("generatePreview")}
      </button>

      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <Wand2 className="size-3 text-accent" />
          {t("aiPatchPreview")}
        </div>
        <div className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
          {t("thisAiPatchNotApplied")} {t("onlySelectedFilesUsed")}{" "}
          {t("previewGenerationLimitedToIndexedText")}
        </div>
        <div className="space-y-1">
          {previewableTargets.slice(0, 12).map((target) => (
            <label
              key={target.id}
              className="flex items-center gap-2 rounded border border-white/5 bg-black/10 px-2 py-1.5 text-[10px] text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selectedAiFileIds.includes(target.id)}
                onChange={() => toggleAiFile(target.id)}
                disabled={
                  disabled ||
                  busy ||
                  (!selectedAiFileIds.includes(target.id) &&
                    selectedAiFileIds.length >= AI_PATCH_LIMITS.maxSelectedFiles)
                }
                className="size-3 accent-accent"
              />
              <span className="min-w-0 flex-1 truncate font-mono" dir="ltr">
                {target.path}
              </span>
            </label>
          ))}
          {previewableTargets.length === 0 && (
            <div className="text-xs text-muted-foreground">{t("noPreviewAvailable")}</div>
          )}
        </div>
        <textarea
          value={aiInstruction}
          onChange={(event) => setAiInstruction(event.target.value)}
          placeholder={t("describeChangeYouWant")}
          disabled={disabled || busy}
          maxLength={AI_PATCH_LIMITS.maxInstructionChars + 1}
          className="mt-2 min-h-20 w-full rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-zinc-200 outline-none placeholder:text-muted-foreground focus:border-accent/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleGenerateAiPreview}
          disabled={disabled || busy || selectedAiFileIds.length === 0 || !aiInstruction.trim()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createAiPreview.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Wand2 className="size-3" />
          )}
          {createAiPreview.isPending ? t("generatingPatchPreview") : t("generateAiPatchPreview")}
        </button>
      </div>

      <button
        type="button"
        disabled
        className="w-full rounded-md border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground opacity-60"
      >
        {t("applyUnavailableYet")} / {t("applyRemainsDisabled")}
      </button>

      {previewsLoading ? (
        <div className="text-xs text-muted-foreground">{t("loadingPreviews")}</div>
      ) : selectedPatchPreview ? (
        <div className="flex-1 space-y-4 pb-20">
          {patchPreviews.length > 1 && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("groundedPatchPreview")}
              </label>
              <select
                value={selectedPatchPreview.id}
                onChange={(event) => setSelectedPatchPreviewId(event.target.value)}
                disabled={disabled || busy}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-foreground outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 disabled:opacity-60 shadow-sm"
              >
                {patchPreviews.map((preview) => (
                  <option key={preview.id} value={preview.id}>
                    {preview.title || t("groundedPatchPreview")} / {preview.status}
                  </option>
                ))}
              </select>
            </div>
          )}
          <PatchPreviewResult preview={selectedPatchPreview} />
          
          <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-border bg-surface/95 p-3 shadow-[-0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur md:static md:bg-transparent md:border-none md:shadow-none md:p-0">
            <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-none">
              <button
                type="button"
                onClick={handleVerifySandbox}
                disabled={disabled || sandboxPreview.isPending || !selectedPatchPreview}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-[13px] font-bold text-emerald-600 hover:bg-emerald-500/25 active:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
              >
                {sandboxPreview.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {t("verifyInSandbox")}
              </button>
              
              <PatchSnapshotAction
                disabled={disabled}
                sandbox={
                  sandboxPreview.data?.patchPreviewId === selectedPatchPreview.id
                    ? sandboxPreview.data
                    : null
                }
                snapshot={latestSnapshotForSelected}
                files={displayedSnapshotFiles}
                loading={createSnapshot.isPending}
                exportLoading={downloadSnapshotExport.isPending}
                writebackRequest={latestWritebackRequestForSnapshot}
                requesterNote={requesterNote}
                onRequesterNoteChange={setRequesterNote}
                writebackLoading={
                  createWritebackRequest.isPending ||
                  submitWritebackRequest.isPending ||
                  cancelWritebackRequest.isPending ||
                  executeWritebackRequest.isPending ||
                  downloadWorkingCopyExport.isPending
                }
                workingCopy={latestWorkingCopy}
                workingCopyFiles={latestWorkingCopyFiles}
                onCreate={handleCreateSnapshot}
                onExport={handleDownloadSnapshotExport}
                onRequestWriteback={handleCreateWritebackRequest}
                onSubmitWriteback={handleSubmitWritebackRequest}
                onCancelWriteback={handleCancelWritebackRequest}
                onExecuteWriteback={handleExecuteWritebackRequest}
                onDownloadWorkingCopyExport={handleDownloadWorkingCopyExport}
              />
            </div>
          </div>
          
          {sandboxPreview.data &&
            sandboxPreview.data.patchPreviewId === selectedPatchPreview.id && (
              <PatchSandboxResultView result={sandboxPreview.data} />
            )}
          {sandboxPreview.error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
              {t("sandboxFailed")}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          {t("groundedPatchPreview")}
        </div>
      )}
    </div>
  );
}

function PatchSnapshotAction({
  disabled,
  sandbox,
  snapshot,
  files,
  loading,
  exportLoading,
  writebackRequest,
  requesterNote,
  writebackLoading,
  workingCopy,
  workingCopyFiles,
  onRequesterNoteChange,
  onCreate,
  onExport,
  onRequestWriteback,
  onSubmitWriteback,
  onCancelWriteback,
  onExecuteWriteback,
  onDownloadWorkingCopyExport,
}: {
  disabled?: boolean;
  sandbox: PatchSandboxResult | null;
  snapshot: ProjectPatchSnapshot | null;
  files: ProjectPatchSnapshotFile[];
  loading: boolean;
  exportLoading: boolean;
  writebackRequest: ProjectWritebackRequest | null;
  requesterNote: string;
  writebackLoading: boolean;
  workingCopy: ProjectWorkingCopy | null;
  workingCopyFiles: ProjectWorkingCopyFile[];
  onRequesterNoteChange: (value: string) => void;
  onCreate: () => void;
  onExport: (snapshotId: string) => void;
  onRequestWriteback: (snapshotId: string) => void;
  onSubmitWriteback: (requestId: string) => void;
  onCancelWriteback: (requestId: string) => void;
  onExecuteWriteback: (requestId: string) => void;
  onDownloadWorkingCopyExport: (workingCopyId: string) => void;
}) {
  const { t } = useLocale();
  const canCreate = sandbox?.status === "verified" || sandbox?.status === "partial";

  return (
    <div className="space-y-2 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <ShieldCheck className="size-3 text-accent" />
            {t("versionedPatchSnapshot")}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("derivedSnapshotOnly")} {t("originalProjectFilesWereNotModified")}{" "}
            {t("sourceWritebackUnavailableYet")}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("derivedPreviewBundle")} {t("exportLimitedToIndexedText")}{" "}
            {t("sourceWritebackNotIncluded")}
          </div>
        </div>
        {snapshot && (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase text-emerald-300">
            {snapshot.status}
          </span>
        )}
      </div>

      {!snapshot && (
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled || loading || !canCreate}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ShieldCheck className="size-3" />
          )}
          {t("createVersionedSnapshot")}
        </button>
      )}

      {!snapshot && sandbox && !canCreate && (
        <div className="rounded border border-destructive/20 bg-destructive/10 p-2 text-[10px] text-destructive">
          {t("cannotCreateSnapshotFromBlockedSandbox")}
        </div>
      )}

      {snapshot && (
        <>
          <button
            type="button"
            onClick={() => onExport(snapshot.id)}
            disabled={disabled || exportLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            {exportLoading ? t("exportSnapshot") : t("downloadSnapshotExport")}
          </button>
          <div className="rounded border border-white/5 bg-black/10 p-2 text-[10px] leading-relaxed text-muted-foreground">
            {t("snapshotExportIncludesPatchedPreviewFilesOnly")}{" "}
            {t("originalProjectFilesWereNotModified")}
          </div>
          <PatchSnapshotResult snapshot={snapshot} files={files} />
          <WritebackRequestPanel
            disabled={disabled}
            snapshot={snapshot}
            request={writebackRequest}
            requesterNote={requesterNote}
            loading={writebackLoading}
            workingCopy={workingCopy}
            workingCopyFiles={workingCopyFiles}
            onRequesterNoteChange={onRequesterNoteChange}
            onCreate={onRequestWriteback}
            onSubmit={onSubmitWriteback}
            onCancel={onCancelWriteback}
            onExecute={onExecuteWriteback}
            onDownloadWorkingCopyExport={onDownloadWorkingCopyExport}
          />
        </>
      )}
    </div>
  );
}

function riskLabel(
  risk: ProjectWritebackRequest["riskLevel"],
  t: ReturnType<typeof useLocale>["t"],
) {
  if (risk === "low") return t("lowRisk");
  if (risk === "medium") return t("mediumRisk");
  if (risk === "high") return t("highRisk");
  return t("blockedRisk");
}

function WritebackRequestPanel({
  disabled,
  snapshot,
  request,
  requesterNote,
  loading,
  workingCopy,
  workingCopyFiles,
  onRequesterNoteChange,
  onCreate,
  onSubmit,
  onCancel,
  onExecute,
  onDownloadWorkingCopyExport,
}: {
  disabled?: boolean;
  snapshot: ProjectPatchSnapshot;
  request: ProjectWritebackRequest | null;
  requesterNote: string;
  loading: boolean;
  workingCopy: ProjectWorkingCopy | null;
  workingCopyFiles: ProjectWorkingCopyFile[];
  onRequesterNoteChange: (value: string) => void;
  onCreate: (snapshotId: string) => void;
  onSubmit: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  onExecute: (requestId: string) => void;
  onDownloadWorkingCopyExport: (workingCopyId: string) => void;
}) {
  const { t } = useLocale();
  const canSubmit = request?.status === "draft";
  const canCancel =
    request?.status === "draft" || (request?.status === "submitted" && !request.reviewedAt);
  const approved = request?.status === "approved";
  const rejected = request?.status === "rejected";
  const cancelled = request?.status === "cancelled";

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface-elevated/80 p-4 shadow-sm mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <ShieldCheck className="size-5 text-accent" />
            {t("sourceWritebackReview")}
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            {t("thisOnlyCreatesReviewRequest")} {t("approvalDoesNotApplyChanges")}
          </div>
        </div>
        {request && (
          <span className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
            {request.status}
          </span>
        )}
      </div>

      <details className="group rounded-xl border border-border bg-surface/50">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-foreground select-none">
          {t("metadata")} & {t("diagnostics")}
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <Metric
              label={t("changedFiles")}
              value={request?.changedFilesCount ?? snapshot.changedFilesCount}
            />
            <Metric
              label={t("riskLevel")}
              value={request ? riskLabel(request.riskLevel, t) : t("governanceReviewRequired")}
            />
          </div>

          {request && (
            <div className="space-y-3">
              <div className="text-xs leading-relaxed text-muted-foreground">
                {t("requestStatus")}: {request.status}. {t("sourceWritebackUnavailableYet")}
              </div>
              {request.status === "submitted" && (
                <div className="rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs font-medium text-warning">
                  {t("waitingForReview")} {t("approvalDoesNotApplyChanges")}
                </div>
              )}
              {approved && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-500">
                  {t("approvedForFutureWritebackConsideration")}
                </div>
              )}
              {rejected && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  {t("rejectedByReviewer")}
                </div>
              )}
              {cancelled && (
                <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs font-medium text-muted-foreground">
                  {t("writebackRequestCancelled")}
                </div>
              )}
              {request.requesterNote && (
                <SandboxTextBlock label={t("requesterNote")} text={request.requesterNote} />
              )}
              {request.reviewerNote && (
                <SandboxTextBlock label={t("reviewerNote")} text={request.reviewerNote} />
              )}
              {request.reviewedAt && (
                <div className="text-xs font-medium text-muted-foreground">
                  {t("reviewedAt")}: {new Date(request.reviewedAt).toLocaleString()}
                </div>
              )}
              {request.blockers.length > 0 && (
                <IssueList title={t("blockers")} issues={request.blockers} tone="blocker" />
              )}
              {request.warnings.length > 0 && (
                <IssueList title={t("conflicts")} issues={request.warnings} tone="warning" />
              )}
            </div>
          )}
        </div>
      </details>

      <div className="pt-2">
        {!request && (
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("requesterNote")}
            </label>
            <textarea
              value={requesterNote}
              onChange={(event) => onRequesterNoteChange(event.target.value)}
              placeholder={t("requesterNote")}
              disabled={disabled || loading}
              className="min-h-[120px] w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/40 focus:ring-1 focus:ring-accent/40 disabled:opacity-60 shadow-sm"
            />
            <button
              type="button"
              onClick={() => onCreate(snapshot.id)}
              disabled={disabled || loading || snapshot.changedFilesCount < 1}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-warning/30 bg-warning/15 px-4 text-[13px] font-bold text-warning hover:bg-warning/25 active:bg-warning/30 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {t("requestSourceWritebackReview")}
            </button>
          </div>
        )}

        {request && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {canSubmit && (
                <button
                  type="button"
                  onClick={() => onSubmit(request.id)}
                  disabled={disabled || loading}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-4 text-[13px] font-bold text-accent hover:bg-accent/25 active:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {t("submitRequest")}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(request.id)}
                  disabled={disabled || loading}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11px] font-semibold text-destructive hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  {t("cancelRequest")}
                </button>
              )}
            </div>
            {approved && (
            <WorkingCopyPanel
              disabled={disabled}
              loading={loading}
              request={request}
              workingCopy={workingCopy}
              files={workingCopyFiles}
              onExecute={onExecute}
              onDownloadExport={onDownloadWorkingCopyExport}
            />
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function WorkingCopyPanel({
  disabled,
  loading,
  request,
  workingCopy,
  files,
  onExecute,
  onDownloadExport,
}: {
  disabled?: boolean;
  loading: boolean;
  request: ProjectWritebackRequest;
  workingCopy: ProjectWorkingCopy | null;
  files: ProjectWorkingCopyFile[];
  onExecute: (requestId: string) => void;
  onDownloadExport: (workingCopyId: string) => void;
}) {
  const { t } = useLocale();
  const [selectedFileId, setSelectedFileId] = useState("");
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0] ?? null;

  useEffect(() => {
    if (files[0] && !files.some((file) => file.id === selectedFileId)) {
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  return (
    <div className="space-y-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <ShieldCheck className="size-3" />
            {t("versionedWorkingCopy")}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("executedFromApprovedRequest")} {t("executionDoesNotDeployChanges")}{" "}
            {t("productionSourceWritebackUnavailableYet")}
          </div>
        </div>
        {workingCopy && (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase text-emerald-300">
            {workingCopy.status}
          </span>
        )}
      </div>

      <div className="rounded border border-white/5 bg-black/10 p-2 text-[10px] leading-relaxed text-muted-foreground">
        {workingCopy ? t("versionedWorkingCopyCreatedNotice") : t("createVersionedWorkingCopy")}{" "}
        {t("sourceZipAndObjectStorageNotOverwritten")}
      </div>

      {!workingCopy && (
        <button
          type="button"
          onClick={() => onExecute(request.id)}
          disabled={disabled || loading || request.status !== "approved"}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ShieldCheck className="size-3" />
          )}
          {t("createVersionedWorkingCopy")}
        </button>
      )}

      {workingCopy && (
        <>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <Metric label={t("changedFiles")} value={workingCopy.changedFilesCount} />
            <Metric label={t("workingCopyFiles")} value={files.length} />
          </div>
          <div className="rounded border border-white/5 bg-black/10 p-2 text-[10px] leading-relaxed text-muted-foreground">
            {t("versionedWorkingCopyBundle")} {t("exportLimitedToWorkingCopyText")}{" "}
            {t("originalProjectFilesWereNotModified")}{" "}
            {t("sourceZipAndObjectStorageNotOverwritten")}
          </div>
          <button
            type="button"
            onClick={() => onDownloadExport(workingCopy.id)}
            disabled={disabled || loading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            {loading ? t("exportWorkingCopy") : t("downloadWorkingCopyExport")}
          </button>
          {files.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("workingCopyFiles")}
              </label>
              <select
                value={selectedFile?.id ?? ""}
                onChange={(event) => setSelectedFileId(event.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background/60 px-2 font-mono text-[11px] text-zinc-200 outline-none focus:border-accent/40"
              >
                {files.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.filePath}
                  </option>
                ))}
              </select>
              {selectedFile && (
                <div className="space-y-2 rounded border border-white/5 bg-black/10 p-2">
                  <div className="truncate font-mono text-[10px] text-zinc-300" dir="ltr">
                    {selectedFile.filePath} / {shortHash(selectedFile.contentSha256)}
                  </div>
                  <SandboxTextBlock label={t("patchedPreview")} text={selectedFile.contentText} />
                  {selectedFile.truncated && (
                    <div className="text-[10px] text-warning">{t("previewTruncatedForSafety")}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PatchSnapshotResult({
  snapshot,
  files,
}: {
  snapshot: ProjectPatchSnapshot;
  files: ProjectPatchSnapshotFile[];
}) {
  const { t } = useLocale();
  const changedFiles = files.filter((file) => file.changed);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <Metric label={t("changedFiles")} value={snapshot.changedFilesCount} />
        <Metric label={t("snapshotFiles")} value={files.length} />
      </div>
      <div className="text-[11px] leading-relaxed text-muted-foreground">
        {snapshot.summary || t("snapshotCreated")} {t("snapshotLimitedToIndexedText")}
      </div>
      {changedFiles.length === 0 && (
        <div className="rounded border border-white/5 bg-black/10 p-2 text-[10px] text-muted-foreground">
          {t("noChangedFiles")}
        </div>
      )}
      {changedFiles.map((file) => (
        <div key={file.id} className="space-y-2 rounded border border-white/5 bg-black/10 p-2">
          <div className="truncate font-mono text-[10px] text-zinc-300" dir="ltr">
            {file.filePath} / {shortHash(file.patchedContentSha256)}
          </div>
          <SandboxTextBlock label={t("originalPreview")} text={file.originalPreviewText ?? ""} />
          <SandboxTextBlock label={t("patchedPreview")} text={file.patchedPreviewText ?? ""} />
          {file.truncated && (
            <div className="text-[10px] text-warning">{t("previewTruncatedForSafety")}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function sandboxStatusLabel(
  status: PatchSandboxResult["status"],
  t: ReturnType<typeof useLocale>["t"],
) {
  if (status === "verified") return t("sandboxVerified");
  if (status === "blocked") return t("sandboxBlocked");
  if (status === "partial") return t("sandboxPartial");
  return t("sandboxFailed");
}

function PatchSandboxResultView({ result }: { result: PatchSandboxResult }) {
  const { t } = useLocale();
  const statusClass =
    result.status === "verified"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : result.status === "blocked" || result.status === "failed"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-warning/30 bg-warning/10 text-warning";

  return (
    <div className="space-y-3 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <ShieldCheck className="size-3 text-accent" />
            {t("patchSandbox")}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("noProjectFilesModified")} {t("sandboxLimitedToIndexedText")}
          </div>
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${statusClass}`}>
          {sandboxStatusLabel(result.status, t)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <Metric label={t("wouldChange")} value={result.summary.changedFiles} />
        <Metric label={t("generatedChanges")} value={result.summary.changesApplied} />
      </div>

      {result.blockers.length > 0 && (
        <IssueList title={t("blockers")} issues={result.blockers} tone="blocker" />
      )}
      {result.warnings.length > 0 && (
        <IssueList title={t("conflicts")} issues={result.warnings} tone="warning" />
      )}

      {result.files.map((file) => (
        <div
          key={file.filePath}
          className="space-y-2 rounded border border-white/5 bg-black/10 p-2"
        >
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-300" dir="ltr">
            <CheckCircle2 className="size-3 text-accent" />
            <span className="min-w-0 flex-1 truncate">{file.filePath}</span>
            {file.changed && <span className="text-emerald-300">{t("wouldChange")}</span>}
          </div>
          {file.blockers.length > 0 && (
            <IssueList title={t("blockers")} issues={file.blockers} tone="blocker" />
          )}
          <div className="grid gap-2">
            <SandboxTextBlock label={t("before")} text={file.oldPreviewText} />
            <SandboxTextBlock label={t("after")} text={file.sandboxPatchedText} />
          </div>
          {file.truncated && (
            <div className="text-[10px] text-warning">{t("previewTruncatedForSafety")}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { code: string; message: string; filePath?: string }[];
  tone: "warning" | "blocker";
}) {
  const toneClass = tone === "blocker" ? "text-destructive" : "text-warning";
  return (
    <div className="space-y-1 rounded border border-white/5 bg-black/10 p-2">
      <div className={`text-[10px] font-semibold uppercase tracking-widest ${toneClass}`}>
        {title}
      </div>
      {issues.map((item, index) => (
        <div
          key={`${item.code}-${item.filePath ?? ""}-${index}`}
          className={`text-[10px] ${toneClass}`}
        >
          {item.filePath ? `${item.filePath}: ` : ""}
          {item.message}
        </div>
      ))}
    </div>
  );
}

function SandboxTextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-72 overflow-auto rounded border border-white/5 bg-black/35 p-2 font-mono text-[10px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
        {text || "(empty)"}
      </pre>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-zinc-200">{value}</div>
    </div>
  );
}

function GroundedFileMeta({ file }: { file: ProjectFile }) {
  const { t } = useLocale();
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-300" dir="ltr">
        <FileCode2 className="size-3 text-accent" />
        <span className="min-w-0 flex-1 truncate">{file.path}</span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {t("groundedFiles")}: {shortHash(file.content_sha256 ?? file.checksum)}
      </div>
    </div>
  );
}

function PatchPreviewResult({ preview }: { preview: GroundedPatchPreview }) {
  const { t } = useLocale();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const activeChange = preview.changes[activeFileIndex];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface-elevated/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-foreground">
            {preview.title || t("groundedPatchPreview")}
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            {t("thisPatchNotApplied")}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
            preview.status === "ready"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-warning/30 bg-warning/10 text-warning"
          }`}
        >
          {preview.status}
        </span>
      </div>

      {preview.warnings.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warning/20 bg-warning/5 p-3">
          {preview.warnings.map((warning) => (
            <div
              key={`${warning.code}-${warning.filePath ?? ""}`}
              className="flex gap-2 text-xs font-medium text-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {preview.changes.length > 0 && (
        <div className="mt-4">
          {/* File-based Navigation */}
          {preview.changes.length > 1 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {preview.changes.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setActiveFileIndex(i)}
                  className={`min-h-[44px] shrink-0 rounded-xl px-4 text-[13px] font-semibold transition-colors ${
                    i === activeFileIndex
                      ? "bg-accent/15 text-accent border border-accent/20 shadow-sm"
                      : "bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground border border-border/50"
                  }`}
                >
                  {c.filePath.split("/").pop()}
                </button>
              ))}
            </div>
          )}

          {/* Diff Viewer with Collapsible Chunks */}
          {activeChange && (
            <div className="overflow-hidden rounded-xl border border-border bg-background/50 shadow-sm">
              <div className="flex min-h-[44px] items-center justify-between border-b border-border bg-surface px-4 py-2">
                <span className="truncate text-xs font-semibold text-muted-foreground">
                  {activeChange.filePath}
                </span>
                <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {activeChange.changeType}
                </span>
              </div>
              
              <div className="p-3">
                {activeChange.hunks?.length > 0 ? (
                  activeChange.hunks.map((hunk, hi) => (
                    <details key={hi} className="group mb-3 last:mb-0" open>
                      <summary className="cursor-pointer select-none rounded-lg bg-accent/5 px-3 py-2 text-xs font-semibold font-mono text-accent/90 hover:bg-accent/10 transition-colors">
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </summary>
                      <pre className="mt-2 overflow-x-auto font-mono text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                        {hunk.lines.map((l, li) => {
                          const isAdd = l.startsWith("+");
                          const isSub = l.startsWith("-");
                          const color = isAdd
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : isSub
                              ? "bg-destructive/15 text-destructive-foreground dark:text-destructive"
                              : "text-zinc-600 dark:text-zinc-400";
                          return (
                            <div key={li} className={`px-3 py-0.5 ${color}`}>
                              {l}
                            </div>
                          );
                        })}
                      </pre>
                    </details>
                  ))
                ) : (
                  <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-300">
                    {activeChange.unifiedDiff}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
