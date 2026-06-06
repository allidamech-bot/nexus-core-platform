import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PatchSandboxIssue } from "@/features/projects/patchApplySandbox";
import {
  buildWritebackReviewSummary,
  validateWritebackStatusTransition,
  type ProjectWritebackRequest,
  type WritebackReviewAction,
  type WritebackRequestStatus,
} from "@/features/projects/projectWritebackRequestService";
import type { WritebackRiskLevel } from "@/features/projects/writebackRisk";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";
import { validateApprovalCount, validateRestrictedFiles } from "@/features/enterprise/policyEngine";
import { getPatchSnapshotFiles } from "@/features/projects/projectPatchPreviewService";
import type { WritebackApproval } from "@/features/enterprise/tenantTypes";
import type { ProjectWorkingCopyFile } from "@/features/projects/projectWorkingCopyService";

type SupabaseAuthedClient = ReturnType<typeof createClient<Database>>;
type TransitionResult =
  | { response: Response; request?: never }
  | { request: ProjectWritebackRequest; response?: never };

interface Body {
  requestId?: unknown;
  action?: unknown;
  note?: unknown;
  reviewerNote?: unknown;
}

interface ReviewFailureLog {
  action?: WritebackReviewAction;
  requestId?: string;
  userId?: string;
  requestStatus?: WritebackRequestStatus;
  isAdmin?: boolean;
  isProjectOwner?: boolean;
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
      "[writeback-review] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return {
      response: jsonResponse({ message: "Writeback review unavailable" }, 503, correlationId),
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

function parseBody(body: Body) {
  const action = body.action;
  if (action !== "submit" && action !== "cancel" && action !== "approve" && action !== "reject") {
    throw new Error("Invalid writeback review action.");
  }
  if (typeof body.requestId !== "string" || !body.requestId) {
    throw new Error("Writeback request id required.");
  }
  return {
    requestId: body.requestId,
    action: action as WritebackReviewAction,
    note:
      typeof body.reviewerNote === "string"
        ? body.reviewerNote.slice(0, 4000)
        : typeof body.note === "string"
          ? body.note.slice(0, 4000)
          : undefined,
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
        : "Writeback review failed.";
  return {
    message,
    error:
      typeof maybe.name === "string" ? maybe.name : error instanceof Error ? error.name : "Error",
    code: typeof maybe.code === "string" ? maybe.code : undefined,
    details: typeof maybe.details === "string" ? maybe.details : undefined,
    hint: typeof maybe.hint === "string" ? maybe.hint : undefined,
  };
}

function logWritebackFailure(input: ReviewFailureLog & { error: unknown }) {
  const details = errorDetails(input.error);
  console.error("[writeback-review] failed", {
    action: input.action,
    requestId: input.requestId,
    userId: input.userId,
    requestStatus: input.requestStatus,
    isAdmin: input.isAdmin,
    isProjectOwner: input.isProjectOwner,
    error: details.message,
    code: details.code,
    details: details.details,
    hint: details.hint,
  });
}

async function checkAdmin(input: { supabase: SupabaseAuthedClient }) {
  const { data, error } = await input.supabase.rpc("is_admin");
  if (error) {
    console.warn("[writeback-review] admin check failed", safeErrorLog(error));
    return false;
  }
  return Boolean(data);
}

async function checkProjectOwner(input: {
  supabase: SupabaseAuthedClient;
  projectId: string;
  userId: string;
}) {
  const { data, error } = await input.supabase
    .from("projects")
    .select("user_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id === input.userId;
}

async function loadRequest(input: { supabase: SupabaseAuthedClient; requestId: string }) {
  const { data, error } = await input.supabase
    .from("project_writeback_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? toWritebackRequest(data) : null;
}

async function auditReview(input: {
  supabase: SupabaseAuthedClient;
  actorId: string;
  request: ProjectWritebackRequest;
  action: WritebackReviewAction;
  oldStatus: WritebackRequestStatus;
  newStatus: WritebackRequestStatus;
  eventType: string;
  severity?: "info" | "warning";
}) {
  const summary = buildWritebackReviewSummary({
    request: { ...input.request, status: input.oldStatus },
    actorId: input.actorId,
    action: input.action,
    newStatus: input.newStatus,
  });

  // Fetch tenant_id from project
  const { data: projectData } = await input.supabase
    .from("projects")
    .select("tenant_id")
    .eq("id", input.request.projectId)
    .maybeSingle();

  const { error } = await input.supabase.from("audit_events").insert({
    user_id: input.request.requestedBy || null,
    actor_user_id: input.actorId || null,
    event_type: input.eventType,
    severity: input.severity || "info",
    project_id: input.request.projectId || null,
    tenant_id: projectData?.tenant_id || null,
    payload: summary as unknown as Json,
  } as any);
  if (error) console.warn("[writeback-review] audit write failed", safeErrorLog(error));
}

async function applyTransition(input: {
  supabase: SupabaseAuthedClient;
  userId: string;
  request: ProjectWritebackRequest;
  action: WritebackReviewAction;
  note?: string;
  correlationId: string;
  onAuthorizationChecked?: (auth: { isAdmin: boolean; isProjectOwner: boolean }) => void;
}): Promise<TransitionResult> {
  const reviewerAction = input.action === "approve" || input.action === "reject";
  if (reviewerAction) {
    const [isAdmin, isProjectOwner] = await Promise.all([
      checkAdmin({ supabase: input.supabase }),
      checkProjectOwner({
        supabase: input.supabase,
        projectId: input.request.projectId,
        userId: input.userId,
      }),
    ]);
    input.onAuthorizationChecked?.({ isAdmin, isProjectOwner });

    if (!isAdmin && !isProjectOwner) {
      return {
        response: jsonResponse(
          {
            message: "Reviewer authorization required.",
            error: "Reviewer authorization required.",
            code: "403",
            details: "User must be an admin/reviewer or the owner of the linked project.",
            hint: "Use an admin account or the project owner's account.",
          },
          403,
          input.correlationId,
        ),
      };
    }

    if (input.request.status !== "submitted") {
      return {
        response: jsonResponse(
          {
            message: "Only submitted requests can be reviewed.",
            error: "Invalid writeback request status.",
            code: "422",
            details: `Current request status is ${input.request.status}.`,
            hint: "Submit the writeback request before approving or rejecting it.",
          },
          422,
          input.correlationId,
        ),
      };
    }
  } else if (input.request.requestedBy !== input.userId) {
    return {
      response: jsonResponse(
        {
          message: "Forbidden",
          error: "Forbidden",
          code: "403",
          details: "Only the requester can submit or cancel this writeback request.",
        },
        403,
        input.correlationId,
      ),
    };
  }

  if (input.action === "approve" && input.request.blockers.length > 0) {
    await auditReview({
      supabase: input.supabase,
      actorId: input.userId,
      request: input.request,
      action: "approve",
      oldStatus: input.request.status,
      newStatus: input.request.status,
      eventType: "writeback_request_approval_blocked",
      severity: "warning",
    });
  }

  let newStatus = validateWritebackStatusTransition({
    action: input.action,
    actorRole: reviewerAction ? "reviewer" : "requester",
    fromStatus: input.request.status,
    reviewedAt: input.request.reviewedAt,
    blockerCount: input.request.blockers.length,
    reviewerNote: input.note,
  });

  if (reviewerAction) {
    // Phase 6: Upsert approval record
    const { error: approvalError } = await input.supabase
      .from("writeback_request_approvals")
      .upsert({
        request_id: input.request.id,
        reviewer_id: input.userId,
        status: input.action === "approve" ? "approved" : "rejected",
        reviewer_note: input.note?.trim() || null,
      }, { onConflict: "request_id, reviewer_id" });

    if (approvalError) throw approvalError;

    // Phase 5 & 6 Policy Enforcement
    if (input.action === "approve") {
      const { data: approvalsData, error: approvalsError } = await input.supabase
        .from("writeback_request_approvals")
        .select("*")
        .eq("request_id", input.request.id);

      if (approvalsError) throw approvalsError;

      const approvals: WritebackApproval[] = approvalsData.map(row => ({
        id: row.id,
        requestId: row.request_id,
        reviewerId: row.reviewer_id,
        status: row.status as "approved" | "rejected",
        reviewerNote: row.reviewer_note,
        createdAt: row.created_at,
      }));

      const files = await getPatchSnapshotFiles(input.request.snapshotId);
      const restrictedCheck = validateRestrictedFiles(files as unknown as ProjectWorkingCopyFile[]);

      if (!restrictedCheck.allowed) {
        return {
          response: jsonResponse(
            {
              message: "Blocked by policy engine.",
              error: "Policy Engine Block",
              code: "422",
              details: restrictedCheck.blockers.join(" "),
            },
            422,
            input.correlationId,
          ),
        };
      }

      // We default to "production" target logic requiring 2 approvals
      const quorumCheck = validateApprovalCount(input.request, approvals, 2);

      if (!quorumCheck.allowed) {
        // Quorum not met, keep status as "submitted"
        newStatus = "submitted";
      } else {
        newStatus = "approved";
      }
    }
  }

  const now = new Date().toISOString();
  const update =
    input.action === "submit"
      ? { status: newStatus, submitted_at: now }
      : input.action === "cancel"
        ? { status: newStatus }
        : {
            status: newStatus,
            reviewed_by: input.userId,
            reviewer_note: input.note?.trim() || null,
            reviewed_at: now,
            review_decision: newStatus === "approved" ? "approved" : "rejected",
          };

  const query = input.supabase
    .from("project_writeback_requests")
    .update(update)
    .eq("id", input.request.id);

  const guardedQuery =
    input.action === "submit"
      ? query.eq("status", "draft")
      : input.action === "cancel"
        ? query.in("status", ["draft", "submitted"]).is("reviewed_at", null)
        : query.eq("status", input.request.status);

  const { data, error } = await guardedQuery.select().single();
  if (error) throw error;

  const request = toWritebackRequest(data);
  await auditReview({
    supabase: input.supabase,
    actorId: input.userId,
    request: input.request,
    action: input.action,
    oldStatus: input.request.status,
    newStatus,
    eventType: `writeback_request_${input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : input.action === "submit" ? "submitted" : "cancelled"}`,
  });

  return { request };
}

export const Route = createFileRoute("/api/projects/writeback-review")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        let failureContext: ReviewFailureLog = {};
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          const input = parseBody((await request.json().catch(() => ({}))) as Body);
          failureContext = {
            action: input.action,
            requestId: input.requestId,
            userId: access.userId,
          };
          const current = await loadRequest({
            supabase: access.supabase,
            requestId: input.requestId,
          });
          if (!current) {
            return jsonResponse({ message: "Writeback request not found." }, 404, correlationId);
          }
          failureContext.requestStatus = current.status;

          const result = await applyTransition({
            supabase: access.supabase,
            userId: access.userId,
            request: current,
            action: input.action,
            note: input.note,
            correlationId,
            onAuthorizationChecked: (auth) => {
              failureContext = {
                ...failureContext,
                isAdmin: auth.isAdmin,
                isProjectOwner: auth.isProjectOwner,
              };
            },
          });
          if (result.response) return result.response;
          if (!result.request) {
            return jsonResponse({ message: "Writeback review failed." }, 500, correlationId);
          }

          return jsonResponse(
            {
              requestId: result.request.id,
              status: result.request.status,
              riskLevel: result.request.riskLevel,
              reviewedAt: result.request.reviewedAt,
              reviewerId: result.request.reviewerId,
              message:
                result.request.status === "approved"
                  ? "Approved for future writeback consideration."
                  : result.request.status === "rejected"
                    ? "Rejected by reviewer."
                    : "Writeback request updated.",
              request: result.request,
            },
            200,
            correlationId,
          );
        } catch (error) {
          const details = errorDetails(error);
          const message = details.message;
          const status = message.includes("Unauthorized")
            ? 401
            : message.includes("authorization") || message.includes("Forbidden")
              ? 403
              : message.includes("required") || message.includes("Invalid")
                ? 400
                : message.includes("blockers") ||
                    message.includes("approved") ||
                    message.includes("submitted") ||
                    message.includes("rejection")
                  ? 422
                  : 500;

          if (status === 500) {
            logWritebackFailure({ ...failureContext, error });
          }

          return jsonResponse(
            {
              message,
              error: message,
              code: details.code ?? status.toString(),
              details: details.details ?? message,
              hint:
                details.hint ??
                (status === 403 ? "You may need project owner or admin privileges." : undefined),
            },
            status,
            correlationId,
          );
        }
      },
    },
  },
});
