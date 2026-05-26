import { recordAuditEvent } from "@/features/governance/governanceService";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { PatchSandboxIssue } from "./patchApplySandbox";
import {
  hashPatchedText,
  type ProjectPatchSnapshot,
  type ProjectPatchSnapshotFile,
} from "./patchSnapshot";
import { getPatchSnapshot, getPatchSnapshotFiles } from "./projectPatchPreviewService";
import type { ProjectWritebackRequest } from "./projectWritebackRequestService";
import { getWritebackRequest } from "./projectWritebackRequestService";

export type ProjectWorkingCopyStatus = "created" | "failed" | "blocked";

export interface ProjectWorkingCopy {
  id: string;
  projectId: string;
  writebackRequestId: string;
  patchPreviewId: string;
  patchSnapshotId: string;
  createdBy: string;
  executedBy: string;
  status: ProjectWorkingCopyStatus;
  title: string | null;
  summary: string | null;
  source: "approved_writeback_request";
  changedFilesCount: number;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  metadata: Json;
  createdAt: string;
}

export interface ProjectWorkingCopyFile {
  id: string;
  workingCopyId: string;
  projectId: string;
  writebackRequestId: string;
  patchSnapshotId: string;
  filePath: string;
  contentSha256: string | null;
  contentText: string;
  sizeBytes: number;
  changed: boolean;
  previewLimited: boolean;
  truncated: boolean;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  createdAt: string;
}

export interface ExecuteWritebackResult {
  workingCopy: ProjectWorkingCopy;
  alreadyExists: boolean;
}

export interface WorkingCopySummary {
  requestId: string;
  projectId: string;
  patchPreviewId: string;
  patchSnapshotId: string;
  changedFilesCount: number;
  warningCount: number;
  blockerCount: number;
  createdFromApprovedRequest: true;
  originalProjectFilesModified: false;
  originalTextPreviewsModified: false;
  objectStorageModified: false;
  sourceZipOverwritten: false;
  codeExecuted: false;
  deploymentPerformed: false;
}

type WorkingCopyFileInsert = {
  project_id: string;
  writeback_request_id: string;
  patch_snapshot_id: string;
  file_path: string;
  content_sha256: string | null;
  content_text: string;
  size_bytes: number;
  changed: boolean;
  preview_limited: boolean;
  truncated: boolean;
  warnings: Json;
  blockers: Json;
};

function asIssues(value: Json): PatchSandboxIssue[] {
  return Array.isArray(value) ? (value as unknown as PatchSandboxIssue[]) : [];
}

function toWorkingCopy(row: {
  id: string;
  project_id: string;
  writeback_request_id: string;
  patch_preview_id: string;
  patch_snapshot_id: string;
  created_by: string;
  executed_by: string;
  status: string;
  title: string | null;
  summary: string | null;
  source: string;
  changed_files_count: number;
  warnings: Json;
  blockers: Json;
  metadata: Json;
  created_at: string;
}): ProjectWorkingCopy {
  return {
    id: row.id,
    projectId: row.project_id,
    writebackRequestId: row.writeback_request_id,
    patchPreviewId: row.patch_preview_id,
    patchSnapshotId: row.patch_snapshot_id,
    createdBy: row.created_by,
    executedBy: row.executed_by,
    status: row.status as ProjectWorkingCopyStatus,
    title: row.title,
    summary: row.summary,
    source: row.source as "approved_writeback_request",
    changedFilesCount: row.changed_files_count,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function toWorkingCopyFile(row: {
  id: string;
  working_copy_id: string;
  project_id: string;
  writeback_request_id: string;
  patch_snapshot_id: string;
  file_path: string;
  content_sha256: string | null;
  content_text: string;
  size_bytes: number;
  changed: boolean;
  preview_limited: boolean;
  truncated: boolean;
  warnings: Json;
  blockers: Json;
  created_at: string;
}): ProjectWorkingCopyFile {
  return {
    id: row.id,
    workingCopyId: row.working_copy_id,
    projectId: row.project_id,
    writebackRequestId: row.writeback_request_id,
    patchSnapshotId: row.patch_snapshot_id,
    filePath: row.file_path,
    contentSha256: row.content_sha256,
    contentText: row.content_text,
    sizeBytes: row.size_bytes,
    changed: row.changed,
    previewLimited: row.preview_limited,
    truncated: row.truncated,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    createdAt: row.created_at,
  };
}

async function requireCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Unauthorized");
  return data.user.id;
}

async function postExecuteWritebackRequest(requestId: string): Promise<ExecuteWritebackResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch("/api/projects/writeback-execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    workingCopy?: ProjectWorkingCopy;
    alreadyExists?: boolean;
    message?: string;
  };
  if (!response.ok || !payload.workingCopy) {
    throw new Error(payload.message || "Working copy creation failed.");
  }
  return {
    workingCopy: payload.workingCopy,
    alreadyExists: Boolean(payload.alreadyExists),
  };
}

export function summarizeWorkingCopy(input: {
  request: ProjectWritebackRequest;
  files: ProjectPatchSnapshotFile[];
}): WorkingCopySummary {
  const changedFiles = input.files.filter((file) => file.changed);
  return {
    requestId: input.request.id,
    projectId: input.request.projectId,
    patchPreviewId: input.request.patchPreviewId,
    patchSnapshotId: input.request.snapshotId,
    changedFilesCount: changedFiles.length,
    warningCount:
      input.request.warnings.length +
      changedFiles.reduce((count, file) => count + file.warnings.length, 0),
    blockerCount:
      input.request.blockers.length +
      changedFiles.reduce((count, file) => count + file.blockers.length, 0),
    createdFromApprovedRequest: true,
    originalProjectFilesModified: false,
    originalTextPreviewsModified: false,
    objectStorageModified: false,
    sourceZipOverwritten: false,
    codeExecuted: false,
    deploymentPerformed: false,
  };
}

export function validateRequestCanExecute(input: {
  request: ProjectWritebackRequest | null;
  snapshot: ProjectPatchSnapshot | null;
  files: ProjectPatchSnapshotFile[];
}): void {
  if (!input.request) throw new Error("Writeback request not found.");
  if (input.request.status !== "approved") {
    throw new Error("Request must be approved before execution.");
  }
  if (!input.snapshot) throw new Error("Patch snapshot not found.");
  if (input.snapshot.status !== "created") throw new Error("Execution blocked.");
  if (input.snapshot.blockers.length > 0 || input.request.blockers.length > 0) {
    throw new Error("Execution blocked.");
  }

  const changedFiles = input.files.filter((file) => file.changed);
  if (changedFiles.length < 1 || input.snapshot.changedFilesCount < 1) {
    throw new Error("Execution blocked.");
  }
  if (changedFiles.some((file) => file.blockers.length > 0)) {
    throw new Error("Execution blocked.");
  }
}

export async function buildWorkingCopyRows(input: {
  request: ProjectWritebackRequest;
  snapshot: ProjectPatchSnapshot;
  files: ProjectPatchSnapshotFile[];
  actorId: string;
}): Promise<{
  workingCopy: Omit<ProjectWorkingCopy, "id" | "createdAt">;
  files: WorkingCopyFileInsert[];
}> {
  validateRequestCanExecute({
    request: input.request,
    snapshot: input.snapshot,
    files: input.files,
  });
  const changedFiles = input.files.filter((file) => file.changed);
  const summary = summarizeWorkingCopy({ request: input.request, files: input.files });

  return {
    workingCopy: {
      projectId: input.request.projectId,
      writebackRequestId: input.request.id,
      patchPreviewId: input.request.patchPreviewId,
      patchSnapshotId: input.request.snapshotId,
      createdBy: input.request.requestedBy,
      executedBy: input.actorId,
      status: "created",
      title: input.request.title || "Versioned working copy",
      summary: `Versioned working copy with ${changedFiles.length} changed file(s).`,
      source: "approved_writeback_request",
      changedFilesCount: changedFiles.length,
      warnings: input.request.warnings,
      blockers: [],
      metadata: {
        phase: "91",
        ...summary,
      } as unknown as Json,
    },
    files: await Promise.all(
      changedFiles.map(async (file) => {
        const content = file.patchedPreviewText ?? "";
        return {
          project_id: input.request.projectId,
          writeback_request_id: input.request.id,
          patch_snapshot_id: input.request.snapshotId,
          file_path: file.filePath,
          content_sha256:
            file.patchedContentSha256 ?? (content ? await hashPatchedText(content) : null),
          content_text: content,
          size_bytes: new TextEncoder().encode(content).length,
          changed: file.changed,
          preview_limited: file.previewLimited,
          truncated: file.truncated,
          warnings: file.warnings as unknown as Json,
          blockers: file.blockers as unknown as Json,
        };
      }),
    ),
  };
}

export async function executeApprovedWritebackRequest(
  requestId: string,
): Promise<ExecuteWritebackResult> {
  await requireCurrentUserId();
  return postExecuteWritebackRequest(requestId);
}

export async function getWorkingCopies(projectId: string): Promise<ProjectWorkingCopy[]> {
  const { data, error } = await supabase
    .from("project_working_copies")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map(toWorkingCopy);
}

export async function getWorkingCopy(workingCopyId: string): Promise<ProjectWorkingCopy | null> {
  const { data, error } = await supabase
    .from("project_working_copies")
    .select("*")
    .eq("id", workingCopyId)
    .maybeSingle();
  if (error) throw error;
  return data ? toWorkingCopy(data) : null;
}

export async function getLatestWorkingCopyForRequest(
  requestId: string,
): Promise<ProjectWorkingCopy | null> {
  const { data, error } = await supabase
    .from("project_working_copies")
    .select("*")
    .eq("writeback_request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toWorkingCopy(data) : null;
}

export async function getWorkingCopyFiles(
  workingCopyId: string,
): Promise<ProjectWorkingCopyFile[]> {
  const { data, error } = await supabase
    .from("project_working_copy_files")
    .select("*")
    .eq("working_copy_id", workingCopyId)
    .order("file_path", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(toWorkingCopyFile);
}

export async function auditWorkingCopyExecution(input: {
  actorId: string;
  workingCopy: ProjectWorkingCopy;
  alreadyExists: boolean;
}) {
  try {
    await recordAuditEvent({
      userId: input.workingCopy.createdBy,
      actorUserId: input.actorId,
      projectId: input.workingCopy.projectId,
      eventType: input.alreadyExists
        ? "writeback_working_copy_already_exists"
        : "writeback_working_copy_created",
      severity: "info",
      payload: {
        working_copy_id: input.workingCopy.id,
        request_id: input.workingCopy.writebackRequestId,
        snapshot_id: input.workingCopy.patchSnapshotId,
        patch_preview_id: input.workingCopy.patchPreviewId,
        changed_files_count: input.workingCopy.changedFilesCount,
        source_zip_overwritten: false,
        object_storage_modified: false,
        original_project_files_modified: false,
        original_text_previews_modified: false,
        deployment_performed: false,
      },
    });
  } catch (error) {
    console.warn("[writeback-working-copy] audit write failed", error);
  }
}

export async function loadExecutionInputs(requestId: string) {
  const request = await getWritebackRequest(requestId);
  if (!request) return { request: null, snapshot: null, files: [] };
  const [snapshot, files] = await Promise.all([
    getPatchSnapshot(request.snapshotId),
    getPatchSnapshotFiles(request.snapshotId),
  ]);
  return { request, snapshot, files };
}
