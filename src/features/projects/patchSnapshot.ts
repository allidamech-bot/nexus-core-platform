import type { Json } from "@/integrations/supabase/types";
import type {
  PatchSandboxFileResult,
  PatchSandboxIssue,
  PatchSandboxResult,
} from "./patchApplySandbox";
import type { GroundedPatchPreview } from "./types";

const SNAPSHOT_TEXT_LIMIT = 12_000;

export type PatchSnapshotStatus = "created" | "blocked" | "failed";
export type PatchSnapshotVerificationStatus = "verified" | "partial";

export interface ProjectPatchSnapshot {
  id: string;
  projectId: string;
  patchPreviewId: string;
  createdBy: string;
  status: PatchSnapshotStatus;
  title: string | null;
  summary: string | null;
  source: "patch_preview_sandbox";
  verificationStatus: PatchSnapshotVerificationStatus;
  changedFilesCount: number;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  metadata: Json;
  createdAt: string;
}

export interface ProjectPatchSnapshotFile {
  id: string;
  snapshotId: string;
  projectId: string;
  patchPreviewId: string;
  filePath: string;
  originalContentSha256: string | null;
  patchedContentSha256: string | null;
  originalPreviewText: string | null;
  patchedPreviewText: string | null;
  changed: boolean;
  previewLimited: boolean;
  truncated: boolean;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  createdAt: string;
}

export interface PatchSnapshotInsertInput {
  project_id: string;
  patch_preview_id: string;
  created_by: string;
  status: PatchSnapshotStatus;
  title: string | null;
  summary: string;
  source: "patch_preview_sandbox";
  verification_status: PatchSnapshotVerificationStatus;
  changed_files_count: number;
  warnings: Json;
  blockers: Json;
  metadata: Json;
}

export interface PatchSnapshotFileInsertInput {
  project_id: string;
  patch_preview_id: string;
  file_path: string;
  original_content_sha256: string | null;
  patched_content_sha256: string | null;
  original_preview_text: string | null;
  patched_preview_text: string | null;
  changed: boolean;
  preview_limited: boolean;
  truncated: boolean;
  warnings: Json;
  blockers: Json;
}

export interface BuiltPatchSnapshotInput {
  snapshot: PatchSnapshotInsertInput;
  files: PatchSnapshotFileInsertInput[];
}

export function truncateSnapshotText(text: string | null | undefined, limit = SNAPSHOT_TEXT_LIMIT) {
  const value = text ?? "";
  if (value.length <= limit) return { text: value, truncated: false };
  return {
    text: `${value.slice(0, limit)}\n... snapshot preview truncated for safety ...`,
    truncated: true,
  };
}

export async function hashPatchedText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function validateSnapshotCanBeCreated(result: PatchSandboxResult): void {
  if (result.status === "blocked" || result.status === "failed" || result.blockers.length > 0) {
    throw new Error("Cannot create snapshot from blocked sandbox.");
  }
  if (result.status !== "verified" && result.status !== "partial") {
    throw new Error("Cannot create snapshot from blocked sandbox.");
  }
}

export function summarizePatchSnapshot(input: {
  preview: GroundedPatchPreview;
  sandbox: PatchSandboxResult;
}) {
  return (
    input.preview.summary ||
    `Derived patch snapshot with ${input.sandbox.summary.changedFiles} changed file(s).`
  );
}

async function buildSnapshotFileRow(file: PatchSandboxFileResult) {
  const originalText = truncateSnapshotText(file.oldPreviewText);
  const patchedText = truncateSnapshotText(file.sandboxPatchedText);
  return {
    project_id: "",
    patch_preview_id: "",
    file_path: file.filePath,
    original_content_sha256: file.contentSha256,
    patched_content_sha256: file.changed ? await hashPatchedText(file.sandboxPatchedText) : null,
    original_preview_text: originalText.text,
    patched_preview_text: patchedText.text,
    changed: file.changed,
    preview_limited: true,
    truncated: file.truncated || originalText.truncated || patchedText.truncated,
    warnings: file.warnings as unknown as Json,
    blockers: file.blockers as unknown as Json,
  };
}

export async function buildSnapshotFileRows(input: {
  projectId: string;
  patchPreviewId: string;
  sandbox: PatchSandboxResult;
}): Promise<PatchSnapshotFileInsertInput[]> {
  const rows = await Promise.all(input.sandbox.files.map((file) => buildSnapshotFileRow(file)));
  return rows.map((row) => ({
    ...row,
    project_id: input.projectId,
    patch_preview_id: input.patchPreviewId,
  }));
}

export async function buildPatchSnapshotInput(input: {
  preview: GroundedPatchPreview;
  sandbox: PatchSandboxResult;
  userId: string;
}): Promise<BuiltPatchSnapshotInput> {
  validateSnapshotCanBeCreated(input.sandbox);
  const files = await buildSnapshotFileRows({
    projectId: input.preview.projectId,
    patchPreviewId: input.preview.id,
    sandbox: input.sandbox,
  });

  return {
    snapshot: {
      project_id: input.preview.projectId,
      patch_preview_id: input.preview.id,
      created_by: input.userId,
      status: "created",
      title: input.preview.title || "Versioned patch snapshot",
      summary: summarizePatchSnapshot({ preview: input.preview, sandbox: input.sandbox }),
      source: "patch_preview_sandbox",
      verification_status: input.sandbox.status as PatchSnapshotVerificationStatus,
      changed_files_count: input.sandbox.summary.changedFiles,
      warnings: input.sandbox.warnings as unknown as Json,
      blockers: input.sandbox.blockers as unknown as Json,
      metadata: {
        phase: "87",
        derived_snapshot_only: true,
        original_project_files_modified: false,
        original_text_previews_modified: false,
        source_writeback: false,
        sandbox_summary: input.sandbox.summary,
      } as unknown as Json,
    },
    files,
  };
}

export async function createPatchSnapshotFromSandbox(input: {
  preview: GroundedPatchPreview;
  sandbox: PatchSandboxResult;
  userId: string;
}): Promise<BuiltPatchSnapshotInput> {
  return buildPatchSnapshotInput(input);
}
