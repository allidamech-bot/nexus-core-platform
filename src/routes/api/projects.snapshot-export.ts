import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createSnapshotExportBundle,
  validateSnapshotExportAccessInput,
} from "@/features/projects/patchSnapshotExport";
import type {
  ProjectPatchSnapshot,
  ProjectPatchSnapshotFile,
} from "@/features/projects/patchSnapshot";
import type {
  GroundedPatchChange,
  GroundedPatchFile,
  GroundedPatchPreview,
  GroundedPatchPreviewStatus,
  PatchPreviewWarning,
} from "@/features/projects/patchPreviewTypes";
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

function asWarnings(value: Json): PatchPreviewWarning[] {
  return Array.isArray(value) ? (value as unknown as PatchPreviewWarning[]) : [];
}

function asGroundedFiles(value: Json): GroundedPatchFile[] {
  return Array.isArray(value) ? (value as unknown as GroundedPatchFile[]) : [];
}

function asChanges(value: Json): GroundedPatchChange[] {
  return Array.isArray(value) ? (value as unknown as GroundedPatchChange[]) : [];
}

function asSnapshotIssues(value: Json) {
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
    warnings: asSnapshotIssues(row.warnings),
    blockers: asSnapshotIssues(row.blockers),
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
    warnings: asSnapshotIssues(row.warnings),
    blockers: asSnapshotIssues(row.blockers),
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
      "[snapshot-export] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return { response: textResponse("Export unavailable", 503, correlationId) };
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

async function loadSnapshotExportData(input: {
  supabase: SupabaseAuthedClient;
  snapshotId: string;
}) {
  const { data: snapshotRow, error: snapshotError } = await input.supabase
    .from("project_patch_snapshots")
    .select("*")
    .eq("id", input.snapshotId)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshotRow) return null;

  const snapshot = toPatchSnapshot(snapshotRow);
  const { data: project, error: projectError } = await input.supabase
    .from("projects")
    .select("id")
    .eq("id", snapshot.projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const [{ data: fileRows, error: filesError }, { data: previewRow, error: previewError }] =
    await Promise.all([
      input.supabase
        .from("project_patch_snapshot_files")
        .select("*")
        .eq("snapshot_id", input.snapshotId)
        .order("file_path", { ascending: true })
        .limit(100),
      input.supabase
        .from("project_patch_previews")
        .select("*")
        .eq("id", snapshot.patchPreviewId)
        .maybeSingle(),
    ]);
  if (filesError) throw filesError;
  if (previewError) throw previewError;

  return {
    snapshot,
    files: (fileRows ?? []).map(toPatchSnapshotFile),
    patchPreview: previewRow ? toPatchPreview(previewRow) : null,
  };
}

export const Route = createFileRoute("/api/projects/snapshot-export")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          const snapshotId = validateSnapshotExportAccessInput({
            snapshotId: new URL(request.url).searchParams.get("snapshotId"),
            userId: access.userId,
          });
          const data = await loadSnapshotExportData({ supabase: access.supabase, snapshotId });
          if (!data) return textResponse("Snapshot not found", 404, correlationId);
          if (data.snapshot.createdBy !== access.userId) {
            return textResponse("Forbidden", 403, correlationId);
          }

          const bundle = createSnapshotExportBundle({
            snapshot: data.snapshot,
            snapshotFiles: data.files,
            patchPreview: data.patchPreview,
          });
          const body = JSON.stringify(bundle, null, 2);
          const filename = `nexus-core-snapshot-${snapshotId.slice(0, 8)}.json`;

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
          const message = error instanceof Error ? error.message : "Export failed";
          const status = message.includes("Unauthorized")
            ? 401
            : message.includes("required")
              ? 400
              : message.includes("limit exceeded") || message.includes("blocked")
                ? 422
                : 500;
          if (status === 500) {
            console.error(
              "[snapshot-export] export failed",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
          }
          return textResponse(status === 500 ? "Export failed" : message, status, correlationId);
        }
      },
    },
  },
});
