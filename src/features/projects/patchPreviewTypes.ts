export type GroundedPatchPreviewStatus = "draft" | "ready" | "rejected" | "failed";
export type GroundedPatchChangeType = "modify" | "create" | "delete" | "rename";

export interface PatchPreviewWarning {
  code: string;
  message: string;
  filePath?: string;
}

export interface GroundedPatchFile {
  fileId: string;
  path: string;
  contentSha256: string | null;
  isPreviewable: boolean;
  sourcePreviewAvailable: boolean;
  reason?: string;
}

export interface GroundedPatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface GroundedPatchChange {
  filePath: string;
  changeType: GroundedPatchChangeType;
  oldText: string;
  newText: string;
  unifiedDiff: string;
  hunks: GroundedPatchHunk[];
  warnings: PatchPreviewWarning[];
}

export interface GroundedPatchPreview {
  id: string;
  projectId: string;
  title: string | null;
  status: GroundedPatchPreviewStatus;
  summary: string | null;
  groundedFiles: GroundedPatchFile[];
  changes: GroundedPatchChange[];
  warnings: PatchPreviewWarning[];
  createdAt: string;
  updatedAt: string;
}
