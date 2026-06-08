import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PatchSandboxIssue } from "@/features/projects/patchSandboxTypes";
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

interface ExecuteFailureContext {
  requestId?: string;
  userId?: string;
  requestStatus?: string;
  projectId?: string;
  snapshotId?: string;
  workingCopyId?: string;
  action?: string;
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
    requiredApprovals: row.required_approvals,
    currentApprovals: row.current_approvals,
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
    status: row.status as ProjectWorkingCopy["status"],
    title: row.title,
    summary: row.summary,
    source: "approved_writeback_request" as ProjectWorkingCopy["source"],
    changedFilesCount: meta.changedFilesCount ?? 0,
    warnings: asIssues((meta.warnings ?? []) as unknown as Json),
    blockers: asIssues((meta.blockers ?? []) as unknown as Json),
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function errorDetails(error: unknown) {
  const maybe = error as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    name?: unknown;
  };
  const message =
    error instanceof Error
      ? error.message
      : typeof maybe.message === "string"
        ? maybe.message
        : "Working copy creation failed.";
  return {
    message,
    error:
      typeof maybe.name === "string" ? maybe.name : error instanceof Error ? error.name : "Error",
    code: typeof maybe.code === "string" ? maybe.code : undefined,
    details: typeof maybe.details === "string" ? maybe.details : undefined,
    hint: typeof maybe.hint === "string" ? maybe.hint : undefined,
  };
}

function logExecuteFailure(input: ExecuteFailureContext & { error: unknown }) {
  const details = errorDetails(input.error);
  console.error("[writeback-execute] failed", {
    requestId: input.requestId,
    userId: input.userId,
    requestStatus: input.requestStatus,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    workingCopyId: input.workingCopyId,
    action: input.action,
    error: details.message,
    code: details.code,
    details: details.details,
    hint: details.hint,
  });
}

function parseBody(body: Body) {
  if (typeof body.requestId !== "string" || !body.requestId) {
    throw new Error("Writeback request id required.");
  }
  return { requestId: body.requestId };
}

async function isAdmin(supabase: SupabaseAuthedClient) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.warn("[writeback-execute] admin check failed", safeErrorLog(error));
    return false;
  }
  return Boolean(data);
}

async function getProject(input: { supabase: SupabaseAuthedClient; projectId: string }) {
  const { data, error } = await input.supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
    .eq("request_id", input.requestId)
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
  onContext?: (context: Partial<ExecuteFailureContext>) => void;
}) {
  input.onContext?.({ requestId: input.requestId, userId: input.userId, action: "load_request" });
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
  input.onContext?.({
    requestStatus: request.status,
    projectId: request.projectId,
    snapshotId: request.snapshotId,
  });
  if (request.status !== "approved") {
    return jsonResponse(
      {
        message: "Request must be approved before execution.",
        error: "Invalid writeback request status.",
        code: "422",
        details: `Current request status is ${request.status}.`,
      },
      422,
      input.correlationId,
    );
  }

  const [admin, project] = await Promise.all([
    isAdmin(input.supabase),
    getProject({
      supabase: input.supabase,
      projectId: request.projectId,
    }),
  ]);

  if (!project) {
    return jsonResponse({ message: "Project not found." }, 404, input.correlationId);
  }

  const projectOwner = project.user_id === input.userId;
  if (!admin && !projectOwner) {
    return jsonResponse(
      {
        message: "Forbidden",
        error: "Forbidden",
        code: "403",
        details: "User must be an admin/reviewer or the owner of the linked project.",
        hint: "Use an admin account or the project owner's account.",
      },
      403,
      input.correlationId,
    );
  }

  input.onContext?.({ action: "load_existing_working_copy" });
  const existing = await loadExistingWorkingCopy({
    supabase: input.supabase,
    requestId: request.id,
  });
  if (existing) {
    input.onContext?.({ workingCopyId: existing.id });
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

  input.onContext?.({ action: "load_snapshot_files" });
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
  if (!snapshot) {
    return jsonResponse(
      {
        message: "Patch snapshot not found.",
        error: "Patch snapshot not found.",
        code: "400",
        details: `Snapshot ${request.snapshotId} was not found.`,
      },
      400,
      input.correlationId,
    );
  }
  if (files.length < 1) {
    return jsonResponse(
      {
        message: "Patch snapshot has no files.",
        error: "Patch snapshot has no files.",
        code: "400",
        details: `Snapshot ${request.snapshotId} has no files to copy.`,
      },
      400,
      input.correlationId,
    );
  }
  validateRequestCanExecute({ request, snapshot, files });

  const rows = await buildWorkingCopyRows({
    request,
    snapshot: snapshot!,
    files,
    actorId: input.userId,
  });
  input.onContext?.({ action: "insert_working_copy" });
  const { data: workingCopyRow, error: insertError } = await input.supabase
    .from("project_working_copies")
    .insert({
      project_id: rows.workingCopy.projectId,
      request_id: rows.workingCopy.writebackRequestId,
      snapshot_id: rows.workingCopy.patchSnapshotId,
      created_by: rows.workingCopy.createdBy,
      status: rows.workingCopy.status,
      title: rows.workingCopy.title,
      summary: rows.workingCopy.summary,
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
  input.onContext?.({ workingCopyId: workingCopy.id, action: "insert_working_copy_files" });
  if (rows.files.length > 0) {
    const { error: filesInsertError } = await input.supabase
      .from("project_working_copy_files")
      .insert(
        rows.files.map((file) => ({
          project_id: file.project_id,
          working_copy_id: workingCopy.id,
          original_preview_text: file.original_preview_text,
          working_copy_text: file.working_copy_text,
          file_path: file.file_path,
          changed: file.changed,
          warnings: file.warnings,
          blockers: file.blockers,
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

  let githubPrUrl: string | undefined;

  if (
    project.source_type === "github" &&
    project.github_installation_id &&
    project.github_repo_full_name
  ) {
    try {
      const { createPullRequestWithChanges } = await import("@/features/github/githubService");
      const branchName = `nexus-patch-${workingCopy.id.slice(0, 8)}`;
      const prRes = await createPullRequestWithChanges(
        project.github_installation_id,
        project.github_repo_full_name,
        branchName,
        request.title ?? `Nexus Patch: ${workingCopy.id.slice(0, 8)}`,
        request.requesterNote ?? "Automated writeback patch generated by Nexus Core.",
        rows.files
          .filter((f) => f.changed)
          .map((f) => ({ path: f.file_path, content: f.working_copy_text ?? "" })),
      );
      githubPrUrl = prRes.html_url;

      // Update working copy metadata with PR URL
      await input.supabase
        .from("project_working_copies")
        .update({
          metadata: {
            ...(workingCopy.metadata as any),
            github_pr_url: githubPrUrl,
          },
        })
        .eq("id", workingCopy.id);
    } catch (e) {
      console.error("Failed to create GitHub PR", e);
      logExecuteFailure({ ...input, action: "github_pr_creation", error: e });
    }
  }

  return jsonResponse(
    {
      workingCopyId: workingCopy.id,
      status: workingCopy.status,
      changedFilesCount: workingCopy.changedFilesCount,
      message: githubPrUrl
        ? "Working copy created and Pull Request opened"
        : "Working copy created",
      warnings: workingCopy.warnings,
      blockers: workingCopy.blockers,
      workingCopy,
      githubPrUrl,
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
        let failureContext: ExecuteFailureContext = {};
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;
          const input = parseBody((await request.json().catch(() => ({}))) as Body);
          failureContext = {
            requestId: input.requestId,
            userId: access.userId,
            action: "start",
          };
          return execute({
            supabase: access.supabase,
            userId: access.userId,
            requestId: input.requestId,
            correlationId,
            onContext: (context) => {
              failureContext = { ...failureContext, ...context };
            },
          });
        } catch (error) {
          const details = errorDetails(error);
          const message = details.message;
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
            logExecuteFailure({ ...failureContext, error });
          }
          return jsonResponse(
            {
              message,
              error: message,
              code: details.code ?? status.toString(),
              details: details.details ?? message,
              hint: details.hint,
            },
            status,
            correlationId,
          );
        }
      },
    },
  },
});
