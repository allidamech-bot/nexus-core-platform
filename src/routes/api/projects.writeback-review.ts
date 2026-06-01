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

type SupabaseAuthedClient = ReturnType<typeof createClient<Database>>;
type TransitionResult =
  | { response: Response; request?: never }
  | { request: ProjectWritebackRequest; response?: never };

interface Body {
  requestId?: unknown;
  action?: unknown;
  note?: unknown;
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
    reviewerId: row.reviewer_id,
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
    note: typeof body.note === "string" ? body.note.slice(0, 4000) : undefined,
  };
}

async function requireAdmin(input: { supabase: SupabaseAuthedClient; correlationId: string }) {
  const { data, error } = await input.supabase.rpc("is_admin");
  if (error) throw error;
  if (!data) {
    return {
      response: jsonResponse(
        { message: "Reviewer authorization required." },
        403,
        input.correlationId,
      ),
    };
  }
  return { isAdmin: true };
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
  const { error } = await input.supabase.from("audit_events").insert({
    user_id: input.request.requestedBy,
    actor_user_id: input.actorId,
    event_type: input.eventType,
    severity: input.severity ?? "info",
    project_id: input.request.projectId,
    payload: summary as unknown as Json,
  });
  if (error) console.warn("[writeback-review] audit write failed", safeErrorLog(error));
}

async function applyTransition(input: {
  supabase: SupabaseAuthedClient;
  userId: string;
  request: ProjectWritebackRequest;
  action: WritebackReviewAction;
  note?: string;
  correlationId: string;
}): Promise<TransitionResult> {
  const reviewerAction = input.action === "approve" || input.action === "reject";
  if (reviewerAction) {
    const admin = await requireAdmin({
      supabase: input.supabase,
      correlationId: input.correlationId,
    });

    if (admin.response) {
      // Not an admin. Check if they are the project owner.
      const { data: project } = await input.supabase
        .from("projects")
        .select("user_id")
        .eq("id", input.request.projectId)
        .single();

      if (!project || project.user_id !== input.userId) {
        return admin;
      }
    }
  } else if (input.request.requestedBy !== input.userId) {
    return { response: jsonResponse({ message: "Forbidden" }, 403, input.correlationId) };
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

  const newStatus = validateWritebackStatusTransition({
    action: input.action,
    actorRole: reviewerAction ? "reviewer" : "requester",
    fromStatus: input.request.status,
    reviewedAt: input.request.reviewedAt,
    blockerCount: input.request.blockers.length,
    reviewerNote: input.note,
  });

  const now = new Date().toISOString();
  const reviewSummary = buildWritebackReviewSummary({
    request: input.request,
    actorId: input.userId,
    action: input.action,
    newStatus,
  });
  const update =
    input.action === "submit"
      ? { status: newStatus, submitted_at: now }
      : input.action === "cancel"
        ? { status: newStatus }
        : {
            status: newStatus,
            reviewer_id: input.userId,
            reviewer_note: input.note?.trim() || null,
            reviewed_at: now,
            review_decision: newStatus === "approved" ? "approved" : "rejected",
            review_metadata: {
              ...reviewSummary,
              phase: "90",
              approval_applies_changes: false,
              source_writeback_available: false,
            } as unknown as Json,
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
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          const input = parseBody((await request.json().catch(() => ({}))) as Body);
          const current = await loadRequest({
            supabase: access.supabase,
            requestId: input.requestId,
          });
          if (!current) {
            return jsonResponse({ message: "Writeback request not found." }, 404, correlationId);
          }

          const result = await applyTransition({
            supabase: access.supabase,
            userId: access.userId,
            request: current,
            action: input.action,
            note: input.note,
            correlationId,
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
          const message = error instanceof Error ? error.message : "Writeback review failed.";
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
            console.error(
              "[writeback-review] action failed",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
          }

          return jsonResponse(
            {
              message: status === 500 ? "Writeback review failed." : message,
              error: error instanceof Error ? error.name : "Error",
              code: status.toString(),
              details: message,
              hint: status === 403 ? "You may need project owner or admin privileges." : undefined,
            },
            status,
            correlationId,
          );
        }
      },
    },
  },
});
