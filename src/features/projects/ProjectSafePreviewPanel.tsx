import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FileQuestion,
  Folder,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";
import type {
  ProjectFile,
  ProjectIngestionJob,
  ProjectManifest,
  ProjectTextPreviewWithPath,
} from "./types";
import {
  buildProjectFileTree,
  isSensitivePreviewPath,
  type ProjectFileTreeNode,
} from "./projectFileTree";

const PREVIEW_CHAR_LIMIT = 4000;

function formatSize(size: number | null) {
  if (size === null) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function statusMessage(status: string | null | undefined, t: ReturnType<typeof useLocale>["t"]) {
  if (status === "rejected") return t("unsafeFileRejected");
  if (status === "failed") return t("zipProcessingFailed");
  if (status === "completed" || status === "indexed_manifest") return t("previewReady");
  if (status === "processing" || status === "validating" || status === "uploaded") {
    return t("zipProcessingStarted");
  }
  return t("projectNotProcessedYet");
}

export function ProjectSafePreviewPanel({
  files,
  previews,
  manifest,
  latestJob,
  loading,
}: {
  files: ProjectFile[];
  previews: ProjectTextPreviewWithPath[];
  manifest: ProjectManifest | null;
  latestJob: ProjectIngestionJob | null;
  loading: boolean;
}) {
  const { t } = useLocale();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const tree = useMemo(() => buildProjectFileTree(files), [files]);
  const previewsByFileId = useMemo(
    () => new Map(previews.map((preview) => [preview.file_id, preview])),
    [previews],
  );
  const selectedFile =
    files.find((file) => file.id === selectedFileId) ??
    files.find((file) => file.is_previewable && !file.skipped) ??
    files[0] ??
    null;
  const selectedPreview = selectedFile ? (previewsByFileId.get(selectedFile.id) ?? null) : null;
  const skippedCount = files.filter((file) => file.skipped).length;
  const indexedCount = files.filter((file) => !file.skipped).length;
  const status = latestJob?.status ?? null;
  const ready = status === "completed" || files.length > 0;

  if (loading) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
        {t("loadingProjects")}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 font-semibold text-zinc-200">
          <ShieldCheck className="size-3 text-accent" />
          {t("safePreview")}
        </div>
        {statusMessage(status, t)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label={t("indexedFiles")} value={manifest?.file_count ?? indexedCount} />
        <Metric label={t("skippedFiles")} value={manifest?.skipped_file_count ?? skippedCount} />
        <Metric label={t("previews")} value={previews.length} />
      </div>

      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-200">
            <CheckCircle2 className="size-3 text-emerald-400" />
            {statusMessage(status, t)}
          </div>
          <span className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] uppercase text-accent">
            {t("safePreview")}
          </span>
        </div>
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          {t("unsupportedFilesSkippedSafely")}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 rounded-md border border-border bg-background/40">
          <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("fileTree")}
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {tree.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">{t("noPreviewAvailable")}</div>
            ) : (
              <FileTree
                nodes={tree}
                selectedFileId={selectedFile?.id ?? null}
                onSelectFile={setSelectedFileId}
                skippedLabel={t("skippedFiles")}
              />
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-md border border-border bg-background/40">
          <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("safePreview")}
          </div>
          <ProjectFilePreview file={selectedFile} preview={selectedPreview} />
        </section>
      </div>
    </div>
  );
}

function FileTree({
  nodes,
  selectedFileId,
  onSelectFile,
  skippedLabel,
  depth = 0,
}: {
  nodes: ProjectFileTreeNode[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
  skippedLabel: string;
  depth?: number;
}) {
  return (
    <div className="space-y-0.5 font-mono text-[11px]">
      {nodes.map((node) =>
        node.type === "directory" ? (
          <div key={node.path}>
            <div
              className="flex items-center gap-1.5 rounded px-2 py-1 text-zinc-300"
              style={{ paddingInlineStart: 8 + depth * 12 }}
            >
              {depth === 0 ? (
                <FolderOpen className="size-3 text-muted-foreground" />
              ) : (
                <Folder className="size-3 text-muted-foreground" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            <FileTree
              nodes={node.children}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              skippedLabel={skippedLabel}
              depth={depth + 1}
            />
          </div>
        ) : (
          <FileTreeFile
            key={node.file.id}
            node={node}
            active={node.file.id === selectedFileId}
            depth={depth}
            onSelectFile={onSelectFile}
            skippedLabel={skippedLabel}
          />
        ),
      )}
    </div>
  );
}

function FileTreeFile({
  node,
  active,
  depth,
  onSelectFile,
  skippedLabel,
}: {
  node: Extract<ProjectFileTreeNode, { type: "file" }>;
  active: boolean;
  depth: number;
  onSelectFile: (fileId: string) => void;
  skippedLabel: string;
}) {
  const Icon = node.file.skipped ? FileQuestion : node.file.is_text ? FileCode2 : Binary;
  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.file.id)}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-start hover:bg-white/5 ${
        active ? "bg-accent/10 text-accent" : "text-zinc-400"
      }`}
      style={{ paddingInlineStart: 8 + depth * 12 }}
    >
      <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      <Icon className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {node.file.skipped && (
        <span className="shrink-0 rounded border border-warning/20 px-1 text-[9px] text-warning">
          {skippedLabel}
        </span>
      )}
    </button>
  );
}

function ProjectFilePreview({
  file,
  preview,
}: {
  file: ProjectFile | null;
  preview: ProjectTextPreviewWithPath | null;
}) {
  const { t } = useLocale();

  if (!file) {
    return <EmptyPreview message={t("selectFileToPreview")} />;
  }

  const sensitive = isSensitivePreviewPath(file.path);
  const blockedReason = file.skipped
    ? (file.skip_reason ?? t("thisFileWasSkipped"))
    : sensitive
      ? t("noPreviewAvailable")
      : !file.is_text
        ? t("binaryFilePreviewDisabled")
        : !file.is_previewable
          ? t("unsupportedFileType")
          : !preview
            ? t("noPreviewAvailable")
            : null;
  const safePreview = blockedReason ? null : preview;

  return (
    <div className="min-w-0 p-3">
      <div className="mb-3 min-w-0">
        <div className="truncate font-mono text-[11px] text-zinc-200" dir="ltr">
          {file.path}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <span>{formatSize(file.size_bytes)}</span>
          {file.extension && <span>{file.extension}</span>}
          {preview?.detected_language && <span>{preview.detected_language}</span>}
        </div>
      </div>

      {blockedReason ? (
        <div className="rounded-md border border-border bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-semibold text-zinc-200">
            <AlertTriangle className="size-3 text-warning" />
            {file.skipped ? t("thisFileWasSkipped") : t("noPreviewAvailable")}
          </div>
          {blockedReason}
        </div>
      ) : (
        <>
          <pre className="max-h-96 overflow-auto rounded-md border border-white/5 bg-black/35 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {safePreview?.preview_text.slice(0, PREVIEW_CHAR_LIMIT)}
          </pre>
          {(safePreview?.truncated ||
            Number(safePreview?.preview_text.length ?? 0) > PREVIEW_CHAR_LIMIT) && (
            <div className="mt-2 text-[10px] text-warning">{t("previewTruncatedForSafety")}</div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyPreview({ message }: { message: string }) {
  return <div className="p-3 text-xs leading-relaxed text-muted-foreground">{message}</div>;
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
