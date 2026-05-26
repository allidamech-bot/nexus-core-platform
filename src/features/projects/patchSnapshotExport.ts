import type { Json } from "@/integrations/supabase/types";
import { isSensitivePreviewPath } from "./projectFileTree";
import type { GroundedPatchPreview } from "./patchPreviewTypes";
import type { ProjectPatchSnapshot, ProjectPatchSnapshotFile } from "./patchSnapshot";

export const SNAPSHOT_EXPORT_LIMITS = {
  maxFiles: 100,
  maxFileTextBytes: 100_000,
  maxTotalBytes: 5_000_000,
  maxFilenameLength: 180,
} as const;

const BLOCKED_EXPORT_SEGMENTS = new Set([".git", ".hg", ".svn"]);

export interface PatchSnapshotExportFile {
  filePath: string;
  exportPath: string;
  originalExportPath: string | null;
  diffExportPath: string | null;
  changed: boolean;
  previewLimited: boolean;
  truncated: boolean;
  originalContentSha256: string | null;
  patchedContentSha256: string | null;
  warnings: ProjectPatchSnapshotFile["warnings"];
  blockers: ProjectPatchSnapshotFile["blockers"];
  originalPreviewText: string | null;
  patchedPreviewText: string | null;
}

export interface PatchSnapshotExportManifest {
  projectId: string;
  snapshotId: string;
  patchPreviewId: string;
  createdAt: string;
  exportedAt: string;
  changedFilesCount: number;
  source: "derived snapshot";
  originalProjectFilesModified: false;
  exportLimitedToIndexedPreviewText: true;
  files: Omit<PatchSnapshotExportFile, "originalPreviewText" | "patchedPreviewText">[];
  warnings: ProjectPatchSnapshot["warnings"];
  blockers: ProjectPatchSnapshot["blockers"];
  metadata: Json;
}

export interface PatchSnapshotExportBundle {
  readme: string;
  manifest: PatchSnapshotExportManifest;
  patchPreview: GroundedPatchPreview | null;
  sandboxSummary: Json;
  snapshot: ProjectPatchSnapshot;
  files: PatchSnapshotExportFile[];
  diffs: { filePath: string; exportPath: string; unifiedDiff: string }[];
  metadata: ReturnType<typeof createSnapshotExportMetadata>;
}

export interface SnapshotExportAccessInput {
  snapshotId: unknown;
  userId?: unknown;
}

export function validateSnapshotExportAccessInput(input: SnapshotExportAccessInput): string {
  if (typeof input.userId !== "string" || !input.userId) {
    throw new Error("Unauthorized");
  }
  if (typeof input.snapshotId !== "string" || !input.snapshotId) {
    throw new Error("Snapshot id required");
  }
  return input.snapshotId;
}

function byteSize(value: string) {
  return new TextEncoder().encode(value).length;
}

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function compactSegment(segment: string) {
  return segment
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/[<>:"|?*]/g, "_")
    .trim();
}

export function sanitizeExportFilePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized) throw new Error("Export path is empty.");
  if (normalized.startsWith("/") || normalized.startsWith("~")) {
    throw new Error("Absolute export paths are blocked.");
  }
  if (/^[A-Za-z]:/.test(normalized)) {
    throw new Error("Windows drive export paths are blocked.");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) throw new Error("Export path is empty.");
  if (
    segments.some(
      (segment) => segment === "." || segment === ".." || BLOCKED_EXPORT_SEGMENTS.has(segment),
    )
  ) {
    throw new Error("Unsafe export path segment is blocked.");
  }
  if (isSensitivePreviewPath(segments.join("/"))) {
    throw new Error("Sensitive files are blocked from snapshot exports.");
  }

  const sanitized = segments.map(compactSegment).filter(Boolean).join("/");
  if (!sanitized || sanitized.length > SNAPSHOT_EXPORT_LIMITS.maxFilenameLength) {
    throw new Error("Export filename length limit exceeded.");
  }
  return sanitized;
}

function createDiffPath(safePath: string) {
  return `snapshot-export/diffs/${safePath}.patch`;
}

export function buildPatchSnapshotExportFiles(
  snapshotFiles: ProjectPatchSnapshotFile[],
): PatchSnapshotExportFile[] {
  return snapshotFiles.map((file) => {
    const safePath = sanitizeExportFilePath(file.filePath);
    return {
      filePath: file.filePath,
      exportPath: `snapshot-export/patched/${safePath}`,
      originalExportPath: file.originalPreviewText
        ? `snapshot-export/original-preview/${safePath}`
        : null,
      diffExportPath: file.changed ? createDiffPath(safePath) : null,
      changed: file.changed,
      previewLimited: file.previewLimited,
      truncated: file.truncated,
      originalContentSha256: file.originalContentSha256,
      patchedContentSha256: file.patchedContentSha256,
      warnings: file.warnings,
      blockers: file.blockers,
      originalPreviewText: file.originalPreviewText,
      patchedPreviewText: file.patchedPreviewText,
    };
  });
}

export function createSnapshotExportReadme(snapshot: ProjectPatchSnapshot) {
  return [
    "# Snapshot export README",
    "",
    "This is a derived preview bundle for external review.",
    "Original project files were not modified.",
    "Source writeback is not included.",
    "The export is limited to indexed preview text stored in the versioned patch snapshot.",
    "Patched files in this bundle are preview text only and may be truncated.",
    "",
    `Snapshot: ${snapshot.id}`,
    `Patch preview: ${snapshot.patchPreviewId}`,
    `Project: ${snapshot.projectId}`,
    `Created: ${snapshot.createdAt}`,
  ].join("\n");
}

export function createSnapshotExportMetadata(input: {
  snapshot: ProjectPatchSnapshot;
  exportedAt: string;
}) {
  return {
    phase: "88",
    exportedAt: input.exportedAt,
    derivedPreviewBundle: true,
    originalProjectFilesModified: false,
    originalTextPreviewsModified: false,
    sourceWritebackIncluded: false,
    storageWritebackIncluded: false,
    limitedToIndexedPreviewText: true,
    format: "json",
  };
}

export function buildPatchSnapshotExportManifest(input: {
  snapshot: ProjectPatchSnapshot;
  files: PatchSnapshotExportFile[];
  exportedAt?: string;
}): PatchSnapshotExportManifest {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  return {
    projectId: input.snapshot.projectId,
    snapshotId: input.snapshot.id,
    patchPreviewId: input.snapshot.patchPreviewId,
    createdAt: input.snapshot.createdAt,
    exportedAt,
    changedFilesCount: input.snapshot.changedFilesCount,
    source: "derived snapshot",
    originalProjectFilesModified: false,
    exportLimitedToIndexedPreviewText: true,
    files: input.files.map(
      ({ originalPreviewText: _original, patchedPreviewText: _patched, ...file }) => file,
    ),
    warnings: input.snapshot.warnings,
    blockers: input.snapshot.blockers,
    metadata: input.snapshot.metadata,
  };
}

function buildDiffs(files: PatchSnapshotExportFile[]) {
  return files.flatMap((file) => {
    if (!file.changed || !file.diffExportPath) return [];
    const originalLines = (file.originalPreviewText ?? "").split("\n");
    const patchedLines = (file.patchedPreviewText ?? "").split("\n");
    return [
      {
        filePath: file.filePath,
        exportPath: file.diffExportPath,
        unifiedDiff: [
          `--- a/${file.filePath}`,
          `+++ b/${file.filePath}`,
          `@@ -1,${originalLines.length} +1,${patchedLines.length} @@`,
          ...originalLines.map((line) => `-${line}`),
          ...patchedLines.map((line) => `+${line}`),
        ].join("\n"),
      },
    ];
  });
}

export function enforceSnapshotExportLimits(input: {
  files: PatchSnapshotExportFile[];
  bundleText?: string;
}): void {
  if (input.files.length > SNAPSHOT_EXPORT_LIMITS.maxFiles) {
    throw new Error("Export file limit exceeded.");
  }

  let totalBytes = 0;
  for (const file of input.files) {
    const originalBytes = byteSize(file.originalPreviewText ?? "");
    const patchedBytes = byteSize(file.patchedPreviewText ?? "");
    if (
      originalBytes > SNAPSHOT_EXPORT_LIMITS.maxFileTextBytes ||
      patchedBytes > SNAPSHOT_EXPORT_LIMITS.maxFileTextBytes
    ) {
      throw new Error("Export size limit exceeded.");
    }
    totalBytes += originalBytes + patchedBytes;
  }

  if (input.bundleText) totalBytes += byteSize(input.bundleText);
  if (totalBytes > SNAPSHOT_EXPORT_LIMITS.maxTotalBytes) {
    throw new Error("Export size limit exceeded.");
  }
}

export function createSnapshotExportBundle(input: {
  snapshot: ProjectPatchSnapshot;
  snapshotFiles: ProjectPatchSnapshotFile[];
  patchPreview: GroundedPatchPreview | null;
  exportedAt?: string;
}): PatchSnapshotExportBundle {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const files = buildPatchSnapshotExportFiles(input.snapshotFiles);
  enforceSnapshotExportLimits({ files });

  const metadata = createSnapshotExportMetadata({ snapshot: input.snapshot, exportedAt });
  const bundle: PatchSnapshotExportBundle = {
    readme: createSnapshotExportReadme(input.snapshot),
    manifest: buildPatchSnapshotExportManifest({
      snapshot: input.snapshot,
      files,
      exportedAt,
    }),
    patchPreview: input.patchPreview,
    sandboxSummary: asRecord(input.snapshot.metadata).sandbox_summary as Json,
    snapshot: input.snapshot,
    files,
    diffs: buildDiffs(files),
    metadata,
  };

  const bundleText = JSON.stringify(bundle);
  enforceSnapshotExportLimits({ files, bundleText });
  return bundle;
}
