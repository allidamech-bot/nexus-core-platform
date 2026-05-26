import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  buildPatchPreviewForTextReplacement,
  PatchPreviewValidationError,
  validatePatchPreviewTarget,
} from "./patchDiff";
import { isSensitivePreviewPath } from "./projectFileTree";
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

function asWarnings(value: Json): PatchPreviewWarning[] {
  return Array.isArray(value) ? (value as unknown as PatchPreviewWarning[]) : [];
}

function asGroundedFiles(value: Json): GroundedPatchFile[] {
  return Array.isArray(value) ? (value as unknown as GroundedPatchFile[]) : [];
}

function asChanges(value: Json): GroundedPatchChange[] {
  return Array.isArray(value) ? (value as unknown as GroundedPatchChange[]) : [];
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
