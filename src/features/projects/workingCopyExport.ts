import type { Json } from "@/integrations/supabase/types";
import { isSensitivePreviewPath } from "./projectFileTree";
import type { ProjectWorkingCopy, ProjectWorkingCopyFile } from "./projectWorkingCopyService";

export const WORKING_COPY_EXPORT_LIMITS = {
  maxFiles: 150,
  maxFileTextBytes: 150_000,
  maxTotalBytes: 8_000_000,
  maxFilenameLength: 180,
} as const;

const BLOCKED_EXPORT_SEGMENTS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  ".vercel",
]);

export interface WorkingCopyExportFile {
  filePath: string;
  exportPath: string;
  changed: boolean;
  previewLimited: boolean;
  truncated: boolean;
  contentSha256: string | null;
  sizeBytes: number;
  warnings: ProjectWorkingCopyFile["warnings"];
  blockers: ProjectWorkingCopyFile["blockers"];
  contentText: string;
}

export interface WorkingCopyExportManifest {
  projectId: string;
  workingCopyId: string;
  writebackRequestId: string;
  patchSnapshotId: string;
  createdAt: string;
  exportedAt: string;
  changedFilesCount: number;
  source: "versioned working copy";
  originalProjectFilesModified: false;
  sourceZipOverwritten: false;
  objectStorageModified: false;
  productionWritebackIncluded: false;
  exportLimitedToWorkingCopyText: true;
  files: Omit<WorkingCopyExportFile, "contentText">[];
  warnings: ProjectWorkingCopy["warnings"];
  blockers: ProjectWorkingCopy["blockers"];
  metadata: Json;
}

export interface WorkingCopyExportBundle {
  readme: string;
  manifest: WorkingCopyExportManifest;
  workingCopy: ProjectWorkingCopy;
  request: {
    id: string;
    status: string;
    reviewedAt: string | null;
    reviewerId: string | null;
    requesterNote: string | null;
    reviewerNote: string | null;
  } | null;
  files: WorkingCopyExportFile[];
  warnings: ProjectWorkingCopy["warnings"];
  blockers: ProjectWorkingCopy["blockers"];
  metadata: ReturnType<typeof createWorkingCopyExportMetadata>;
}

function byteSize(value: string) {
  return new TextEncoder().encode(value).length;
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

export function sanitizeWorkingCopyExportPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized) throw new Error("Working copy export path is empty.");
  if (normalized.startsWith("/") || normalized.startsWith("~")) {
    throw new Error("Absolute working copy export paths are blocked.");
  }
  if (/^[A-Za-z]:/.test(normalized)) {
    throw new Error("Windows drive working copy export paths are blocked.");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) throw new Error("Working copy export path is empty.");
  if (
    segments.some(
      (segment) => segment === "." || segment === ".." || BLOCKED_EXPORT_SEGMENTS.has(segment),
    )
  ) {
    throw new Error("Unsafe working copy export path segment is blocked.");
  }
  if (isSensitivePreviewPath(segments.join("/"))) {
    throw new Error("Sensitive files are blocked from working copy exports.");
  }

  const sanitized = segments.map(compactSegment).filter(Boolean).join("/");
  if (!sanitized || sanitized.length > WORKING_COPY_EXPORT_LIMITS.maxFilenameLength) {
    throw new Error("Working copy export filename length limit exceeded.");
  }
  return sanitized;
}

export function buildWorkingCopyExportFiles(
  workingCopyFiles: ProjectWorkingCopyFile[],
): WorkingCopyExportFile[] {
  return workingCopyFiles.map((file) => {
    const safePath = sanitizeWorkingCopyExportPath(file.filePath);
    return {
      filePath: file.filePath,
      exportPath: `working-copy/files/${safePath}`,
      changed: file.changed,
      previewLimited: file.previewLimited,
      truncated: file.truncated,
      contentSha256: file.contentSha256,
      sizeBytes: file.sizeBytes,
      warnings: file.warnings,
      blockers: file.blockers,
      contentText: file.contentText,
    };
  });
}

export function createWorkingCopyExportReadme(workingCopy: ProjectWorkingCopy) {
  return [
    "# Versioned working copy bundle",
    "",
    "This is a safe review export of a versioned working copy.",
    "Original project files were not modified.",
    "Source ZIP and object storage were not overwritten.",
    "Production/source writeback is not available yet and is not included.",
    "The export is limited to text stored in project_working_copy_files.",
    "Files in this bundle may be preview-limited or truncated.",
    "",
    `Working copy: ${workingCopy.id}`,
    `Writeback request: ${workingCopy.writebackRequestId}`,
    `Patch snapshot: ${workingCopy.patchSnapshotId}`,
    `Project: ${workingCopy.projectId}`,
    `Created: ${workingCopy.createdAt}`,
  ].join("\n");
}

export function createWorkingCopyExportMetadata(input: {
  workingCopy: ProjectWorkingCopy;
  exportedAt: string;
}) {
  return {
    phase: "92",
    exportedAt: input.exportedAt,
    format: "json",
    source: "versioned_working_copy",
    dataSources: ["project_working_copies", "project_working_copy_files"],
    originalProjectFilesModified: false,
    originalTextPreviewsModified: false,
    sourceZipOverwritten: false,
    objectStorageModified: false,
    productionWritebackIncluded: false,
    deploymentPerformed: false,
    limitedToWorkingCopyText: true,
  };
}

export function buildWorkingCopyExportManifest(input: {
  workingCopy: ProjectWorkingCopy;
  files: WorkingCopyExportFile[];
  exportedAt?: string;
}): WorkingCopyExportManifest {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  return {
    projectId: input.workingCopy.projectId,
    workingCopyId: input.workingCopy.id,
    writebackRequestId: input.workingCopy.writebackRequestId,
    patchSnapshotId: input.workingCopy.patchSnapshotId,
    createdAt: input.workingCopy.createdAt,
    exportedAt,
    changedFilesCount: input.workingCopy.changedFilesCount,
    source: "versioned working copy",
    originalProjectFilesModified: false,
    sourceZipOverwritten: false,
    objectStorageModified: false,
    productionWritebackIncluded: false,
    exportLimitedToWorkingCopyText: true,
    files: input.files.map(({ contentText: _contentText, ...file }) => file),
    warnings: input.workingCopy.warnings,
    blockers: input.workingCopy.blockers,
    metadata: input.workingCopy.metadata,
  };
}

export function enforceWorkingCopyExportLimits(input: {
  files: WorkingCopyExportFile[];
  bundleText?: string;
}): void {
  if (input.files.length > WORKING_COPY_EXPORT_LIMITS.maxFiles) {
    throw new Error("Working copy export file limit exceeded.");
  }

  let totalBytes = 0;
  for (const file of input.files) {
    const contentBytes = byteSize(file.contentText);
    if (contentBytes > WORKING_COPY_EXPORT_LIMITS.maxFileTextBytes) {
      throw new Error("Working copy export size limit exceeded.");
    }
    totalBytes += contentBytes;
  }

  if (input.bundleText) totalBytes += byteSize(input.bundleText);
  if (totalBytes > WORKING_COPY_EXPORT_LIMITS.maxTotalBytes) {
    throw new Error("Working copy export size limit exceeded.");
  }
}

export function createWorkingCopyExportBundle(input: {
  workingCopy: ProjectWorkingCopy;
  workingCopyFiles: ProjectWorkingCopyFile[];
  request?: WorkingCopyExportBundle["request"];
  exportedAt?: string;
}): WorkingCopyExportBundle {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const files = buildWorkingCopyExportFiles(input.workingCopyFiles);
  enforceWorkingCopyExportLimits({ files });

  const metadata = createWorkingCopyExportMetadata({
    workingCopy: input.workingCopy,
    exportedAt,
  });
  const bundle: WorkingCopyExportBundle = {
    readme: createWorkingCopyExportReadme(input.workingCopy),
    manifest: buildWorkingCopyExportManifest({
      workingCopy: input.workingCopy,
      files,
      exportedAt,
    }),
    workingCopy: input.workingCopy,
    request: input.request ?? null,
    files,
    warnings: input.workingCopy.warnings,
    blockers: input.workingCopy.blockers,
    metadata,
  };

  const bundleText = JSON.stringify(bundle);
  enforceWorkingCopyExportLimits({ files, bundleText });
  return bundle;
}
