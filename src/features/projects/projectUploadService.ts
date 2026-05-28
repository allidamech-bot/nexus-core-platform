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
import type { FolderImportSummary } from "./folderImportService";
import {
  createCorrelationId,
  safeErrorLog,
  safeErrorMessage,
  withLogContext,
} from "@/lib/safeLogging";

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
  processingSummary?: ZipProcessingSummary;
}

export interface ZipProcessingSummary {
  status: "completed" | "failed" | "rejected";
  totalFilesSeen: number;
  indexedFiles: number;
  skippedFiles: number;
  rejectedFiles: number;
  totalSafeTextBytes: number;
  warnings: string[];
  message: string;
}

export interface ImportFolderInput {
  userId: string;
  summary: FolderImportSummary;
  projectName?: string;
  description?: string;
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

async function requireQuota(
  userId: string,
  limitKey: Parameters<typeof checkQuota>[1],
  requested = 1,
) {
  try {
    return await checkQuota(userId, limitKey, requested);
  } catch (error) {
    const message = safeErrorMessage(
      error,
      "Usage governance could not be verified for this upload.",
    );
    console.warn("[project-upload] quota verification failed", { limitKey, message });

    if (import.meta.env.PROD) {
      throw new Error(
        "Upload quota could not be verified. Apply governance migrations or try again later.",
      );
    }

    return null;
  }
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
    console.warn("[project-upload] Lovable Cloud ZIP storage unavailable; staging without object storage", safeErrorLog(error));
    return { storagePath: null, storageAvailable: false };
  }

  return { storagePath, storageAvailable: true };
}

async function requestManifestProcessing(
  projectId: string,
  correlationId: string,
): Promise<ZipProcessingSummary> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You must be signed in to process the uploaded project.");

  const response = await fetch("/api/projects/process-zip", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-correlation-id": correlationId,
    },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string };
      message = payload.message || payload.error || text;
    } catch {
      // Keep the original text response.
    }
    throw new Error(
      message ||
        "Project ZIP processing is unavailable. Check Lovable Cloud runtime configuration.",
    );
  }

  const payload = (await response.json()) as { summary?: ZipProcessingSummary; message?: string };
  if (!payload.summary) {
    throw new Error(payload.message || "Project ZIP processing did not return a safe summary.");
  }
  return payload.summary;
}

export async function uploadProjectZip(input: UploadProjectInput): Promise<UploadProjectResult> {
  const correlationId = createCorrelationId();
  const validationError = validateProjectZip(input.file);
  if (validationError) {
    await recordAuditEvent({
      userId: input.userId,
      eventType: "blocked_upload",
      correlationId,
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
        correlationId,
        file_name: input.file.name,
        size_bytes: input.file.size,
        reason: validationError,
      },
    }).catch((error) =>
      console.warn(
        "[project-upload] security event failed",
        withLogContext({ correlationId }, safeErrorLog(error)),
      ),
    );
    throw new Error(validationError);
  }

  const [projectQuota, uploadQuota] = await Promise.all([
    requireQuota(input.userId, "max_projects"),
    requireQuota(input.userId, "max_uploads_monthly"),
  ]);
  const uploadMbLimit = await checkQuota(
    input.userId,
    "max_upload_mb",
    Math.ceil(input.file.size / 1024 / 1024),
  ).catch((error) => {
    const message = safeErrorMessage(error, "Upload size quota failed.");
    console.warn(
      "[project-upload] upload size quota verification failed",
      withLogContext({ correlationId }, { message }),
    );
    if (import.meta.env.PROD) {
      throw new Error(
        "Upload size quota could not be verified. Apply governance migrations or try again later.",
      );
    }
    return null;
  });

  const blockedQuota = [projectQuota, uploadQuota, uploadMbLimit].find(
    (quota) => quota && !quota.allowed,
  );
  if (blockedQuota) {
    await recordAuditEvent({
      userId: input.userId,
      eventType: "quota_hit_upload",
      correlationId,
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
      correlationId,
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
        correlationId,
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

    let processingSummary: ZipProcessingSummary | undefined;
    if (upload.storageAvailable) {
      try {
        processingSummary = await requestManifestProcessing(project.id, correlationId);
        job = { ...job, status: "completed", stage: "completed" };
        await recordAuditEvent({
          userId: input.userId,
          projectId: project.id,
          eventType: "project_upload_completed",
          correlationId,
          payload: { size_bytes: input.file.size, storage_available: true },
        }).catch(() => {});
      } catch (processingError) {
        const message = safeErrorMessage(
          processingError,
          "Lovable Cloud ZIP processing failed after the archive was stored.",
        );
        console.warn(
          "[project-upload] ZIP processing unavailable; keeping stored archive project",
          withLogContext({ correlationId }, { message }),
        );
        await updateProjectStatus(project.id, "indexing_mocked").catch(() => {});
        await updateIngestionJob(job.id, {
          status: "completed",
          stage: "zip_processing_unavailable_lovable_fallback",
          error_message: null,
          metadata: {
            file_name: input.file.name,
            size_bytes: input.file.size,
            mime_type: input.file.type || null,
            checksum,
            correlationId,
            storage_path: upload.storagePath,
            storage_bucket: PROJECT_UPLOAD_BUCKET,
            storage_available: true,
            extraction: "lovable_cloud_zip_processing_fallback",
            processing_fallback: true,
            processing_error: message,
          },
        }).catch(() => {});
        await recordUsageEvent({
          userId: input.userId,
          projectId: project.id,
          eventType: "zip_processing_deferred",
          correlationId,
          metadata: { message, source_type: "zip", storage_available: true },
        }).catch(() => {});
        await recordAuditEvent({
          userId: input.userId,
          projectId: project.id,
          eventType: "zip_processing_deferred",
          correlationId,
          severity: "warning",
          payload: { message, storage_available: true },
        }).catch(() => {});
        job = {
          ...job,
          status: "completed",
          stage: "zip_processing_unavailable_lovable_fallback",
        };
      }
    }

    const finalStatus = processingSummary
      ? "indexed_manifest"
      : upload.storageAvailable
        ? "indexing_mocked"
        : status;

    return {
      project: { ...project, status: finalStatus },
      job,
      storagePath: upload.storagePath,
      storageAvailable: upload.storageAvailable,
      processingSummary,
    };
  } catch (error) {
    const message = safeErrorMessage(error, "Project upload failed.");
    const rejected =
      message.includes("unsafe paths") ||
      message.includes("dangerous content") ||
      message.includes("file or size limits");
    await updateProjectStatus(project.id, rejected ? "rejected" : "failed").catch(() => {});
    await updateIngestionJob(job.id, {
      status: rejected ? "rejected" : "failed",
      stage: rejected ? "rejected" : "upload_failed",
      error_message: message,
      metadata: { correlationId },
    }).catch(() => {});
    await recordUsageEvent({
      userId: input.userId,
      projectId: project.id,
      eventType: rejected ? "project_upload_rejected" : "ingestion_failed",
      correlationId,
      metadata: { message },
    }).catch(() => {});
    await recordAuditEvent({
      userId: input.userId,
      projectId: project.id,
      eventType: rejected ? "project_upload_rejected" : "ingestion_failed",
      correlationId,
      severity: "warning",
      payload: { message },
    }).catch(() => {});
    throw error;
  }
}

export async function importProjectFolder(input: ImportFolderInput): Promise<UploadProjectResult> {
  if (input.summary.error) throw new Error(input.summary.error);

  const projectQuota = await requireQuota(input.userId, "max_projects");
  const blockedQuota = [projectQuota].find((quota) => quota && !quota.allowed);
  if (blockedQuota) {
    await recordAuditEvent({
      userId: input.userId,
      eventType: "quota_hit_folder_import",
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
    name: input.projectName?.trim() || input.summary.rootName,
    description: input.description,
    status: "indexed_manifest",
    sourceType: "local",
  });

  const job = await createIngestionJob({
    projectId: project.id,
    userId: input.userId,
    status: "completed",
    stage: "folder_manifest_preview",
    metadata: {
      source_type: "folder",
      accepted_files: input.summary.accepted.length,
      ignored_files: input.summary.ignored.length,
      total_bytes: input.summary.totalBytes,
      ignored_preview: input.summary.ignored.slice(0, 25),
      extraction: "client_folder_manifest_only",
    },
  });

  for (const entry of input.summary.accepted.slice(0, 300)) {
    await createProjectFile({
      projectId: project.id,
      userId: input.userId,
      path: entry.path,
      name: entry.name,
      extension: entry.extension,
      sizeBytes: entry.file.size,
      mimeType: entry.file.type || null,
      checksum: null,
    });
  }

  await recordUsageEvent({
    userId: input.userId,
    projectId: project.id,
    eventType: "folder_import_completed",
    quantity: 1,
    sizeBytes: input.summary.totalBytes,
    metadata: {
      source_type: "folder",
      accepted_files: input.summary.accepted.length,
      ignored_files: input.summary.ignored.length,
    },
  }).catch(() => {});
  await recordAuditEvent({
    userId: input.userId,
    projectId: project.id,
    eventType: "folder_import_completed",
    payload: {
      accepted_files: input.summary.accepted.length,
      ignored_files: input.summary.ignored.length,
      total_bytes: input.summary.totalBytes,
    },
  }).catch(() => {});

  return {
    project,
    job,
    storagePath: null,
    storageAvailable: false,
  };
}
