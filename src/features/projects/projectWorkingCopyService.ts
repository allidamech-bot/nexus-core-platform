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
  original_preview_text: string | null;
  working_copy_text: string;
  content_sha256: string;
  content_text: string;
  file_path: string;
  changed: boolean;
  warnings: Json;
  blockers: Json;
};

function asIssues(value: Json): PatchSandboxIssue[] {
  return Array.isArray(value) ? (value as unknown as PatchSandboxIssue[]) : [];
}

function toWorkingCopy(row: {
  id: string;
  project_id: string;
  request_id: string;
  snapshot_id: string;
  created_by: string;
  status: string;
  title: string | null;
  summary: string | null;
  metadata: Json;
  created_at: string;
}): ProjectWorkingCopy {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const meta = metadata as {
    patchPreviewId?: string | null;
    executedBy?: string | null;
    changedFilesCount?: number;
    warnings?: PatchSandboxIssue[];
    blockers?: PatchSandboxIssue[];
  };
  return {
    id: row.id,
    projectId: row.project_id,
    writebackRequestId: row.request_id,
    patchPreviewId: meta.patchPreviewId ?? "",
    patchSnapshotId: row.snapshot_id,
    createdBy: row.created_by,
    executedBy: meta.executedBy ?? row.created_by,
    status: row.status as ProjectWorkingCopyStatus,
    title: row.title,
    summary: row.summary,
    source: "approved_writeback_request",
    changedFilesCount: meta.changedFilesCount ?? 0,
    warnings: asIssues((meta.warnings ?? []) as unknown as Json),
    blockers: asIssues((meta.blockers ?? []) as unknown as Json),
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function toWorkingCopyFile(row: {
  id: string;
  working_copy_id: string;
  project_id: string;
  file_path: string;
  original_preview_text: string | null;
  working_copy_text: string | null;
  changed: boolean;
  warnings: Json;
  blockers: Json;
  created_at: string;
}): ProjectWorkingCopyFile {
  return {
    id: row.id,
    workingCopyId: row.working_copy_id,
    projectId: row.project_id,
    writebackRequestId: "",
    patchSnapshotId: "",
    filePath: row.file_path,
    contentSha256: null,
    contentText: row.working_copy_text ?? "",
    sizeBytes: new TextEncoder().encode(row.working_copy_text ?? "").length,
    changed: row.changed,
    previewLimited: true,
    truncated: false,
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
    error?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  if (!response.ok || !payload.workingCopy) {
    const detailText = [payload.details, payload.hint].filter(Boolean).join(" ");
    const error = new Error(
      payload.error || payload.message || detailText || "Working copy creation failed.",
    );
    Object.assign(error, {
      code: payload.code,
      details: payload.details,
      hint: payload.hint,
    });
    throw error;
  }
  return {
    workingCopy: payload.workingCopy,
    alreadyExists: Boolean(payload.alreadyExists),
  };
}

function filenameFromContentDisposition(header: string | null, fallback: string) {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
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
        patchPreviewId: input.request.patchPreviewId,
        executedBy: input.actorId,
        changedFilesCount: changedFiles.length,
        warnings: input.request.warnings,
        blockers: [],
      } as unknown as Json,
    },
    files: await Promise.all(
      changedFiles.map(async (file) => {
        const content = file.patchedPreviewText ?? "";
        return {
          project_id: input.request.projectId,
          file_path: file.filePath,
          original_preview_text: file.originalPreviewText,
          working_copy_text: content,
          content_sha256: file.patchedContentSha256 ?? (await hashPatchedText(content)),
          content_text: content,
          changed: file.changed,
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

export async function downloadWorkingCopyExport(workingCopyId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(
    `/api/projects/working-copy-export?workingCopyId=${encodeURIComponent(workingCopyId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "Working copy export failed.");
    throw new Error(message || "Working copy export failed.");
  }

  const blob = await response.blob();
  const filename = filenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    `nexus-core-working-copy-${workingCopyId.slice(0, 8)}.json`,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
    .eq("request_id", requestId)
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
