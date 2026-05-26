import { recordAuditEvent } from "@/features/governance/governanceService";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { PatchSandboxIssue } from "./patchApplySandbox";
import type { ProjectPatchSnapshot, ProjectPatchSnapshotFile } from "./patchSnapshot";
import {
  getPatchSnapshot,
  getPatchSnapshotFiles,
  validatePatchSnapshotAccess,
} from "./projectPatchPreviewService";
import {
  buildWritebackRequestRiskSummary,
  type WritebackRiskLevel,
  type WritebackRiskSummary,
} from "./writebackRisk";

export type WritebackRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "blocked";

export interface ProjectWritebackRequest {
  id: string;
  projectId: string;
  patchPreviewId: string;
  snapshotId: string;
  requestedBy: string;
  reviewerId: string | null;
  status: WritebackRequestStatus;
  title: string | null;
  requesterNote: string | null;
  reviewerNote: string | null;
  riskLevel: WritebackRiskLevel;
  changedFilesCount: number;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  snapshotSummary: Json;
  metadata: Json;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface CreateWritebackRequestResult {
  request: ProjectWritebackRequest;
  alreadyExists: boolean;
}

export interface CreateWritebackRequestInput {
  snapshotId: string;
  requesterNote?: string;
}

function asIssues(value: Json): PatchSandboxIssue[] {
  return Array.isArray(value) ? (value as unknown as PatchSandboxIssue[]) : [];
}

function toWritebackRequest(row: {
  id: string;
  project_id: string;
  patch_preview_id: string;
  snapshot_id: string;
  requested_by: string;
  reviewer_id: string | null;
  status: string;
  title: string | null;
  requester_note: string | null;
  reviewer_note: string | null;
  risk_level: string;
  changed_files_count: number;
  warnings: Json;
  blockers: Json;
  snapshot_summary: Json;
  metadata: Json;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}): ProjectWritebackRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    patchPreviewId: row.patch_preview_id,
    snapshotId: row.snapshot_id,
    requestedBy: row.requested_by,
    reviewerId: row.reviewer_id,
    status: row.status as WritebackRequestStatus,
    title: row.title,
    requesterNote: row.requester_note,
    reviewerNote: row.reviewer_note,
    riskLevel: row.risk_level as WritebackRiskLevel,
    changedFilesCount: row.changed_files_count,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    snapshotSummary: row.snapshot_summary,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

async function requireCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Unauthorized");
  return data.user.id;
}

function snapshotSummary(snapshot: ProjectPatchSnapshot, risk: WritebackRiskSummary): Json {
  return {
    snapshot_id: snapshot.id,
    patch_preview_id: snapshot.patchPreviewId,
    verification_status: snapshot.verificationStatus,
    changed_files_count: risk.changedFilesCount,
    warnings_count: risk.warnings.length,
    blockers_count: risk.blockers.length,
    derived_snapshot_only: true,
    original_project_files_modified: false,
    source_writeback: false,
  } as unknown as Json;
}

async function auditWritebackRequest(input: {
  userId: string;
  projectId: string;
  eventType: string;
  request?: ProjectWritebackRequest;
  snapshotId?: string;
  patchPreviewId?: string;
  riskLevel?: WritebackRiskLevel;
  changedFilesCount?: number;
  warningCount?: number;
  blockerCount?: number;
}) {
  try {
    await recordAuditEvent({
      userId: input.userId,
      actorUserId: input.userId,
      projectId: input.projectId,
      eventType: input.eventType,
      severity: input.riskLevel === "blocked" ? "warning" : "info",
      payload: {
        request_id: input.request?.id ?? null,
        snapshot_id: input.request?.snapshotId ?? input.snapshotId ?? null,
        patch_preview_id: input.request?.patchPreviewId ?? input.patchPreviewId ?? null,
        status: input.request?.status ?? null,
        changed_files_count: input.request?.changedFilesCount ?? input.changedFilesCount ?? 0,
        risk_level: input.request?.riskLevel ?? input.riskLevel ?? "medium",
        warning_count: input.request?.warnings.length ?? input.warningCount ?? 0,
        blocker_count: input.request?.blockers.length ?? input.blockerCount ?? 0,
        source_writeback_performed: false,
      },
    });
  } catch (error) {
    console.warn("[writeback-request] audit write failed", error);
  }
}

export async function validateWritebackRequestAccess(projectId: string): Promise<void> {
  await validatePatchSnapshotAccess(projectId);
}

export { buildWritebackRequestRiskSummary };

export async function getWritebackRequests(projectId: string): Promise<ProjectWritebackRequest[]> {
  await validateWritebackRequestAccess(projectId);
  const { data, error } = await supabase
    .from("project_writeback_requests")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []).map(toWritebackRequest);
}

export async function getWritebackRequest(
  requestId: string,
): Promise<ProjectWritebackRequest | null> {
  const { data, error } = await supabase
    .from("project_writeback_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  return data ? toWritebackRequest(data) : null;
}

export async function getLatestWritebackRequestForSnapshot(
  snapshotId: string,
): Promise<ProjectWritebackRequest | null> {
  const { data, error } = await supabase
    .from("project_writeback_requests")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .in("status", ["draft", "submitted", "approved", "blocked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toWritebackRequest(data) : null;
}

function validateRequestCanBeCreated(input: {
  snapshot: ProjectPatchSnapshot;
  files: ProjectPatchSnapshotFile[];
  risk: WritebackRiskSummary;
}) {
  if (input.snapshot.status !== "created") {
    throw new Error("Writeback request blocked.");
  }
  if (input.snapshot.blockers.length > 0 || input.risk.blockers.length > 0) {
    throw new Error("Writeback request blocked.");
  }
  if (input.risk.changedFilesCount < 1 || !input.files.some((file) => file.changed)) {
    throw new Error("Snapshot has no changed files.");
  }
}

export async function createWritebackRequestFromSnapshot(
  input: CreateWritebackRequestInput,
): Promise<CreateWritebackRequestResult> {
  const userId = await requireCurrentUserId();
  const snapshot = await getPatchSnapshot(input.snapshotId);
  if (!snapshot) throw new Error("Snapshot not found.");
  await validateWritebackRequestAccess(snapshot.projectId);

  const existing = await getLatestWritebackRequestForSnapshot(snapshot.id);
  if (existing && ["draft", "submitted", "approved", "blocked"].includes(existing.status)) {
    return { request: existing, alreadyExists: true };
  }

  const files = await getPatchSnapshotFiles(snapshot.id);
  const risk = buildWritebackRequestRiskSummary({ snapshot, files });
  validateRequestCanBeCreated({ snapshot, files, risk });

  const { data, error } = await supabase
    .from("project_writeback_requests")
    .insert({
      project_id: snapshot.projectId,
      patch_preview_id: snapshot.patchPreviewId,
      snapshot_id: snapshot.id,
      requested_by: userId,
      status: "draft",
      title: snapshot.title || "Source writeback review",
      requester_note: input.requesterNote?.trim() || null,
      risk_level: risk.riskLevel,
      changed_files_count: risk.changedFilesCount,
      warnings: risk.warnings as unknown as Json,
      blockers: risk.blockers as unknown as Json,
      snapshot_summary: snapshotSummary(snapshot, risk),
      metadata: {
        phase: "89",
        governance_request_only: true,
        source_writeback_performed: false,
        original_project_files_modified: false,
        original_text_previews_modified: false,
      } as unknown as Json,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await getLatestWritebackRequestForSnapshot(snapshot.id);
      if (duplicate) return { request: duplicate, alreadyExists: true };
    }
    throw error;
  }

  const request = toWritebackRequest(data);
  await auditWritebackRequest({
    userId,
    projectId: request.projectId,
    eventType: "writeback_request_created",
    request,
  });
  return { request, alreadyExists: false };
}

export async function submitWritebackRequest(requestId: string): Promise<ProjectWritebackRequest> {
  const userId = await requireCurrentUserId();
  const current = await getWritebackRequest(requestId);
  if (!current) throw new Error("Writeback request not found.");
  await validateWritebackRequestAccess(current.projectId);
  if (current.status !== "draft") throw new Error("Only draft requests can be submitted.");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("project_writeback_requests")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", requestId)
    .eq("status", "draft")
    .select()
    .single();

  if (error) throw error;
  const request = toWritebackRequest(data);
  await auditWritebackRequest({
    userId,
    projectId: request.projectId,
    eventType: "writeback_request_submitted",
    request,
  });
  return request;
}

export async function cancelWritebackRequest(requestId: string): Promise<ProjectWritebackRequest> {
  const userId = await requireCurrentUserId();
  const current = await getWritebackRequest(requestId);
  if (!current) throw new Error("Writeback request not found.");
  await validateWritebackRequestAccess(current.projectId);
  if (!["draft", "submitted"].includes(current.status)) {
    throw new Error("Only draft or submitted requests can be cancelled.");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("project_writeback_requests")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", requestId)
    .in("status", ["draft", "submitted"])
    .select()
    .single();

  if (error) throw error;
  const request = toWritebackRequest(data);
  await auditWritebackRequest({
    userId,
    projectId: request.projectId,
    eventType: "writeback_request_cancelled",
    request,
  });
  return request;
}
