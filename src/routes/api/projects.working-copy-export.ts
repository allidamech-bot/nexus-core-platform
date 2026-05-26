import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PatchSandboxIssue } from "@/features/projects/patchApplySandbox";
import {
  createWorkingCopyExportBundle,
  type WorkingCopyExportBundle,
} from "@/features/projects/workingCopyExport";
import type {
  ProjectWorkingCopy,
  ProjectWorkingCopyFile,
} from "@/features/projects/projectWorkingCopyService";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";

type SupabaseAuthedClient = ReturnType<typeof createClient<Database>>;

function textResponse(message: string, status: number, correlationId?: string) {
  return new Response(message, {
    status,
    headers: correlationId ? { "x-correlation-id": correlationId } : undefined,
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

function asIssues(value: Json): PatchSandboxIssue[] {
  return Array.isArray(value) ? (value as unknown as PatchSandboxIssue[]) : [];
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

function toWorkingCopyFile(
  row: Database["public"]["Tables"]["project_working_copy_files"]["Row"],
): ProjectWorkingCopyFile {
  return {
    id: row.id,
    workingCopyId: row.working_copy_id,
    projectId: row.project_id,
    writebackRequestId: row.writeback_request_id,
    patchSnapshotId: row.patch_snapshot_id,
    filePath: row.file_path,
    contentSha256: row.content_sha256,
    contentText: row.content_text,
    sizeBytes: row.size_bytes,
    changed: row.changed,
    previewLimited: row.preview_limited,
    truncated: row.truncated,
    warnings: asIssues(row.warnings),
    blockers: asIssues(row.blockers),
    createdAt: row.created_at,
  };
}

async function requireAuthenticatedClient(request: Request, correlationId: string) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: textResponse("Unauthorized", 401, correlationId) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: textResponse("Unauthorized", 401, correlationId) };

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[working-copy-export] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return { response: textResponse("Working copy export unavailable", 503, correlationId) };
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
    return { response: textResponse("Unauthorized", 401, correlationId) };
  }

  return { supabase, userId: claimsData.claims.sub };
}

async function isAdmin(supabase: SupabaseAuthedClient) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return Boolean(data);
}

async function loadWorkingCopyExportData(input: {
  supabase: SupabaseAuthedClient;
  workingCopyId: string;
}) {
  const { data: workingCopyRow, error: workingCopyError } = await input.supabase
    .from("project_working_copies")
    .select("*")
    .eq("id", input.workingCopyId)
    .maybeSingle();
  if (workingCopyError) throw workingCopyError;
  if (!workingCopyRow) return null;

  const workingCopy = toWorkingCopy(workingCopyRow);
  const [{ data: project, error: projectError }, { data: fileRows, error: filesError }] =
    await Promise.all([
      input.supabase
        .from("projects")
        .select("id,user_id")
        .eq("id", workingCopy.projectId)
        .maybeSingle(),
      input.supabase
        .from("project_working_copy_files")
        .select("*")
        .eq("working_copy_id", workingCopy.id)
        .order("file_path", { ascending: true })
        .limit(151),
    ]);
  if (projectError) throw projectError;
  if (filesError) throw filesError;
  if (!project) return null;

  const { data: requestRow, error: requestError } = await input.supabase
    .from("project_writeback_requests")
    .select("id,status,reviewed_at,reviewer_id,requester_note,reviewer_note")
    .eq("id", workingCopy.writebackRequestId)
    .maybeSingle();
  if (requestError) throw requestError;

  return {
    project,
    workingCopy,
    files: (fileRows ?? []).map(toWorkingCopyFile),
    request: requestRow
      ? {
          id: requestRow.id,
          status: requestRow.status,
          reviewedAt: requestRow.reviewed_at,
          reviewerId: requestRow.reviewer_id,
          requesterNote: requestRow.requester_note,
          reviewerNote: requestRow.reviewer_note,
        }
      : null,
  };
}

export const Route = createFileRoute("/api/projects/working-copy-export")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          const workingCopyId = new URL(request.url).searchParams.get("workingCopyId");
          if (!workingCopyId) return textResponse("Working copy id required", 400, correlationId);

          const data = await loadWorkingCopyExportData({
            supabase: access.supabase,
            workingCopyId,
          });
          if (!data) return textResponse("Working copy not found", 404, correlationId);

          const admin = await isAdmin(access.supabase);
          if (!admin && data.project.user_id !== access.userId) {
            return textResponse("Forbidden", 403, correlationId);
          }

          const bundle: WorkingCopyExportBundle = createWorkingCopyExportBundle({
            workingCopy: data.workingCopy,
            workingCopyFiles: data.files,
            request: data.request,
          });
          const body = JSON.stringify(bundle, null, 2);
          const filename = `nexus-core-working-copy-${workingCopyId.slice(0, 8)}.json`;

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store",
              "x-correlation-id": correlationId,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Working copy export failed";
          const status = message.includes("Unauthorized")
            ? 401
            : message.includes("required")
              ? 400
              : message.includes("limit exceeded") ||
                  message.includes("blocked") ||
                  message.includes("Sensitive")
                ? 422
                : 500;
          if (status === 500) {
            console.error(
              "[working-copy-export] export failed",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
          }
          return textResponse(
            status === 500 ? "Working copy export failed" : message,
            status,
            correlationId,
          );
        }
      },
    },
  },
});
