import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  buildPatchPreviewForTextReplacement,
  PatchPreviewValidationError,
  validatePatchPreviewTarget,
} from "./patchDiff";
import { isSensitivePreviewPath } from "./projectFileTree";

import type { PatchSandboxResult } from "./patchSandboxTypes";
import {
  createPatchSnapshotFromSandbox,
  type ProjectPatchSnapshot,
  type ProjectPatchSnapshotFile,
} from "./patchSnapshot";
import type {
  GroundedPatchChange,
  GroundedPatchFile,
  GroundedPatchPreview,
  GroundedPatchPreviewStatus,
  PatchPreviewWarning,
} from "./patchPreviewTypes";
import type { ProjectFile, ProjectTextPreviewWithPath } from "./types";

export interface CreateManualPatchPreviewInput {
  projectId: string;
  userId: string;
  fileId: string;
  title?: string;
  summary?: string;
  oldText: string;
  newText: string;
}

export interface CreateAiPatchPreviewInput {
  projectId: string;
  fileIds: string[];
  title?: string;
  instruction: string;
}

export interface AiPatchPreviewReadiness {
  configured: boolean;
  provider: "lovable";
  model: string;
  status: "ready" | "blocked";
  code: "BLOCKED_AI_PROVIDER_REQUIRED" | null;
  message: string;
  requiredEnv: string[];
}

export interface CreatePatchSnapshotResult {
  snapshot: ProjectPatchSnapshot;
  files: ProjectPatchSnapshotFile[];
  alreadyExists: boolean;
}

function asWarnings(value: Json): PatchPreviewWarning[] {
  return Array.isArray(value) ? (value as unknown as PatchPreviewWarning[]) : [];
}

function asGroundedFiles(value: Json): GroundedPatchFile[] {
  return Array.isArray(value) ? (value as unknown as GroundedPatchFile[]) : [];
}

function asChanges(value: Json): GroundedPatchChange[] {
  return Array.isArray(value) ? (value as unknown as GroundedPatchChange[]) : [];
}

function asSandboxIssues(value: Json) {
  return Array.isArray(value)
    ? (value as unknown as ProjectPatchSnapshot["warnings"])
    : ([] as ProjectPatchSnapshot["warnings"]);
}

function toPatchPreview(row: {
  id: string;
  project_id: string;
  title: string | null;
  status: string;
  summary: string | null;
  grounded_files: Json;
  diff: Json;
  warnings: Json;
  created_at: string;
  updated_at: string;
}): GroundedPatchPreview {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status as GroundedPatchPreviewStatus,
    summary: row.summary,
    groundedFiles: asGroundedFiles(row.grounded_files),
    changes: asChanges(row.diff),
    warnings: asWarnings(row.warnings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPatchSnapshot(row: {
  id: string;
  project_id: string;
  patch_preview_id: string;
  created_by: string;
  status: string;
  title: string | null;
  summary: string | null;
  source: string;
  verification_status: string;
  changed_files_count: number;
  warnings: Json;
  blockers: Json;
  metadata: Json;
  created_at: string;
}): ProjectPatchSnapshot {
  return {
    id: row.id,
    projectId: row.project_id,
    patchPreviewId: row.patch_preview_id,
    createdBy: row.created_by,
    status: row.status as ProjectPatchSnapshot["status"],
    title: row.title,
    summary: row.summary,
    source: "patch_preview_sandbox",
    verificationStatus: row.verification_status as ProjectPatchSnapshot["verificationStatus"],
    changedFilesCount: row.changed_files_count,
    warnings: asSandboxIssues(row.warnings),
    blockers: asSandboxIssues(row.blockers),
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function toPatchSnapshotFile(row: {
  id: string;
  snapshot_id: string;
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
  created_at: string;
}): ProjectPatchSnapshotFile {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    projectId: row.project_id,
    patchPreviewId: row.patch_preview_id,
    filePath: row.file_path,
    originalContentSha256: row.original_content_sha256,
    patchedContentSha256: row.patched_content_sha256,
    originalPreviewText: row.original_preview_text,
    patchedPreviewText: row.patched_preview_text,
    changed: row.changed,
    previewLimited: row.preview_limited,
    truncated: row.truncated,
    warnings: asSandboxIssues(row.warnings),
    blockers: asSandboxIssues(row.blockers),
    createdAt: row.created_at,
  };
}

function safeFailureMessage(error: unknown) {
  if (error instanceof PatchPreviewValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Patch preview failed.";
}

export async function validatePatchPreviewAccess(projectId: string): Promise<void> {
  const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).single();

  if (error) throw error;
  if (!data) throw new Error("Project not found.");
}

export async function validatePatchPreviewSandboxAccess(projectId: string): Promise<void> {
  await validatePatchPreviewAccess(projectId);
}

export async function validatePatchSnapshotAccess(projectId: string): Promise<void> {
  await validatePatchPreviewAccess(projectId);
}

export async function getPatchPreviews(projectId: string): Promise<GroundedPatchPreview[]> {
  const { data, error } = await supabase
    .from("project_patch_previews")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data ?? []).map(toPatchPreview);
}

export async function getPatchPreview(previewId: string): Promise<GroundedPatchPreview | null> {
  const { data, error } = await supabase
    .from("project_patch_previews")
    .select("*")
    .eq("id", previewId)
    .maybeSingle();

  if (error) throw error;
  return data ? toPatchPreview(data) : null;
}

export async function getPatchPreviewForSandbox(
  previewId: string,
): Promise<GroundedPatchPreview | null> {
  return getPatchPreview(previewId);
}

export async function getPatchPreviewCurrentContext(
  projectId: string,
  groundedFiles: GroundedPatchFile[],
): Promise<{ files: ProjectFile[]; textPreviews: ProjectTextPreviewWithPath[] }> {
  const groundedFileIds = Array.from(
    new Set(groundedFiles.map((file) => file.fileId).filter(Boolean)),
  );
  const groundedPaths = Array.from(new Set(groundedFiles.map((file) => file.path).filter(Boolean)));

  if (groundedFileIds.length === 0 && groundedPaths.length === 0) {
    return { files: [], textPreviews: [] };
  }

  let fileQuery = supabase.from("project_files").select("*").eq("project_id", projectId);
  if (groundedFileIds.length > 0) {
    fileQuery = fileQuery.in("id", groundedFileIds);
  } else {
    fileQuery = fileQuery.in("path", groundedPaths);
  }

  const { data: files, error: fileError } = await fileQuery.limit(100);
  if (fileError) throw fileError;
  const fileRows = (files ?? []) as ProjectFile[];
  if (fileRows.length === 0) return { files: [], textPreviews: [] };

  const fileIds = fileRows.map((file) => file.id);
  const { data: previews, error: previewError } = await supabase
    .from("project_text_previews")
    .select("*")
    .eq("project_id", projectId)
    .in("file_id", fileIds)
    .limit(100);

  if (previewError) throw previewError;
  const pathsByFileId = new Map(fileRows.map((file) => [file.id, file.path]));
  const textPreviews = ((previews ?? []) as ProjectTextPreviewWithPath[]).map((preview) => ({
    ...preview,
    path: pathsByFileId.get(preview.file_id) ?? "unknown",
  }));

  return { files: fileRows, textPreviews };
}

export async function runPatchPreviewSandbox(
  previewId: string,
): Promise<{ jobId: string; status: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;

  const res = await fetch("/api/projects/sandbox-verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ previewId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sandbox verification failed: ${res.status} ${text}`);
  }

  return await res.json();
}

async function requireCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Unauthorized");
  return data.user.id;
}

export async function getPatchSnapshots(projectId: string): Promise<ProjectPatchSnapshot[]> {
  await validatePatchSnapshotAccess(projectId);
  const { data, error } = await supabase
    .from("project_patch_snapshots")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []).map(toPatchSnapshot);
}

export async function getPatchSnapshot(snapshotId: string): Promise<ProjectPatchSnapshot | null> {
  const { data, error } = await supabase
    .from("project_patch_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) throw error;
  return data ? toPatchSnapshot(data) : null;
}

export async function getPatchSnapshotFiles(
  snapshotId: string,
): Promise<ProjectPatchSnapshotFile[]> {
  const { data, error } = await supabase
    .from("project_patch_snapshot_files")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("file_path", { ascending: true })
    .limit(100);

  if (error) throw error;
  return (data ?? []).map(toPatchSnapshotFile);
}

export async function getLatestPatchSnapshotForPreview(
  previewId: string,
): Promise<ProjectPatchSnapshot | null> {
  const { data, error } = await supabase
    .from("project_patch_snapshots")
    .select("*")
    .eq("patch_preview_id", previewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toPatchSnapshot(data) : null;
}

export async function createPatchSnapshot(input: {
  previewId: string;
  sandboxResult: PatchSandboxResult;
}): Promise<CreatePatchSnapshotResult> {
  const userId = await requireCurrentUserId();
  const preview = await getPatchPreviewForSandbox(input.previewId);
  if (!preview) throw new Error("Patch preview not found.");
  await validatePatchSnapshotAccess(preview.projectId);

  const existing = await getLatestPatchSnapshotForPreview(input.previewId);
  if (existing) {
    const files = await getPatchSnapshotFiles(existing.id);
    return { snapshot: existing, files, alreadyExists: true };
  }

  const built = await createPatchSnapshotFromSandbox({
    preview,
    sandbox: input.sandboxResult,
    userId,
  });

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("project_patch_snapshots")
    .insert(built.snapshot)
    .select()
    .single();

  if (snapshotError) {
    if (snapshotError.code === "23505") {
      const duplicate = await getLatestPatchSnapshotForPreview(input.previewId);
      if (duplicate) {
        const files = await getPatchSnapshotFiles(duplicate.id);
        return { snapshot: duplicate, files, alreadyExists: true };
      }
    }
    throw snapshotError;
  }

  const snapshot = toPatchSnapshot(snapshotRow);
  const fileRows = built.files.map((file) => ({ ...file, snapshot_id: snapshot.id }));
  const { data: createdFiles, error: filesError } = await supabase
    .from("project_patch_snapshot_files")
    .insert(fileRows)
    .select();

  if (filesError) throw filesError;
  return {
    snapshot,
    files: (createdFiles ?? []).map(toPatchSnapshotFile),
    alreadyExists: false,
  };
}

function filenameFromContentDisposition(header: string | null, fallback: string) {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

export async function downloadPatchSnapshotExport(snapshotId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(
    `/api/projects/snapshot-export?snapshotId=${encodeURIComponent(snapshotId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "Export failed.");
    throw new Error(message || "Export failed.");
  }

  const blob = await response.blob();
  const filename = filenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    `nexus-core-snapshot-${snapshotId.slice(0, 8)}.json`,
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

export async function getPreviewablePatchTargets(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_text", true)
    .eq("is_previewable", true)
    .eq("skipped", false)
    .order("path", { ascending: true })
    .limit(100);

  if (error) throw error;
  return ((data ?? []) as ProjectFile[]).filter((file) => !isSensitivePreviewPath(file.path));
}

async function getTargetPreview(projectId: string, fileId: string) {
  const { data: file, error: fileError } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", fileId)
    .single();

  if (fileError) throw fileError;

  const { data: preview, error: previewError } = await supabase
    .from("project_text_previews")
    .select("*")
    .eq("project_id", projectId)
    .eq("file_id", fileId)
    .single();

  if (previewError) throw previewError;
  const filePath = file.path ?? "unknown";
  return {
    file: file as ProjectFile,
    preview: { ...(preview as ProjectTextPreviewWithPath), path: filePath },
  };
}

async function latestIngestionJobId(projectId: string) {
  const { data, error } = await supabase
    .from("project_ingestion_jobs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function createRejectedPatchPreview(input: CreateManualPatchPreviewInput, error: unknown) {
  const message = safeFailureMessage(error);
  const warning: PatchPreviewWarning = {
    code: error instanceof PatchPreviewValidationError ? error.code : "patch_preview_failed",
    message,
  };
  const { data, error: insertError } = await supabase
    .from("project_patch_previews")
    .insert({
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title?.trim() || "Grounded patch preview",
      status: "rejected",
      source: "manual_foundation",
      summary: message,
      grounded_files: [],
      diff: [],
      warnings: [warning] as unknown as Json,
      metadata: { phase: "84", applied: false },
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return toPatchPreview(data);
}

export async function createManualPatchPreview(
  input: CreateManualPatchPreviewInput,
): Promise<GroundedPatchPreview> {
  await validatePatchPreviewAccess(input.projectId);

  try {
    const [{ file, preview }, jobId] = await Promise.all([
      getTargetPreview(input.projectId, input.fileId),
      latestIngestionJobId(input.projectId),
    ]);
    const validation = validatePatchPreviewTarget(file, preview);
    if (!validation.allowed) {
      throw new PatchPreviewValidationError(
        "This file cannot be patched.",
        validation.reason ?? "invalid_target",
      );
    }

    const built = buildPatchPreviewForTextReplacement({
      file,
      preview,
      oldText: input.oldText,
      newText: input.newText,
    });

    const { data, error } = await supabase
      .from("project_patch_previews")
      .insert({
        project_id: input.projectId,
        ingestion_job_id: jobId,
        created_by: input.userId,
        title: input.title?.trim() || "Grounded patch preview",
        status: "ready",
        source: "manual_foundation",
        summary: input.summary?.trim() || "Read-only grounded patch preview.",
        grounded_files: [built.groundedFile] as unknown as Json,
        diff: [built.change] as unknown as Json,
        warnings: built.warnings as unknown as Json,
        metadata: {
          phase: "84",
          applied: false,
          preview_limited: true,
          operation: "text_replacement",
        },
      })
      .select()
      .single();

    if (error) throw error;
    return toPatchPreview(data);
  } catch (error) {
    return createRejectedPatchPreview(input, error);
  }
}

export async function createAiPatchPreview(
  input: CreateAiPatchPreviewInput,
): Promise<GroundedPatchPreview> {
  await validatePatchPreviewAccess(input.projectId);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch("/api/projects/ai-patch-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      projectId: input.projectId,
      fileIds: input.fileIds,
      title: input.title,
      instruction: input.instruction,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    previewId?: string;
    message?: string;
    warnings?: PatchPreviewWarning[];
  };
  if (!response.ok && !payload.previewId) {
    throw new Error(
      payload.message || payload.warnings?.[0]?.message || "AI patch preview failed.",
    );
  }
  if (!payload.previewId) {
    throw new Error("AI patch preview did not return a preview record.");
  }

  const preview = await getPatchPreview(payload.previewId);
  if (!preview) throw new Error("AI patch preview could not be loaded.");
  return preview;
}

export async function getAiPatchPreviewReadiness(): Promise<AiPatchPreviewReadiness> {
  const response = await fetch("/api/projects/ai-provider-readiness");
  const payload = (await response.json().catch(() => ({}))) as Partial<AiPatchPreviewReadiness>;

  if (!response.ok) {
    throw new Error(payload.message || "AI provider readiness could not be checked.");
  }

  return {
    configured: Boolean(payload.configured),
    provider: "lovable",
    model: payload.model || "google/gemini-3-flash-preview",
    status: payload.configured ? "ready" : "blocked",
    code: payload.configured ? null : "BLOCKED_AI_PROVIDER_REQUIRED",
    message:
      payload.message ||
      (payload.configured
        ? "AI provider is configured for governed patch preview generation."
        : "AI provider configuration is required before AI patch preview can run."),
    requiredEnv: Array.isArray(payload.requiredEnv) ? payload.requiredEnv : ["LOVABLE_API_KEY"],
  };
}
