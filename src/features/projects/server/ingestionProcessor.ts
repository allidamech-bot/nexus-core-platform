import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { PROJECT_UPLOAD_BUCKET } from "../constants";
import type { Project, ProjectIngestionJob, ProjectManifest } from "../types";
import { generateProjectManifest } from "./manifestGenerator";
import { generateTextPreviewsFromArchive } from "./textPreviewIndexer";
import { readZipCentralDirectory, toProjectFileInsert } from "./zipCentralDirectory";
import { ZipRejectedError } from "./zipSafety";
import { safeErrorLog, safeErrorMessage, withLogContext } from "@/lib/safeLogging";

type ProjectSupabaseClient = SupabaseClient<Database>;

interface ProcessProjectArchiveInput {
  supabase: ProjectSupabaseClient;
  userId: string;
  projectId: string;
  correlationId?: string;
}

interface ProcessProjectArchiveResult {
  project: Project;
  job: ProjectIngestionJob;
  manifest: ProjectManifest;
  fileCount: number;
  summary: ZipProcessingSummary;
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

function asRecord(value: Json): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] => entry[1] !== undefined),
  );
}

async function updateJob(
  supabase: ProjectSupabaseClient,
  jobId: string,
  patch: Database["public"]["Tables"]["project_ingestion_jobs"]["Update"],
) {
  const { error } = await supabase
    .from("project_ingestion_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) throw error;
}

async function updateProjectStatus(
  supabase: ProjectSupabaseClient,
  projectId: string,
  status: string,
) {
  const { error } = await supabase
    .from("projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) throw error;
}

async function logSecurityEvent(
  supabase: ProjectSupabaseClient,
  input: {
    userId: string;
    projectId: string;
    severity: string;
    eventType: string;
    payload: Record<string, Json>;
    correlationId?: string;
  },
) {
  const { error } = await supabase.from("project_security_events").insert({
    user_id: input.userId,
    project_id: input.projectId,
    severity: input.severity,
    event_type: input.eventType,
    payload: input.correlationId
      ? { ...input.payload, correlationId: input.correlationId }
      : input.payload,
  });

  if (error)
    console.warn(
      "[project-ingestion] security event failed",
      input.correlationId
        ? withLogContext({ correlationId: input.correlationId }, safeErrorLog(error))
        : safeErrorLog(error),
    );
}

function sumSkipped(skipped: Record<string, number>): number {
  return Object.values(skipped).reduce((sum, count) => sum + count, 0);
}

function rowsSkippedCount(
  inventory: { files: Array<{ mime_type: string }>; skipped: Record<string, number> },
  previewSkipped: Record<string, number>,
): number {
  const nonPreviewableManifestRows = inventory.files.filter(
    (file) => file.mime_type !== "text",
  ).length;
  return sumSkipped(inventory.skipped) + nonPreviewableManifestRows + sumSkipped(previewSkipped);
}

function successfulZipUploadIdempotencyKey(projectId: string, jobId: string): string {
  return `zip-upload:${projectId}:${jobId}`;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505",
  );
}

async function recordSuccessfulZipUploadUsage(input: {
  supabase: ProjectSupabaseClient;
  userId: string;
  projectId: string;
  jobId: string;
  fileName: string | null;
  sizeBytes: number;
  correlationId?: string;
}) {
  const idempotencyKey = successfulZipUploadIdempotencyKey(input.projectId, input.jobId);
  const { data: existing, error: existingError } = await input.supabase
    .from("usage_events")
    .select("id")
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("event_type", "project_upload_completed")
    .limit(1);

  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) return;

  const { error } = await input.supabase.from("usage_events").insert({
    user_id: input.userId,
    project_id: input.projectId,
    event_type: "project_upload_completed",
    idempotency_key: idempotencyKey,
    quantity: 1,
    size_bytes: input.sizeBytes,
    metadata: {
      correlationId: input.correlationId,
      file_name: input.fileName,
      source_type: "zip",
      storage_available: true,
      status: "indexed_manifest",
      ingestion_job_id: input.jobId,
    },
  });

  if (isUniqueViolation(error)) return;
  if (error) throw error;
}

async function applyPreviewQuota(
  supabase: ProjectSupabaseClient,
  userId: string,
  rows: Array<
    Database["public"]["Tables"]["project_text_previews"]["Insert"] & { preview_text: string }
  >,
) {
  const quotaChecks = await Promise.all([
    supabase.rpc("get_plan_limit", {
      check_user_id: userId,
      limit_key: "max_text_preview_files",
    }),
    supabase.rpc("get_plan_limit", {
      check_user_id: userId,
      limit_key: "max_indexed_preview_bytes",
    }),
    supabase.rpc("get_usage_total", {
      check_user_id: userId,
      metric_name: "indexed_preview_files",
    }),
    supabase.rpc("get_usage_total", {
      check_user_id: userId,
      metric_name: "indexed_preview_bytes",
    }),
  ]);

  for (const check of quotaChecks) {
    if (check.error) throw check.error;
  }

  const [fileLimit, byteLimit, currentFiles, currentBytes] = quotaChecks.map((check) => check.data);

  const remainingFiles =
    fileLimit === null ? rows.length : Math.max(0, Number(fileLimit) - Number(currentFiles ?? 0));
  const remainingBytes =
    byteLimit === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number(byteLimit) - Number(currentBytes ?? 0));
  const accepted = [];
  let usedBytes = 0;

  for (const row of rows.slice(0, remainingFiles)) {
    const rowBytes = row.preview_text.length;
    if (usedBytes + rowBytes > remainingBytes) break;
    accepted.push(row);
    usedBytes += rowBytes;
  }

  return accepted;
}

export async function processProjectArchive({
  supabase,
  userId,
  projectId,
  correlationId,
}: ProcessProjectArchiveInput): Promise<ProcessProjectArchiveResult> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError) throw projectError;
  if (!project || project.user_id !== userId) throw new Error("Project not found.");

  const { data: jobs, error: jobError } = await supabase
    .from("project_ingestion_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (jobError) throw jobError;
  const job = jobs?.[0] as ProjectIngestionJob | undefined;
  if (!job) throw new Error("Ingestion job not found.");
  if (job.user_id !== userId || job.project_id !== projectId) {
    throw new Error("Ingestion job not found.");
  }

  const existingMetadata = asRecord(job.metadata);
  const storagePath =
    typeof existingMetadata.storage_path === "string" ? existingMetadata.storage_path : null;
  if (!storagePath) throw new Error("No uploaded archive is available for processing.");

  try {
    await updateProjectStatus(supabase, projectId, "processing");
    await updateJob(supabase, job.id, {
      status: "validating",
      stage: "server_validation",
      error_message: null,
      metadata: {
        ...existingMetadata,
        ...(correlationId ? { correlationId } : {}),
        pipeline: "zip_manifest_text_preview_v1",
      },
    });

    const { data: archive, error: downloadError } = await supabase.storage
      .from(PROJECT_UPLOAD_BUCKET)
      .download(storagePath);

    if (downloadError) throw downloadError;
    if (!archive) throw new Error("Uploaded archive could not be downloaded.");
    const archiveBytes = new Uint8Array(await archive.arrayBuffer());

    await updateProjectStatus(supabase, projectId, "processing");
    await updateJob(supabase, job.id, { status: "processing", stage: "scanning" });
    const inventory = readZipCentralDirectory(archiveBytes);

    await updateJob(supabase, job.id, { status: "processing", stage: "manifest_generation" });
    const manifest = generateProjectManifest(inventory);
    await updateJob(supabase, job.id, { status: "processing", stage: "text_preview_indexing" });
    const previewIndex = await generateTextPreviewsFromArchive(archiveBytes, inventory.files);
    let indexedPreviewCount = 0;
    let indexedPreviewBytes = 0;

    if (inventory.suspicious.length > 0) {
      await logSecurityEvent(supabase, {
        userId,
        projectId,
        severity: "warning",
        eventType: "project_zip_suspicious_entries",
        correlationId,
        payload: {
          count: inventory.suspicious.length,
          entries: inventory.suspicious.slice(0, 25) as unknown as Json,
          skipped_reasons: inventory.skipped,
        },
      });
    }

    if (previewIndex.suspicious.length > 0) {
      await logSecurityEvent(supabase, {
        userId,
        projectId,
        severity: "warning",
        eventType: "project_text_preview_suspicious_entries",
        correlationId,
        payload: {
          count: previewIndex.suspicious.length,
          entries: previewIndex.suspicious.slice(0, 25) as unknown as Json,
          skipped_reasons: previewIndex.skipped,
        },
      });
    }

    if (inventory.files.length > 0) {
      await supabase
        .from("project_files")
        .delete()
        .eq("project_id", projectId)
        .eq("path", storagePath);

      const rows = inventory.files.map((file) =>
        toProjectFileInsert(file, projectId, userId, job.id),
      );
      for (let index = 0; index < rows.length; index += 500) {
        const { error } = await supabase
          .from("project_files")
          .insert(rows.slice(index, index + 500) as any);
        if (error) throw error;
      }

      const previewPaths = previewIndex.previews.map((preview) => preview.path);
      if (previewPaths.length > 0) {
        const { data: fileRows, error: fileRowsError } = await supabase
          .from("project_files")
          .select("id,path")
          .eq("project_id", projectId)
          .in("path", previewPaths);

        if (fileRowsError) throw fileRowsError;

        const fileIdsByPath = new Map((fileRows ?? []).map((row) => [row.path, row.id]));
        const previewRows = previewIndex.previews
          .map((preview) => {
            const fileId = fileIdsByPath.get(preview.path);
            if (!fileId) return null;
            return {
              project_id: projectId,
              file_id: fileId,
              user_id: userId,
              preview_text: preview.preview_text,
              summary: preview.summary,
              detected_language: preview.detected_language,
              truncated: preview.truncated,
              line_count: preview.line_count,
              token_estimate: preview.token_estimate,
              metadata: preview.metadata,
              indexed_at: new Date().toISOString(),
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        const quotaLimitedPreviewRows = await applyPreviewQuota(supabase, userId, previewRows);
        indexedPreviewCount = quotaLimitedPreviewRows.length;
        indexedPreviewBytes = quotaLimitedPreviewRows.reduce(
          (sum, row) => sum + row.preview_text.length,
          0,
        );

        if (quotaLimitedPreviewRows.length < previewRows.length) {
          await logSecurityEvent(supabase, {
            userId,
            projectId,
            severity: "warning",
            eventType: "preview_quota_limited",
            correlationId,
            payload: {
              requested: previewRows.length,
              accepted: quotaLimitedPreviewRows.length,
            },
          });
        }

        if (quotaLimitedPreviewRows.length > 0) {
          const { error: previewError } = await supabase
            .from("project_text_previews")
            .upsert(quotaLimitedPreviewRows, { onConflict: "project_id,file_id" });
          if (previewError) throw previewError;
        }
      }
    }

    const completedMetadata = {
      ...existingMetadata,
      ...(correlationId ? { correlationId } : {}),
      storage_path: storagePath,
      storage_bucket: PROJECT_UPLOAD_BUCKET,
      storage_available: true,
      pipeline: "zip_manifest_text_preview_v1",
      manifest: manifest as unknown as Json,
      text_preview: {
        indexed_count: indexedPreviewCount,
        indexed_bytes: indexedPreviewBytes,
        skipped_reasons: previewIndex.skipped,
      },
    };
    const manifestSkippedFiles = rowsSkippedCount(inventory, previewIndex.skipped);
    const summary: ZipProcessingSummary = {
      status: "completed",
      totalFilesSeen: inventory.files.length + sumSkipped(inventory.skipped),
      indexedFiles: inventory.files.length,
      skippedFiles: manifestSkippedFiles,
      rejectedFiles: 0,
      totalSafeTextBytes: indexedPreviewBytes,
      warnings: [
        ...Object.keys(inventory.skipped),
        ...Object.keys(previewIndex.skipped),
        ...(inventory.suspicious.length > 0 ? ["suspicious_entries_skipped"] : []),
        ...(previewIndex.suspicious.length > 0 ? ["preview_entries_skipped"] : []),
      ],
      message: `ZIP processed successfully. Indexed ${inventory.files.length} files and skipped ${manifestSkippedFiles} files.`,
    };

    await updateProjectStatus(supabase, projectId, "indexed_manifest");
    await updateJob(supabase, job.id, {
      status: "completed",
      stage: "completed",
      error_message: null,
      metadata: completedMetadata,
    });
    const fileName =
      typeof existingMetadata.file_name === "string" ? existingMetadata.file_name : null;
    await recordSuccessfulZipUploadUsage({
      supabase,
      userId,
      projectId,
      jobId: job.id,
      fileName,
      sizeBytes:
        typeof existingMetadata.size_bytes === "number"
          ? existingMetadata.size_bytes
          : archive.size,
      correlationId,
    });

    return {
      project: { ...(project as Project), status: "indexed_manifest" },
      job: {
        ...job,
        status: "completed",
        stage: "completed",
        error_message: null,
        metadata: completedMetadata,
      },
      manifest,
      fileCount: inventory.files.length,
      summary,
    };
  } catch (error) {
    const message = safeErrorMessage(error, "ZIP manifest extraction failed.");
    const rejected = error instanceof ZipRejectedError;
    await updateProjectStatus(supabase, projectId, rejected ? "rejected" : "failed").catch(
      () => {},
    );
    await updateJob(supabase, job.id, {
      status: rejected ? "rejected" : "failed",
      stage: rejected ? "rejected" : "failed",
      error_message: message,
      metadata: {
        ...existingMetadata,
        ...(correlationId ? { correlationId } : {}),
        pipeline: "zip_manifest_text_preview_v1",
        failure: message,
        failure_reason: rejected ? error.reason : "processing_failed",
      },
    }).catch(() => {});
    await logSecurityEvent(supabase, {
      userId,
      projectId,
      severity: "warning",
      eventType: "project_zip_processing_failed",
      correlationId,
      payload: { message },
    });
    throw error;
  }
}
