import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import {
  getRequestCorrelationId,
  safeErrorLog,
  withLogContext,
  type CorrelationContext,
} from "@/lib/safeLogging";
import type { Database } from "@/integrations/supabase/types";
import type {
  ProjectChatMetadata,
  ProjectIngestionStatus,
  ProjectManifest,
  ProjectSourceType,
  ProjectStatus,
} from "@/features/projects/types";
import { manifestContextLine } from "@/features/projects/contextShaper";

type Body = {
  id?: unknown;
  messages?: unknown;
  mode?: string;
  selectedPreviewIds?: unknown;
};

const SYSTEM_PROMPT = `You are Nexus Core - a project-aware AI planning workspace for businesses and developers.

Every response MUST be structured into the following markdown sections, in order, with bold section headers. Skip a section only when it is genuinely not applicable.

**Understanding**
A 1-3 sentence restatement of the user's intent.

**Plan**
Numbered list of concrete steps you would take.

**Risks**
Bulleted list of potential risks, regressions, or things to watch. If none, say "No material risks detected."

**Files to inspect or change**
Bulleted list of file paths or module names.

**Proposed actions**
Specific next steps, commands to run later, edits to consider, or operations that would require a future execution layer.

**Readiness log**
Anticipated planning, context, and verification-readiness notes, one per line in a fenced code block.

**Verification**
Bulleted list of recommended checks: Typecheck, Lint, Build, Tests, Security Scan - with PASSED / WARNING / FAILED / NOT RUN labels.

**Final result**
A concise summary of the outcome and next recommended action.

Tone: precise, senior-engineer, business-grade. Do not claim that Nexus Core executed code, modified files, installed dependencies, opened pull requests, or ran a sandbox. Never refuse without giving a structured alternative. Never produce filler.`;
const MAX_CONTEXT_PREVIEWS = 6;
const MAX_CONTEXT_BYTES = 8_000;

function projectContextPrompt(project: ProjectChatMetadata | null) {
  if (!project?.name) return "";
  const previews = (project.previews ?? [])
    .slice(0, 6)
    .map((preview) => {
      const text = String(preview.preview_text ?? "").slice(0, 1_500);
      return `- ${String(preview.path ?? "unknown").slice(0, 220)} (${String(preview.summary ?? "preview").slice(0, 120)}):\n${text}`;
    })
    .join("\n\n");

  return `\n\nActive project metadata:
- name: ${String(project.name).slice(0, 160)}
- source_type: ${String(project.source_type ?? "unknown").slice(0, 40)}
- project_status: ${String(project.status ?? "unknown").slice(0, 40)}
- ingestion_status: ${String(project.ingestion_status ?? "none").slice(0, 40)}
- ${manifestContextLine(project.manifest)}
- safe_text_previews: ${project.previews?.length ?? 0}
${previews ? `\nSelected safe preview snippets:\n${previews}\n` : ""}

Do not claim access to raw project files or entire repositories. Phase 2C provides only capped, redacted, allowlisted preview snippets and manifest metadata; execution, embeddings, deep indexing, and verification are not available.`;
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseSelectedPreviewIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)),
  ).slice(0, MAX_CONTEXT_PREVIEWS);
}

function parseManifest(value: unknown): ProjectManifest | null {
  const record = asRecord(value);
  if (record.version !== 1 || typeof record.file_count !== "number") return null;
  return record as unknown as ProjectManifest;
}

async function requireThreadAccess(
  request: Request,
  threadId: unknown,
  context: CorrelationContext,
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { response: textResponse("Unauthorized", 401) };
  }

  if (typeof threadId !== "string" || !threadId) {
    return { response: textResponse("Thread id required", 400) };
  }

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error("[chat] missing Supabase env", withLogContext(context, safeErrorLog(error)));
    return {
      response: jsonResponse(
        {
          error: "supabase_env_missing",
          message: "Supabase environment variables are required before authenticated chat can run.",
        },
        503,
        context,
      ),
    };
  }
  const { url, key } = env;
  const supabase = createClient<Database>(url, key, {
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

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("id,project_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    console.error(
      "[chat] thread access check failed",
      withLogContext(context, safeErrorLog(threadError)),
    );
    if (isExpectedGovernanceSetupError(threadError)) {
      return {
        response: jsonResponse(
          {
            error: "database_setup_missing",
            message:
              "Required database tables or RPCs are unavailable. Apply the Phase 1 through Phase 2E migrations before authenticated chat can run.",
          },
          503,
          context,
        ),
      };
    }
    return {
      response: jsonResponse(
        {
          error: "thread_access_check_failed",
          message: "Unable to verify thread access.",
        },
        503,
        context,
      ),
    };
  }

  if (!thread) {
    return { response: textResponse("Forbidden", 403) };
  }

  return { supabase, userId: claimsData.claims.sub, thread };
}

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value ?? "").length / 4);
}

function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? "")).length;
}

async function enforceChatQuota(input: {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
  threadId: string;
  messages: unknown[];
  project: ProjectChatMetadata | null;
  correlationId: string;
}) {
  const selectedPreviews = input.project?.previews?.length ?? 0;
  const contextBytes = byteSize(input.project ?? {});
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  let planId: string | null = "starter";
  let limits: {
    max_ai_requests_monthly: number | null;
    max_context_previews: number | null;
    max_context_payload_bytes: number | null;
  } | null = null;
  let aiUsed = 0;

  try {
    const planResult = await input.supabase.rpc("get_effective_plan_id", {
      check_user_id: input.userId,
    });
    if (planResult.error) throw planResult.error;
    planId = planResult.data ?? "starter";

    const limitsResult = await input.supabase
      .from("plan_usage_limits")
      .select("max_ai_requests_monthly,max_context_previews,max_context_payload_bytes")
      .eq("plan_id", planId)
      .maybeSingle();
    if (limitsResult.error) throw limitsResult.error;
    limits = limitsResult.data;

    const usageResult = await input.supabase.rpc("get_usage_total", {
      check_user_id: input.userId,
      metric_name: "ai_request",
      since_at: monthStart,
    });
    if (usageResult.error) throw usageResult.error;
    aiUsed = Number(usageResult.data ?? 0);
  } catch (error) {
    if (isExpectedGovernanceSetupError(error)) {
      console.warn("[chat] governance unavailable", {
        degraded: canDegradeGovernanceLocally(),
        correlationId: input.correlationId,
        ...safeErrorLog(error),
      });
      if (canDegradeGovernanceLocally()) return null;
      return jsonResponse(
        {
          error: "governance_unavailable",
          message:
            "Usage governance tables or RPCs are unavailable. Apply Phase 2E migrations before chat can run in production.",
        },
        503,
        { correlationId: input.correlationId },
      );
    }
    throw error;
  }

  if (
    limits?.max_ai_requests_monthly !== null &&
    limits?.max_ai_requests_monthly !== undefined &&
    Number(aiUsed ?? 0) + 1 > limits.max_ai_requests_monthly
  ) {
    const { error } = await input.supabase.from("audit_events").insert({
      user_id: input.userId,
      actor_user_id: input.userId,
      thread_id: input.threadId,
      event_type: "quota_hit_ai_request",
      severity: "warning",
      payload: {
        correlationId: input.correlationId,
        plan_id: planId ?? "starter",
        used: aiUsed,
        limit: limits.max_ai_requests_monthly,
      },
    });
    if (error)
      console.warn(
        "[chat] quota audit write failed",
        withLogContext({ correlationId: input.correlationId }, safeErrorLog(error)),
      );
    return jsonResponse(
      {
        error: "quota_exceeded",
        message: "AI request quota exceeded. Upgrade required.",
      },
      402,
      { correlationId: input.correlationId },
    );
  }

  if (limits?.max_context_previews != null && selectedPreviews > limits.max_context_previews) {
    return jsonResponse(
      {
        error: "context_preview_quota_exceeded",
        message: "Selected preview quota exceeded.",
      },
      413,
      { correlationId: input.correlationId },
    );
  }

  if (
    limits?.max_context_payload_bytes != null &&
    contextBytes > limits.max_context_payload_bytes
  ) {
    return jsonResponse(
      {
        error: "context_payload_too_large",
        message: "Project context payload is too large for this plan.",
      },
      413,
      { correlationId: input.correlationId },
    );
  }

  const { error: usageError } = await input.supabase.from("usage_events").insert([
    {
      user_id: input.userId,
      thread_id: input.threadId,
      event_type: "ai_request",
      quantity: 1,
      token_estimate: estimateTokens(input.messages),
      size_bytes: byteSize(input.messages),
      metadata: {
        correlationId: input.correlationId,
        selected_previews: selectedPreviews,
        plan_id: planId ?? "starter",
      },
    },
    {
      user_id: input.userId,
      thread_id: input.threadId,
      event_type: "ai_context_payload",
      quantity: selectedPreviews,
      token_estimate: estimateTokens(input.project ?? {}),
      size_bytes: contextBytes,
      metadata: { correlationId: input.correlationId, selected_previews: selectedPreviews },
    },
  ]);
  if (usageError) {
    if (isExpectedGovernanceSetupError(usageError) && canDegradeGovernanceLocally()) {
      console.warn(
        "[chat] usage metering skipped in local degraded mode",
        withLogContext({ correlationId: input.correlationId }, safeErrorLog(usageError)),
      );
      return null;
    }
    throw usageError;
  }

  const { error: auditError } = await input.supabase.from("audit_events").insert({
    user_id: input.userId,
    actor_user_id: input.userId,
    thread_id: input.threadId,
    event_type: "chat_request_started",
    severity: "info",
    payload: {
      correlationId: input.correlationId,
      selected_previews: selectedPreviews,
      plan_id: planId ?? "starter",
    },
  });
  if (auditError) {
    console.warn(
      "[chat] request audit write failed",
      withLogContext({ correlationId: input.correlationId }, safeErrorLog(auditError)),
    );
  }

  return null;
}

async function fetchTrustedProjectContext(input: {
  supabase: ReturnType<typeof createClient<Database>>;
  threadProjectId: string | null;
  selectedPreviewIds: string[];
}): Promise<ProjectChatMetadata | null> {
  if (!input.threadProjectId) return null;

  const { data: project, error: projectError } = await input.supabase
    .from("projects")
    .select("id,name,source_type,status")
    .eq("id", input.threadProjectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const { data: jobs, error: jobError } = await input.supabase
    .from("project_ingestion_jobs")
    .select("status,metadata")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (jobError) throw jobError;

  const latestJob = jobs?.[0] ?? null;
  const jobMetadata = asRecord(latestJob?.metadata);
  const manifest = parseManifest(jobMetadata.manifest);

  let previews: ProjectChatMetadata["previews"] = [];
  if (input.selectedPreviewIds.length > 0) {
    const { data: previewRows, error: previewError } = await input.supabase
      .from("project_text_previews")
      .select("id,file_id,preview_text,summary,detected_language,truncated,token_estimate")
      .eq("project_id", project.id)
      .in("id", input.selectedPreviewIds)
      .limit(MAX_CONTEXT_PREVIEWS);
    if (previewError) throw previewError;

    const fileIds = Array.from(new Set((previewRows ?? []).map((preview) => preview.file_id)));
    const { data: fileRows, error: fileError } =
      fileIds.length > 0
        ? await input.supabase.from("project_files").select("id,path").in("id", fileIds)
        : { data: [], error: null };
    if (fileError) throw fileError;

    const pathByFileId = new Map((fileRows ?? []).map((file) => [file.id, file.path]));
    let usedBytes = 0;
    previews = (previewRows ?? []).flatMap((preview) => {
      const remaining = MAX_CONTEXT_BYTES - usedBytes;
      if (remaining <= 0) return [];
      const previewText = String(preview.preview_text ?? "").slice(0, Math.min(1_500, remaining));
      usedBytes += new TextEncoder().encode(previewText).length;
      return [
        {
          path: pathByFileId.get(preview.file_id) ?? "unknown",
          summary: String(preview.summary ?? "Safe text preview"),
          detected_language: preview.detected_language,
          preview_text: previewText,
          truncated: Boolean(preview.truncated) || preview.preview_text.length > previewText.length,
          token_estimate: Math.ceil(previewText.length / 4),
        },
      ];
    });
  }

  return {
    name: project.name,
    source_type: project.source_type as ProjectSourceType,
    status: project.status as ProjectStatus,
    ingestion_status: (latestJob?.status as ProjectIngestionStatus | undefined) ?? "none",
    manifest,
    previews,
  };
}

export const Route = createFileRoute("/api/chat")({
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

        const { id, messages, mode } = body;
        if (!Array.isArray(messages)) {
          return textResponse("Messages required", 400);
        }

        const access = await requireThreadAccess(request, id, context);
        if (access.response) return access.response;

        let project: ProjectChatMetadata | null = null;
        try {
          project = await fetchTrustedProjectContext({
            supabase: access.supabase,
            threadProjectId:
              typeof access.thread?.project_id === "string" ? access.thread.project_id : null,
            selectedPreviewIds: parseSelectedPreviewIds(body.selectedPreviewIds),
          });
        } catch (error) {
          console.error(
            "[chat] trusted project context failed",
            withLogContext(context, safeErrorLog(error)),
          );
          return jsonResponse(
            {
              error: "project_context_unavailable",
              message: "Unable to load trusted project context for this session.",
            },
            503,
            context,
          );
        }

        try {
          const quotaError = await enforceChatQuota({
            supabase: access.supabase,
            userId: access.userId,
            threadId: id as string,
            messages,
            project,
            correlationId,
          });
          if (quotaError) return quotaError;
        } catch (error) {
          console.error(
            "[chat] quota enforcement failed",
            withLogContext(context, safeErrorLog(error)),
          );
          return jsonResponse(
            {
              error: "quota_enforcement_failed",
              message:
                "Unable to verify chat usage limits. Try again after governance setup is verified.",
            },
            503,
            context,
          );
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          console.error("[chat] missing LOVABLE_API_KEY", withLogContext(context));
          return jsonResponse(
            {
              error: "ai_gateway_env_missing",
              message: "LOVABLE_API_KEY is required before chat streaming can run.",
            },
            503,
            context,
          );
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const system = mode
          ? `${SYSTEM_PROMPT}\n\nActive agent mode: ${mode.toUpperCase()}. Bias the response toward this discipline.${projectContextPrompt(project)}`
          : `${SYSTEM_PROMPT}${projectContextPrompt(project)}`;

        let result: ReturnType<typeof streamText>;
        try {
          result = streamText({
            model,
            system,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });
        } catch (error) {
          console.error(
            "[chat] stream initialization failed",
            withLogContext(context, safeErrorLog(error)),
          );
          return jsonResponse(
            {
              error: "ai_stream_initialization_failed",
              message: "Unable to initialize the AI stream.",
            },
            502,
            context,
          );
        }

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
        response.headers.set("x-correlation-id", correlationId);
        return response;
      },
    },
  },
});
