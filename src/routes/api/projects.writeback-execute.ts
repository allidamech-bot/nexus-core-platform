import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PatchSandboxIssue } from "@/features/projects/patchApplySandbox";
import type {
  ProjectPatchSnapshot,
  ProjectPatchSnapshotFile,
} from "@/features/projects/patchSnapshot";
import {
  buildWorkingCopyRows,
  validateRequestCanExecute,
  type ProjectWorkingCopy,
} from "@/features/projects/projectWorkingCopyService";
import type {
  ProjectWritebackRequest,
  WritebackRequestStatus,
} from "@/features/projects/projectWritebackRequestService";
import type { WritebackRiskLevel } from "@/features/projects/writebackRisk";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";

type SupabaseAuthedClient = ReturnType<typeof createClient<Database>>;

interface Body {
  requestId?: unknown;
}

function jsonResponse(payload: Record<string, unknown>, status: number, correlationId: string) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-correlation-id": correlationId,
    },
  });
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, key };
}

async function requireAuthenticatedClient(request: Request, correlationId: string) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: jsonResponse({ message: "Unauthorized" }, 401, correlationId) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: jsonResponse({ message: "Unauthorized" }, 401, correlationId) };

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[writeback-execute] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return {
      response: jsonResponse({ message: "Writeback execution unavailable" }, 503, correlationId),
    };
  }

  const supabase = createClient<Database>(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return { response: jsonResponse({ message: "Unauthorized" }, 401, correlationId) };
  }

  return { supabase, userId: claimsData.claims.sub };
}

function asIssues(value: Json): PatchSandboxIssue[] {
  return Array.isArray(value) ? (value as unknown as PatchSandboxIssue[]) : [];
}

function toWritebackRequest(
  row: Database["public"]["Tables"]["project_writeback_requests"]["Row"],
): ProjectWritebackRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    patchPreviewId: row.patch_preview_id,
    snapshotId: row.snapshot_id,
    requestedBy: row.requested_by,
    reviewerId: row.reviewed_by,
    status: row.status as WritebackRequestStatus,
    title: row.title,
    requesterNote: row.requester_note,
    reviewerNote: row.reviewer_note,
    reviewDecision:
      row.review_decision === "approved" || row.review_decision === "rejected"
        ? row.review_decision
        : null,
    riskLevel: row.risk_level as WritebackRiskLevel,
    changedFilesCount: row.changed_files_count,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    snapshotSummary: row.snapshot_summary,
    metadata: row.metadata,
    reviewMetadata: row.review_metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

function toPatchSnapshot(
  row: Database["public"]["Tables"]["project_patch_snapshots"]["Row"],
): ProjectPatchSnapshot {
  return {
    id: row.id,
    projectId: row.project_id,
    patchPreviewId: row.patch_preview_id,
    createdBy: row.created_by,
    status: row.status as ProjectPatchSnapshot["status"],
    title: row.title,
    summary: row.summary,
    source: row.source as ProjectPatchSnapshot["source"],
    verificationStatus: row.verification_status as ProjectPatchSnapshot["verificationStatus"],
    changedFilesCount: row.changed_files_count,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function toPatchSnapshotFile(
  row: Database["public"]["Tables"]["project_patch_snapshot_files"]["Row"],
): ProjectPatchSnapshotFile {
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
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    createdAt: row.created_at,
  };
}

function toWorkingCopy(row: Database["public"]["Tables"]["project_working_copies"]["Row"]) {
  return {
    id: row.id,
    projectId: row.project_id,
    writebackRequestId: row.writeback_request_id,
    patchPreviewId: row.patch_preview_id,
    patchSnapshotId: row.patch_snapshot_id,
    createdBy: row.created_by,
    executedBy: row.executed_by,
    status: row.status as ProjectWorkingCopy["status"],
    title: row.title,
    summary: row.summary,
    source: row.source as ProjectWorkingCopy["source"],
    changedFilesCount: row.changed_files_count,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function parseBody(body: Body) {
  if (typeof body.requestId !== "string" || !body.requestId) {
    throw new Error("Writeback request id required.");
  }
  return { requestId: body.requestId };
}

async function isAdmin(supabase: SupabaseAuthedClient) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return Boolean(data);
}

async function auditExecution(input: {
  supabase: SupabaseAuthedClient;
  actorId: string;
  request: ProjectWritebackRequest;
  workingCopy: ProjectWorkingCopy;
  alreadyExists: boolean;
}) {
  const { error } = await input.supabase.from("audit_events").insert({
    user_id: input.request.requestedBy,
    actor_user_id: input.actorId,
    event_type: input.alreadyExists
      ? "writeback_working_copy_already_exists"
      : "writeback_working_copy_created",
    severity: "info",
    project_id: input.request.projectId,
    payload: {
      working_copy_id: input.workingCopy.id,
      request_id: input.request.id,
      snapshot_id: input.request.snapshotId,
      patch_preview_id: input.request.patchPreviewId,
      actor_id: input.actorId,
      old_status: input.request.status,
      new_status: input.request.status,
      changed_files_count: input.workingCopy.changedFilesCount,
      warning_count: input.workingCopy.warnings.length,
      blocker_count: input.workingCopy.blockers.length,
      source_zip_overwritten: false,
      object_storage_modified: false,
      original_project_files_modified: false,
      original_text_previews_modified: false,
      code_executed: false,
      deployment_performed: false,
    } as unknown as Json,
  });
  if (error) console.warn("[writeback-execute] audit write failed", safeErrorLog(error));
}

async function loadExistingWorkingCopy(input: {
  supabase: SupabaseAuthedClient;
  requestId: string;
}): Promise<ProjectWorkingCopy | null> {
  const { data, error } = await input.supabase
    .from("project_working_copies")
    .select("*")
    .eq("writeback_request_id", input.requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toWorkingCopy(data) : null;
}

async function execute(input: {
  supabase: SupabaseAuthedClient;
  userId: string;
  requestId: string;
  correlationId: string;
}) {
  const { data: requestRow, error: requestError } = await input.supabase
    .from("project_writeback_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!requestRow) {
    return jsonResponse({ message: "Writeback request not found." }, 404, input.correlationId);
  }

  const request = toWritebackRequest(requestRow);
  const admin = await isAdmin(input.supabase);
  if (!admin && request.requestedBy !== input.userId) {
    return jsonResponse({ message: "Forbidden" }, 403, input.correlationId);
  }

  const existing = await loadExistingWorkingCopy({
    supabase: input.supabase,
    requestId: request.id,
  });
  if (existing) {
    await auditExecution({
      supabase: input.supabase,
      actorId: input.userId,
      request,
      workingCopy: existing,
      alreadyExists: true,
    });
    return jsonResponse(
      {
        workingCopyId: existing.id,
        status: existing.status,
        changedFilesCount: existing.changedFilesCount,
        message: "Working copy already exists",
        warnings: existing.warnings,
        blockers: existing.blockers,
        workingCopy: existing,
        alreadyExists: true,
      },
      200,
      input.correlationId,
    );
  }

  const [{ data: snapshotRow, error: snapshotError }, { data: fileRows, error: fileError }] =
    await Promise.all([
      input.supabase
        .from("project_patch_snapshots")
        .select("*")
        .eq("id", request.snapshotId)
        .maybeSingle(),
      input.supabase
        .from("project_patch_snapshot_files")
        .select("*")
        .eq("snapshot_id", request.snapshotId)
        .order("file_path", { ascending: true }),
    ]);
  if (snapshotError) throw snapshotError;
  if (fileError) throw fileError;

  const snapshot = snapshotRow ? toPatchSnapshot(snapshotRow) : null;
  const files = (fileRows ?? []).map(toPatchSnapshotFile);
  validateRequestCanExecute({ request, snapshot, files });

  const rows = await buildWorkingCopyRows({
    request,
    snapshot: snapshot!,
    files,
    actorId: input.userId,
  });
  const { data: workingCopyRow, error: insertError } = await input.supabase
    .from("project_working_copies")
    .insert({
      project_id: rows.workingCopy.projectId,
      writeback_request_id: rows.workingCopy.writebackRequestId,
      patch_preview_id: rows.workingCopy.patchPreviewId,
      patch_snapshot_id: rows.workingCopy.patchSnapshotId,
      created_by: rows.workingCopy.createdBy,
      executed_by: rows.workingCopy.executedBy,
      status: rows.workingCopy.status,
      title: rows.workingCopy.title,
      summary: rows.workingCopy.summary,
      source: rows.workingCopy.source,
      changed_files_count: rows.workingCopy.changedFilesCount,
      warnings: rows.workingCopy.warnings as unknown as Json,
      blockers: rows.workingCopy.blockers as unknown as Json,
      metadata: rows.workingCopy.metadata,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const duplicate = await loadExistingWorkingCopy({
        supabase: input.supabase,
        requestId: request.id,
      });
      if (duplicate) {
        return jsonResponse(
          {
            workingCopyId: duplicate.id,
            status: duplicate.status,
            changedFilesCount: duplicate.changedFilesCount,
            message: "Working copy already exists",
            warnings: duplicate.warnings,
            blockers: duplicate.blockers,
            workingCopy: duplicate,
            alreadyExists: true,
          },
          200,
          input.correlationId,
        );
      }
    }
    throw insertError;
  }

  const workingCopy = toWorkingCopy(workingCopyRow);
  if (rows.files.length > 0) {
    const { error: filesInsertError } = await input.supabase
      .from("project_working_copy_files")
      .insert(
        rows.files.map((file) => ({
          ...file,
          working_copy_id: workingCopy.id,
        })),
      );
    if (filesInsertError) throw filesInsertError;
  }

  await auditExecution({
    supabase: input.supabase,
    actorId: input.userId,
    request,
    workingCopy,
    alreadyExists: false,
  });

  return jsonResponse(
    {
      workingCopyId: workingCopy.id,
      status: workingCopy.status,
      changedFilesCount: workingCopy.changedFilesCount,
      message: "Working copy created",
      warnings: workingCopy.warnings,
      blockers: workingCopy.blockers,
      workingCopy,
      alreadyExists: false,
    },
    200,
    input.correlationId,
  );
}

export const Route = createFileRoute("/api/projects/writeback-execute")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;
          const input = parseBody((await request.json().catch(() => ({}))) as Body);
          return execute({
            supabase: access.supabase,
            userId: access.userId,
            requestId: input.requestId,
            correlationId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Working copy creation failed.";
          const status = message.includes("Unauthorized")
            ? 401
            : message.includes("Forbidden")
              ? 403
              : message.includes("required")
                ? 400
                : message.includes("approved") || message.includes("blocked")
                  ? 422
                  : 500;
          if (status === 500) {
            console.error(
              "[writeback-execute] action failed",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
          }
          return jsonResponse(
            { message: status === 500 ? "Working copy creation failed." : message },
            status,
            correlationId,
          );
        }
      },
    },
  },
});
