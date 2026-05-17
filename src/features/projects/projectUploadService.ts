import { supabase } from "@/integrations/supabase/client";
import {
  DANGEROUS_FILENAME_TOKENS,
  PROJECT_UPLOAD_BUCKET,
  PROJECT_UPLOAD_MAX_BYTES,
  PROJECT_UPLOAD_MAX_MB,
  ZIP_EXTENSION,
} from "./constants";
import {
  createIngestionJob,
  createProject,
  createProjectFile,
  logProjectSecurityEvent,
  updateIngestionJob,
  updateProjectStatus,
} from "./projectService";
import type { Project, ProjectIngestionJob } from "./types";
import {
  checkQuota,
  recordAuditEvent,
  recordUsageEvent,
} from "@/features/governance/governanceService";

export interface UploadProjectInput {
  userId: string;
  file: File;
  projectName?: string;
  description?: string;
}

export interface UploadProjectResult {
  project: Project;
  job: ProjectIngestionJob;
  storagePath: string | null;
  storageAvailable: boolean;
}

export function validateProjectZip(file: File): string | null {
  const normalizedName = file.name.trim().toLowerCase();

  if (!normalizedName.endsWith(ZIP_EXTENSION)) {
    return "Only .zip archives are supported in this ingestion phase.";
  }

  if (file.size <= 0) {
    return "The selected archive is empty.";
  }

  if (file.size > PROJECT_UPLOAD_MAX_BYTES) {
    return `The selected archive is larger than ${PROJECT_UPLOAD_MAX_MB}MB.`;
  }

  if (normalizedName.includes("/") || normalizedName.includes("\\")) {
    return "Archive file names cannot include path separators.";
  }

  const baseName = normalizedName.slice(0, -ZIP_EXTENSION.length);
  if (DANGEROUS_FILENAME_TOKENS.some((token) => baseName.includes(token))) {
    return "The archive file name contains a blocked executable extension.";
  }

  return null;
}

export function deriveProjectName(file: File, fallback?: string): string {
  const explicit = fallback?.trim();
  if (explicit) return explicit.slice(0, 120);
  return (
    file.name
      .replace(/\.zip$/i, "")
      .trim()
      .slice(0, 120) || "Untitled project"
  );
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeStorageName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

async function uploadArchive(input: {
  userId: string;
  projectId: string;
  file: File;
}): Promise<{ storagePath: string | null; storageAvailable: boolean }> {
  const storagePath = `${input.userId}/${input.projectId}/${Date.now()}-${safeStorageName(input.file.name)}`;
  const { error } = await supabase.storage
    .from(PROJECT_UPLOAD_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || "application/zip",
    });

  if (error) {
    console.warn("[project-upload] Supabase Storage upload skipped or failed", error.message);
    return { storagePath: null, storageAvailable: false };
  }

  return { storagePath, storageAvailable: true };
}

async function requestManifestProcessing(projectId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You must be signed in to process the uploaded project.");

  const response = await fetch("/api/projects/process-zip", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Project manifest extraction failed.");
  }
}

export async function uploadProjectZip(input: UploadProjectInput): Promise<UploadProjectResult> {
  const validationError = validateProjectZip(input.file);
  if (validationError) {
    await recordAuditEvent({
      userId: input.userId,
      eventType: "blocked_upload",
      severity: "warning",
      payload: {
        file_name: input.file.name,
        size_bytes: input.file.size,
        reason: validationError,
      },
    }).catch(() => {});
    await logProjectSecurityEvent({
      userId: input.userId,
      eventType: "project_upload_rejected",
      severity: "warning",
      payload: {
        file_name: input.file.name,
        size_bytes: input.file.size,
        reason: validationError,
      },
    }).catch((error) => console.warn("[project-upload] security event failed", error));
    throw new Error(validationError);
  }

  const [projectQuota, uploadQuota] = await Promise.all([
    checkQuota(input.userId, "max_projects").catch(() => null),
    checkQuota(input.userId, "max_uploads_monthly").catch(() => null),
  ]);
  const uploadMbLimit = await checkQuota(
    input.userId,
    "max_upload_mb",
    Math.ceil(input.file.size / 1024 / 1024),
  ).catch(() => null);

  const blockedQuota = [projectQuota, uploadQuota, uploadMbLimit].find(
    (quota) => quota && !quota.allowed,
  );
  if (blockedQuota) {
    await recordAuditEvent({
      userId: input.userId,
      eventType: "quota_hit_upload",
      severity: "warning",
      payload: {
        limit_key: blockedQuota.limitKey,
        limit: blockedQuota.limit,
        used: blockedQuota.used,
        requested: blockedQuota.requested,
        plan: blockedQuota.planId,
      },
    }).catch(() => {});
    throw new Error(blockedQuota.message);
  }

  const project = await createProject({
    userId: input.userId,
    name: deriveProjectName(input.file, input.projectName),
    description: input.description,
    status: "validating",
  });

  const checksum = await sha256(input.file);
  let job = await createIngestionJob({
    projectId: project.id,
    userId: input.userId,
    status: "validating",
    stage: "client_validation",
    metadata: {
      file_name: input.file.name,
      size_bytes: input.file.size,
      mime_type: input.file.type || null,
      checksum,
    },
  });

  try {
    const upload = await uploadArchive({
      userId: input.userId,
      projectId: project.id,
      file: input.file,
    });

    await createProjectFile({
      projectId: project.id,
      userId: input.userId,
      path: upload.storagePath ?? `staged/${safeStorageName(input.file.name)}`,
      name: input.file.name,
      extension: "zip",
      sizeBytes: input.file.size,
      mimeType: input.file.type || null,
      checksum,
    });

    const status = upload.storageAvailable ? "uploaded" : "indexing_mocked";
    await updateProjectStatus(project.id, status);
    await updateIngestionJob(job.id, {
      status,
      stage: upload.storageAvailable ? "archive_uploaded" : "archive_staged_without_storage",
      metadata: {
        file_name: input.file.name,
        size_bytes: input.file.size,
        mime_type: input.file.type || null,
        checksum,
        storage_path: upload.storagePath,
        storage_bucket: upload.storageAvailable ? PROJECT_UPLOAD_BUCKET : null,
        storage_available: upload.storageAvailable,
        extraction: upload.storageAvailable ? "queued_server_manifest" : "mocked",
      },
    });

    job = {
      ...job,
      status,
      stage: upload.storageAvailable ? "archive_uploaded" : "archive_staged_without_storage",
    };

    if (upload.storageAvailable) {
      await requestManifestProcessing(project.id);
      job = { ...job, status: "completed", stage: "completed" };
    }

    await recordUsageEvent({
      userId: input.userId,
      projectId: project.id,
      eventType: "project_upload_completed",
      quantity: 1,
      sizeBytes: input.file.size,
      metadata: {
        file_name: input.file.name,
        storage_available: upload.storageAvailable,
      },
    }).catch((error) => console.warn("[project-upload] usage event failed", error));
    await recordAuditEvent({
      userId: input.userId,
      projectId: project.id,
      eventType: "project_upload_completed",
      payload: { size_bytes: input.file.size, storage_available: upload.storageAvailable },
    }).catch(() => {});

    return {
      project: { ...project, status: upload.storageAvailable ? "indexed_manifest" : status },
      job,
      storagePath: upload.storagePath,
      storageAvailable: upload.storageAvailable,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project upload failed.";
    await updateProjectStatus(project.id, "failed").catch(() => {});
    await updateIngestionJob(job.id, {
      status: "failed",
      stage: "upload_failed",
      error_message: message,
    }).catch(() => {});
    await recordUsageEvent({
      userId: input.userId,
      projectId: project.id,
      eventType: "ingestion_failed",
      metadata: { message },
    }).catch(() => {});
    await recordAuditEvent({
      userId: input.userId,
      projectId: project.id,
      eventType: "ingestion_failed",
      severity: "warning",
      payload: { message },
    }).catch(() => {});
    throw error;
  }
}
