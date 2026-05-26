import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import {
  getRequestCorrelationId,
  safeErrorLog,
  withLogContext,
  type CorrelationContext,
} from "@/lib/safeLogging";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  buildAiPatchPrompt,
  enforceAiPatchInputLimits,
  parseAiPatchOutput,
  validateAiPatchOutput,
  type AiPatchPreviewTarget,
} from "@/features/projects/aiPatchPreview";
import {
  PatchPreviewValidationError,
  validatePatchPreviewTarget,
} from "@/features/projects/patchDiff";
import { isSensitivePreviewPath } from "@/features/projects/projectFileTree";
import type { ProjectFile, ProjectTextPreviewWithPath } from "@/features/projects/types";
import type { PatchPreviewWarning } from "@/features/projects/patchPreviewTypes";

type SupabaseAuthedClient = ReturnType<typeof createClient<Database>>;

interface Body {
  projectId?: unknown;
  fileIds?: unknown;
  instruction?: unknown;
  title?: unknown;
}

function textResponse(message: string, status: number) {
  return new Response(message, { status });
}

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  context?: CorrelationContext,
) {
  return Response.json(context ? { ...payload, correlationId: context.correlationId } : payload, {
    status,
    headers: context ? { "x-correlation-id": context.correlationId } : undefined,
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

function isExpectedGovernanceSetupError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";
  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42883" ||
    maybeError.code === "PGRST202" ||
    message.includes("get_effective_plan_id") ||
    message.includes("get_usage_total") ||
    message.includes("plan_usage_limits") ||
    message.includes("usage_events") ||
    message.includes("audit_events")
  );
}

function canDegradeGovernanceLocally() {
  return process.env.NODE_ENV !== "production";
}

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value ?? "").length / 4);
}

function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? "")).length;
}

async function requireProjectAccess(
  request: Request,
  projectId: unknown,
  context: CorrelationContext,
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: textResponse("Unauthorized", 401) };
  if (typeof projectId !== "string" || !projectId) {
    return { response: textResponse("Project id required", 400) };
  }

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[ai-patch-preview] missing Supabase env",
      withLogContext(context, safeErrorLog(error)),
    );
    return {
      response: jsonResponse(
        {
          error: "supabase_env_missing",
          message:
            "Supabase environment variables are required before AI patch preview generation can run.",
        },
        503,
        context,
      ),
    };
  }

  const supabase = createClient<Database>(env.url, env.key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,status")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    console.error(
      "[ai-patch-preview] project access check failed",
      withLogContext(context, safeErrorLog(projectError)),
    );
    return {
      response: jsonResponse(
        { error: "project_access_check_failed", message: "Unable to verify project access." },
        503,
        context,
      ),
    };
  }
  if (!project) return { response: textResponse("Forbidden", 403) };
  if (project.status === "archived") {
    return {
      response: jsonResponse(
        { error: "project_archived", message: "This project is archived." },
        409,
        context,
      ),
    };
  }

  return { supabase, userId: claimsData.claims.sub, projectId };
}

async function enforceAiPatchQuota(input: {
  supabase: SupabaseAuthedClient;
  userId: string;
  projectId: string;
  promptSizeBytes: number;
  selectedFileCount: number;
  correlationId: string;
}) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  let planId: string | null = "starter";
  let maxAiRequests: number | null | undefined = null;
  let aiUsed = 0;

  try {
    const planResult = await input.supabase.rpc("get_effective_plan_id", {
      check_user_id: input.userId,
    });
    if (planResult.error) throw planResult.error;
    planId = planResult.data ?? "starter";

    const limitsResult = await input.supabase
      .from("plan_usage_limits")
      .select("max_ai_requests_monthly")
      .eq("plan_id", planId)
      .maybeSingle();
    if (limitsResult.error) throw limitsResult.error;
    maxAiRequests = limitsResult.data?.max_ai_requests_monthly;

    const usageResult = await input.supabase.rpc("get_usage_total", {
      check_user_id: input.userId,
      metric_name: "ai_request",
      since_at: monthStart,
    });
    if (usageResult.error) throw usageResult.error;
    aiUsed = Number(usageResult.data ?? 0);
  } catch (error) {
    if (isExpectedGovernanceSetupError(error)) {
      console.warn("[ai-patch-preview] governance unavailable", {
        degraded: canDegradeGovernanceLocally(),
        correlationId: input.correlationId,
        ...safeErrorLog(error),
      });
      if (canDegradeGovernanceLocally()) return null;
      return jsonResponse(
        {
          error: "governance_unavailable",
          message:
            "Usage governance tables or RPCs are unavailable. Apply governance migrations before AI patch preview generation can run.",
        },
        503,
        { correlationId: input.correlationId },
      );
    }
    throw error;
  }

  if (
    maxAiRequests !== null &&
    maxAiRequests !== undefined &&
    Number(aiUsed ?? 0) + 1 > maxAiRequests
  ) {
    const { error } = await input.supabase.from("audit_events").insert({
      user_id: input.userId,
      actor_user_id: input.userId,
      project_id: input.projectId,
      event_type: "quota_hit_ai_request",
      severity: "warning",
      payload: {
        correlationId: input.correlationId,
        plan_id: planId ?? "starter",
        used: aiUsed,
        limit: maxAiRequests,
        source: "ai_patch_preview",
      },
    });
    if (error) {
      console.warn(
        "[ai-patch-preview] quota audit write failed",
        withLogContext({ correlationId: input.correlationId }, safeErrorLog(error)),
      );
    }
    return jsonResponse(
      {
        error: "quota_exceeded",
        message: "AI request quota exceeded. Upgrade required.",
      },
      402,
      { correlationId: input.correlationId },
    );
  }

  const { error: usageError } = await input.supabase.from("usage_events").insert({
    user_id: input.userId,
    project_id: input.projectId,
    event_type: "ai_request",
    quantity: 1,
    token_estimate: estimateTokens({
      promptSizeBytes: input.promptSizeBytes,
      selectedFileCount: input.selectedFileCount,
    }),
    size_bytes: input.promptSizeBytes,
    metadata: {
      correlationId: input.correlationId,
      source: "ai_patch_preview",
      plan_id: planId ?? "starter",
      selected_file_count: input.selectedFileCount,
    },
  });
  if (usageError) {
    if (isExpectedGovernanceSetupError(usageError) && canDegradeGovernanceLocally()) {
      console.warn(
        "[ai-patch-preview] usage metering skipped in local degraded mode",
        withLogContext({ correlationId: input.correlationId }, safeErrorLog(usageError)),
      );
      return null;
    }
    throw usageError;
  }

  return null;
}

function parseFileIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)),
  ).slice(0, 10);
}

function safeFailureWarning(error: unknown): PatchPreviewWarning {
  if (error instanceof PatchPreviewValidationError) {
    return { code: error.code, message: error.message };
  }
  return { code: "ai_patch_preview_failed", message: "AI patch preview failed." };
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

async function loadTargets(input: {
  supabase: SupabaseAuthedClient;
  projectId: string;
  fileIds: string[];
}): Promise<AiPatchPreviewTarget[]> {
  if (input.fileIds.length === 0) {
    throw new PatchPreviewValidationError(
      "Select at least one previewable file.",
      "no_previewable_files_selected",
    );
  }

  const { data: files, error: fileError } = await input.supabase
    .from("project_files")
    .select("*")
    .eq("project_id", input.projectId)
    .in("id", input.fileIds)
    .limit(10);
  if (fileError) throw fileError;

  const fileRows = (files ?? []) as ProjectFile[];
  const filesById = new Map(fileRows.map((file) => [file.id, file]));
  const orderedFiles = input.fileIds.flatMap((fileId) => {
    const file = filesById.get(fileId);
    return file ? [file] : [];
  });
  if (orderedFiles.length !== input.fileIds.length) {
    throw new PatchPreviewValidationError(
      "AI tried to modify an unavailable file.",
      "target_file_unavailable",
    );
  }
  if (orderedFiles.some((file) => isSensitivePreviewPath(file.path))) {
    throw new PatchPreviewValidationError("Sensitive files cannot be patched.", "sensitive_file");
  }

  const { data: previews, error: previewError } = await input.supabase
    .from("project_text_previews")
    .select("*")
    .eq("project_id", input.projectId)
    .in("file_id", input.fileIds)
    .limit(10);
  if (previewError) throw previewError;

  const previewsByFileId = new Map(
    ((previews ?? []) as ProjectTextPreviewWithPath[]).map((preview) => [preview.file_id, preview]),
  );

  return orderedFiles.map((file) => {
    const preview = previewsByFileId.get(file.id);
    const previewWithPath = preview ? { ...preview, path: file.path } : null;
    const validation = validatePatchPreviewTarget(file, previewWithPath);
    if (!validation.allowed || !previewWithPath) {
      throw new PatchPreviewValidationError(
        "This file cannot be patched.",
        validation.reason ?? "invalid_target",
      );
    }
    return { file, preview: previewWithPath };
  });
}

async function createRejectedPreview(input: {
  supabase: SupabaseAuthedClient;
  projectId: string;
  userId: string;
  title: string;
  warning: PatchPreviewWarning;
}) {
  const { data, error } = await input.supabase
    .from("project_patch_previews")
    .insert({
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title || "AI patch preview",
      status: "rejected",
      source: "ai_foundation",
      summary: input.warning.message,
      grounded_files: [],
      diff: [],
      warnings: [input.warning] as unknown as Json,
      metadata: { phase: "85", applied: false, ai_validated: false },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const Route = createFileRoute("/api/projects/ai-patch-preview")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        const context = { correlationId };

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return textResponse("Invalid JSON body", 400);
        }

        const access = await requireProjectAccess(request, body.projectId, context);
        if (access.response) return access.response;

        const projectId = access.projectId;
        const userId = access.userId;
        const instruction = typeof body.instruction === "string" ? body.instruction : "";
        const title =
          typeof body.title === "string" && body.title.trim()
            ? body.title.trim().slice(0, 160)
            : "AI patch preview";
        const fileIds = parseFileIds(body.fileIds);

        try {
          const [targets, jobId] = await Promise.all([
            loadTargets({ supabase: access.supabase, projectId, fileIds }),
            latestIngestionJobId(access.supabase, projectId),
          ]);
          enforceAiPatchInputLimits({ instruction, targets });
          const prompt = buildAiPatchPrompt({ projectId, instruction, targets });
          const quotaError = await enforceAiPatchQuota({
            supabase: access.supabase,
            userId,
            projectId,
            promptSizeBytes: byteSize(prompt),
            selectedFileCount: targets.length,
            correlationId,
          });
          if (quotaError) return quotaError;

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return jsonResponse(
              {
                error: "ai_gateway_env_missing",
                message: "LOVABLE_API_KEY is required before AI patch preview generation can run.",
              },
              503,
              context,
            );
          }

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const result = await generateText({
            model,
            system:
              "Return valid JSON only for a read-only patch preview. Do not claim any file was changed or applied.",
            prompt,
          });

          const output = parseAiPatchOutput(result.text);
          const validated = validateAiPatchOutput(output, targets);

          const { data, error } = await access.supabase
            .from("project_patch_previews")
            .insert({
              project_id: projectId,
              ingestion_job_id: jobId,
              created_by: userId,
              title,
              status: "ready",
              source: "ai_foundation",
              summary: validated.summary,
              grounded_files: validated.groundedFiles as unknown as Json,
              diff: validated.changes as unknown as Json,
              warnings: validated.warnings as unknown as Json,
              metadata: {
                phase: "85",
                applied: false,
                ai_validated: true,
                selected_file_count: targets.length,
                preview_limited: true,
                operation: "ai_text_replacement",
              },
            })
            .select()
            .single();
          if (error) throw error;

          return jsonResponse(
            {
              previewId: data.id,
              status: data.status,
              summary: validated.summary,
              groundedFiles: validated.groundedFiles,
              changes: validated.changes,
              warnings: validated.warnings,
            },
            200,
            context,
          );
        } catch (error) {
          const warning = safeFailureWarning(error);
          if (!(error instanceof PatchPreviewValidationError)) {
            console.error(
              "[ai-patch-preview] generation failed",
              withLogContext(context, safeErrorLog(error)),
            );
          }

          try {
            const rejected = await createRejectedPreview({
              supabase: access.supabase,
              projectId,
              userId,
              title,
              warning,
            });
            return jsonResponse(
              {
                previewId: rejected.id,
                status: "rejected",
                summary: warning.message,
                groundedFiles: [],
                changes: [],
                warnings: [warning],
              },
              error instanceof PatchPreviewValidationError ? 422 : 502,
              context,
            );
          } catch (insertError) {
            console.error(
              "[ai-patch-preview] rejected preview insert failed",
              withLogContext(context, safeErrorLog(insertError)),
            );
            return jsonResponse(
              {
                error: "ai_patch_preview_failed",
                message: "AI patch preview failed.",
              },
              502,
              context,
            );
          }
        }
      },
    },
  },
});
