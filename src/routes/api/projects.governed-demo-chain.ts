import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { buildPatchPreviewForTextReplacement } from "@/features/projects/patchDiff";
import { verifyPatchPreviewCanApply } from "@/features/projects/patchApplySandbox.server";
import { createPatchSnapshotFromSandbox } from "@/features/projects/patchSnapshot";
import { buildWritebackRequestRiskSummary } from "@/features/projects/writebackRisk";
import type {
  GroundedPatchChange,
  GroundedPatchFile,
  GroundedPatchPreview,
  PatchPreviewWarning,
  ProjectFile,
  ProjectTextPreviewWithPath,
} from "@/features/projects/types";
import type { PatchSandboxIssue } from "@/features/projects/patchSandboxTypes";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";

type SupabaseAuthedClient = ReturnType<typeof createClient<Database>>;

interface Body {
  projectId?: unknown;
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

function isGovernedDemoChainEnabled() {
  return process.env.PERSISTED_GOVERNED_E2E === "1";
}

async function requireAuthenticatedClient(request: Request, correlationId: string) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: jsonResponse({ message: "Unauthorized" }, 401, correlationId) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: jsonResponse({ message: "Unauthorized" }, 401, correlationId) };

  if (!isGovernedDemoChainEnabled()) {
    return { response: jsonResponse({ message: "Not Found" }, 404, correlationId) };
  }

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[governed-demo-chain] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return {
      response: jsonResponse({ message: "Governed fixture route unavailable" }, 503, correlationId),
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

function toGroundedPreview(row: {
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
    status: row.status as GroundedPatchPreview["status"],
    summary: row.summary,
    groundedFiles: Array.isArray(row.grounded_files)
      ? (row.grounded_files as unknown as GroundedPatchFile[])
      : [],
    changes: Array.isArray(row.diff) ? (row.diff as unknown as GroundedPatchChange[]) : [],
    warnings: Array.isArray(row.warnings) ? (row.warnings as unknown as PatchPreviewWarning[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadDemoTarget(input: { supabase: SupabaseAuthedClient; projectId: string }) {
  const { data: project, error: projectError } = await input.supabase
    .from("projects")
    .select("id,status")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("Project not found.");
  if (project.status === "archived") throw new Error("Project is archived.");

  const { data: file, error: fileError } = await input.supabase
    .from("project_files")
    .select("*")
    .eq("project_id", input.projectId)
    .eq("path", "src/App.tsx")
    .maybeSingle();
  if (fileError) throw fileError;
  if (!file) throw new Error("Demo target file not found.");

  const { data: preview, error: previewError } = await input.supabase
    .from("project_text_previews")
    .select("*")
    .eq("project_id", input.projectId)
    .eq("file_id", file.id)
    .maybeSingle();
  if (previewError) throw previewError;
  if (!preview) throw new Error("Demo target preview not found.");

  return {
    file: file as ProjectFile,
    preview: { ...(preview as ProjectTextPreviewWithPath), path: file.path },
  };
}

async function latestIngestionJobId(supabase: SupabaseAuthedClient, projectId: string) {
  const { data, error } = await supabase
    .from("project_ingestion_jobs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

export const Route = createFileRoute("/api/projects/governed-demo-chain")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);

        if (!isGovernedDemoChainEnabled()) {
          return jsonResponse({ message: "Not Found" }, 404, correlationId);
        }

        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          const body = (await request.json().catch(() => ({}))) as Body;
          if (typeof body.projectId !== "string" || !body.projectId) {
            return jsonResponse({ message: "Project id required." }, 400, correlationId);
          }

          const [{ file, preview }, jobId] = await Promise.all([
            loadDemoTarget({ supabase: access.supabase, projectId: body.projectId }),
            latestIngestionJobId(access.supabase, body.projectId),
          ]);

          const patch = buildPatchPreviewForTextReplacement({
            file,
            preview,
            oldText: "Hello Nexus Demo",
            newText: "Hello Nexus Governed Demo",
          });

          const { data: previewRow, error: previewInsertError } = await access.supabase
            .from("project_patch_previews")
            .insert({
              project_id: body.projectId,
              ingestion_job_id: jobId,
              created_by: access.userId,
              title: "H.2 governed deterministic preview",
              status: "ready",
              source: "manual_foundation",
              summary: "Deterministic read-only preview for persisted governed route validation.",
              grounded_files: [patch.groundedFile] as unknown as Json,
              diff: [patch.change] as unknown as Json,
              warnings: patch.warnings as unknown as Json,
              metadata: {
                phase: "H.2",
                deterministic_fixture: true,
                applied: false,
                preview_limited: true,
                operation: "text_replacement",
              } as unknown as Json,
            })
            .select()
            .single();
          if (previewInsertError) throw previewInsertError;

          const groundedPreview = toGroundedPreview(previewRow);
          const sandbox = verifyPatchPreviewCanApply({
            preview: groundedPreview,
            files: [file],
            textPreviews: [preview],
          });
          const builtSnapshot = await createPatchSnapshotFromSandbox({
            preview: groundedPreview,
            sandbox,
            userId: access.userId,
          });

          const { data: snapshotRow, error: snapshotInsertError } = await access.supabase
            .from("project_patch_snapshots")
            .insert(builtSnapshot.snapshot)
            .select()
            .single();
          if (snapshotInsertError) throw snapshotInsertError;

          const snapshotFileRows = builtSnapshot.files.map((snapshotFile) => ({
            ...snapshotFile,
            snapshot_id: snapshotRow.id,
          }));
          const { data: snapshotFiles, error: snapshotFilesInsertError } = await access.supabase
            .from("project_patch_snapshot_files")
            .insert(snapshotFileRows)
            .select();
          if (snapshotFilesInsertError) throw snapshotFilesInsertError;

          const snapshot = {
            id: snapshotRow.id,
            projectId: snapshotRow.project_id,
            patchPreviewId: snapshotRow.patch_preview_id,
            createdBy: snapshotRow.created_by,
            status: snapshotRow.status as "created" | "blocked" | "failed",
            title: snapshotRow.title,
            summary: snapshotRow.summary,
            source: "patch_preview_sandbox" as const,
            verificationStatus: snapshotRow.verification_status as "verified" | "partial",
            changedFilesCount: snapshotRow.changed_files_count,
            warnings: asIssues(snapshotRow.warnings),
            blockers: asIssues(snapshotRow.blockers),
            metadata: snapshotRow.metadata,
            createdAt: snapshotRow.created_at,
          };
          const files = (snapshotFiles ?? []).map((row) => ({
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
          }));
          const risk = buildWritebackRequestRiskSummary({ snapshot, files });

          const { data: requestRow, error: requestInsertError } = await access.supabase
            .from("project_writeback_requests")
            .insert({
              project_id: snapshot.projectId,
              patch_preview_id: snapshot.patchPreviewId,
              snapshot_id: snapshot.id,
              requested_by: access.userId,
              status: "draft",
              title: "H.2 governed deterministic writeback request",
              requester_note:
                "Deterministic fixture request for governed persisted route validation.",
              risk_level: risk.riskLevel,
              changed_files_count: risk.changedFilesCount,
              warnings: risk.warnings as unknown as Json,
              blockers: risk.blockers as unknown as Json,
              snapshot_summary: {
                snapshot_id: snapshot.id,
                patch_preview_id: snapshot.patchPreviewId,
                verification_status: snapshot.verificationStatus,
                changed_files_count: risk.changedFilesCount,
                warnings_count: risk.warnings.length,
                blockers_count: risk.blockers.length,
                derived_snapshot_only: true,
                original_project_files_modified: false,
                source_writeback: false,
              } as unknown as Json,
              metadata: {
                phase: "H.2",
                deterministic_fixture: true,
                governance_request_only: true,
                source_writeback_performed: false,
                original_project_files_modified: false,
                original_text_previews_modified: false,
              } as unknown as Json,
            })
            .select()
            .single();
          if (requestInsertError) throw requestInsertError;

          return jsonResponse(
            {
              projectId: body.projectId,
              previewId: previewRow.id,
              snapshotId: snapshotRow.id,
              requestId: requestRow.id,
              status: requestRow.status,
              routeArtifactMap: {
                "/api/projects/seed-demo": ["projects", "project_files", "project_text_previews"],
                "/api/projects/governed-demo-chain": [
                  "project_patch_previews",
                  "project_patch_snapshots",
                  "project_patch_snapshot_files",
                  "project_writeback_requests",
                ],
                "/api/projects/writeback-review": ["project_writeback_requests"],
                "/api/projects/writeback-execute": [
                  "project_working_copies",
                  "project_working_copy_files",
                ],
                "/api/projects/working-copy-export": [
                  "project_working_copies",
                  "project_working_copy_files",
                ],
              },
            },
            200,
            correlationId,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Governed fixture route failed.";
          const status = message.includes("Unauthorized")
            ? 401
            : message.includes("required") || message.includes("not found")
              ? 400
              : message.includes("blocked") ||
                  message.includes("Sensitive") ||
                  message.includes("cannot be patched")
                ? 422
                : 500;

          if (status === 500) {
            console.error(
              "[governed-demo-chain] failed",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
          }

          return jsonResponse({ message, error: message }, status, correlationId);
        }
      },
    },
  },
});
