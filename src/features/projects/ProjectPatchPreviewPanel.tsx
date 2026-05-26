import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileCode2, Loader2, ShieldCheck, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/features/i18n/localeContext";
import { AI_PATCH_LIMITS } from "./aiPatchPreview";
import {
  useCreateAiPatchPreviewMutation,
  useCreatePatchPreviewMutation,
  usePatchPreviewsQuery,
  usePreviewablePatchTargetsQuery,
} from "./projectQueries";
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
  const createPreview = useCreatePatchPreviewMutation();
  const createAiPreview = useCreateAiPatchPreviewMutation();
  const [selectedFileId, setSelectedFileId] = useState("");
  const [selectedAiFileIds, setSelectedAiFileIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");

  const previewsByFileId = useMemo(
    () => new Map(previews.map((preview) => [preview.file_id, preview])),
    [previews],
  );
  const previewableTargets = targets.filter((target) => previewsByFileId.has(target.id));
  const selectedTarget = previewableTargets.find((target) => target.id === selectedFileId) ?? null;
  const latestPreview = patchPreviews[0] ?? null;
  const busy = createPreview.isPending || createAiPreview.isPending;

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
        {t("applyUnavailableYet")}
      </button>

      {previewsLoading ? (
        <div className="text-xs text-muted-foreground">{t("loadingProjects")}</div>
      ) : latestPreview ? (
        <PatchPreviewResult preview={latestPreview} />
      ) : (
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          {t("groundedPatchPreview")}
        </div>
      )}
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
  const change = preview.changes[0] ?? null;

  return (
    <div className="space-y-2 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-zinc-200">
            {preview.title || t("groundedPatchPreview")}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{t("thisPatchNotApplied")}</div>
        </div>
        <span
          className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${
            preview.status === "ready"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-warning/30 bg-warning/10 text-warning"
          }`}
        >
          {preview.status}
        </span>
      </div>

      {preview.groundedFiles.length > 0 && (
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <div className="font-semibold uppercase tracking-widest">{t("groundedFiles")}</div>
          {preview.groundedFiles.map((file) => (
            <div key={file.fileId} className="truncate font-mono" dir="ltr">
              {file.path} / {shortHash(file.contentSha256)}
            </div>
          ))}
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="space-y-1 rounded border border-warning/20 bg-warning/5 p-2">
          {preview.warnings.map((warning) => (
            <div
              key={`${warning.code}-${warning.filePath ?? ""}`}
              className="flex gap-2 text-[10px] text-warning"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {change && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("unifiedDiff")} / {t("generatedChanges")}
          </div>
          <pre className="max-h-80 overflow-auto rounded border border-white/5 bg-black/35 p-2 font-mono text-[10px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {change.unifiedDiff}
          </pre>
        </div>
      )}
    </div>
  );
}
