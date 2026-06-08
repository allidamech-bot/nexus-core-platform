import type { GroundedPatchPreview, PatchPreviewWarning } from "./patchPreviewTypes";
import type { ProjectFile, ProjectTextPreviewWithPath } from "./types";

export type PatchSandboxStatus = "verified" | "blocked" | "partial" | "failed";

export interface PatchSandboxIssue extends PatchPreviewWarning {
  severity: "warning" | "blocker";
}

export interface PatchSandboxFileResult {
  filePath: string;
  contentSha256: string | null;
  oldPreviewText: string;
  sandboxPatchedText: string;
  changed: boolean;
  changesApplied: number;
  changesBlocked: number;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  previewLimited: boolean;
  truncated: boolean;
}

export interface PatchSandboxSummary {
  totalFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  changesApplied: number;
  changesBlocked: number;
  warnings: number;
  blockers: number;
  displayLimited: boolean;
  noProjectFilesModified: true;
}

export interface PatchSandboxResult {
  status: PatchSandboxStatus;
  projectId: string;
  patchPreviewId: string;
  files: PatchSandboxFileResult[];
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  summary: PatchSandboxSummary;
}

export interface PatchSandboxContext {
  preview: GroundedPatchPreview;
  files: ProjectFile[];
  textPreviews: ProjectTextPreviewWithPath[];
}
