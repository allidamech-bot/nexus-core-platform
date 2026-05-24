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
  ProjectContextFile,
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

Nexus Core is currently a truthful proposal experience. It can analyze, plan, inspect provided project context, and propose changes. It cannot execute code, mutate files, apply patches, run terminal commands, commit, push, open pull requests, deploy, or run a sandbox.

Every response for coding, product, debugging, or implementation tasks MUST be structured into the following markdown sections, in order, with bold section headers.

**Project Context Used**
Bulleted list of known project facts that informed the proposal. Separate confirmed context from assumptions. Say what context was unavailable.

**Implementation Plan**
A numbered list of concrete steps you would take. Keep it practical and scoped.

**Files Likely Affected**
Bulleted list of likely file paths, modules, or components with a short reason for each. If the exact path is unknown, say so and name the likely area.

**Patch Preview / Proposed Changes**
An illustrative, non-applied preview of the proposed edits. Use a fenced diff block when useful. Make clear the preview is a proposal, not an applied patch.

**Verification Checklist**
Bulleted list of checks to run later. Prefer project-specific commands when available. For this Nexus-style app, include pnpm run lint, pnpm exec tsc -p tsconfig.json --noEmit, pnpm build, and pnpm test:e2e when relevant. Mark them NOT RUN unless the user explicitly supplied verified results in the conversation.

**Risks / Notes**
Call out risk areas suggested by the actual project context, such as auth, RLS, admin isolation, i18n, RTL, archive lifecycle, quota/governance, migrations, protected routes, or production smoke risk.

**Limitations / Not Applied Yet**
State clearly that no code was executed, files were not modified, terminal commands were not run, patches were not applied, and deployment was not performed. Mention any context gaps.

For non-implementation questions, still use the closest helpful version of these sections unless it would be genuinely awkward; never claim execution. Tone: precise, senior-engineer, business-grade. Never refuse without giving a structured alternative. Never produce filler.`;
const MAX_CONTEXT_PREVIEWS = 6;
const MAX_CONTEXT_BYTES = 8_000;
const MAX_CONTEXT_FILES = 80;

function uniqueList(items: Array<string | null | undefined>, limit = 12) {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item)))).slice(0, limit);
}

function pathIncludes(path: string, needles: string[]) {
  const lower = path.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function priorityForFile(path: string) {
  const lower = path.toLowerCase();
  if (
    [
      "package.json",
      "vite.config",
      "tsconfig",
      "tanstack",
      "src/routes/api/chat",
      "src/routes/app.",
      "src/routes/app/",
      "src/features/projects",
      "src/features/i18n",
      "src/lib/auth",
      "src/routes/app.admin",
      "tests/e2e",
    ].some((needle) => lower.includes(needle))
  ) {
    return 0;
  }
  if (pathIncludes(lower, ["src/routes", "src/components", "src/features"])) return 1;
  if (pathIncludes(lower, ["supabase/migrations", "migrations"])) return 2;
  return 3;
}

function rankFiles(files: ProjectContextFile[]) {
  return [...files]
    .sort(
      (a, b) => priorityForFile(a.path) - priorityForFile(b.path) || a.path.localeCompare(b.path),
    )
    .slice(0, MAX_CONTEXT_FILES);
}

function topDirectories(files: ProjectContextFile[]) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const parts = file.path.split("/");
    for (let depth = 1; depth < Math.min(parts.length, 4); depth += 1) {
      const directory = parts.slice(0, depth).join("/");
      counts.set(directory, (counts.get(directory) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([path, count]) => `${path} (${count})`);
}

function knownRoutes(files: ProjectContextFile[]) {
  return uniqueList(
    files
      .map((file) => file.path)
      .filter(
        (path) => path.includes("src/routes/") || path.includes("app/") || path.includes("pages/"),
      )
      .slice(0, 30),
    16,
  );
}

function knownComponents(files: ProjectContextFile[]) {
  return uniqueList(
    files
      .map((file) => file.path)
      .filter(
        (path) => path.includes("src/components/") || /(^|\/)[A-Z][^/]+\.(tsx|jsx)$/.test(path),
      )
      .slice(0, 30),
    16,
  );
}

function inferRiskAreas(files: ProjectContextFile[]) {
  const paths = files.map((file) => file.path.toLowerCase());
  const risks: string[] = [];
  if (paths.some((path) => path.includes("auth") || path.includes("login")))
    risks.push("auth/session behavior");
  if (paths.some((path) => path.includes("admin"))) risks.push("admin isolation");
  if (
    paths.some(
      (path) => path.includes("supabase") || path.includes("rls") || path.includes("migration"),
    )
  )
    risks.push("Supabase/RLS and migration safety");
  if (paths.some((path) => path.includes("i18n") || path.includes("translation")))
    risks.push("i18n/RTL copy and layout");
  if (paths.some((path) => path.includes("quota") || path.includes("governance")))
    risks.push("quota/governance accounting");
  if (paths.some((path) => path.includes("thread") || path.includes("archive")))
    risks.push("thread archive/read-only lifecycle");
  if (paths.some((path) => path.includes("api/chat"))) risks.push("chat API and prompt behavior");
  if (paths.some((path) => path.includes("test") || path.includes("playwright")))
    risks.push("E2E protected-route coverage");
  return risks.length ? risks : ["No specific risk areas inferred from file inventory."];
}

function inferCommands(project: ProjectChatMetadata) {
  const text = (project.previews ?? [])
    .filter((preview) => preview.path.toLowerCase().endsWith("package.json"))
    .map((preview) => preview.preview_text)
    .join("\n");

  const commands = new Set<string>();
  if (project.manifest?.package_managers.includes("pnpm")) {
    commands.add("pnpm run lint");
    commands.add("pnpm exec tsc -p tsconfig.json --noEmit");
    commands.add("pnpm build");
    commands.add("pnpm test:e2e");
  }

  for (const match of text.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
    const [script, command] = [match[1], match[2]];
    if (!script || !command) continue;
    if (/^(lint|build|test|test:e2e|typecheck|verify)$/.test(script)) {
      commands.add(
        `${project.manifest?.package_managers.includes("pnpm") ? "pnpm" : "npm run"} ${script}`,
      );
    }
  }

  if (commands.size === 0) {
    commands.add("pnpm run lint");
    commands.add("pnpm exec tsc -p tsconfig.json --noEmit");
    commands.add("pnpm build");
    commands.add("pnpm test:e2e");
  }

  return Array.from(commands).slice(0, 8);
}

function buildProjectContextPrompt(project: ProjectChatMetadata | null) {
  if (!project?.name) {
    return `\n\nProject Context v1 status:
- No project is attached to this session.
- Proposal is based on general app/chat context only.
- Attach a project to improve file-specific recommendations.
- unavailableContext: project identity, indexed file inventory, manifest, safe text previews, raw repository access, secret files, terminal execution, file mutation, patch application, deployment.

When answering coding or project-change requests, include **Project Context Used** and explicitly state that no project is attached to this session. Separate known facts from assumptions and do not imply file-specific inspection beyond the context provided in this prompt.`;
  }

  const files = rankFiles(project.files ?? []);
  const previewBlocks = (project.previews ?? [])
    .slice(0, MAX_CONTEXT_PREVIEWS)
    .map((preview) => {
      const text = String(preview.preview_text ?? "").slice(0, 1_500);
      return `- ${String(preview.path ?? "unknown").slice(0, 220)} (${String(preview.summary ?? "preview").slice(0, 120)}):\n${text}`;
    })
    .join("\n\n");

  return `\n\nProject Context v1 available to this response:
- projectName: ${String(project.name).slice(0, 160)}
- projectId: ${String(project.id ?? "not provided").slice(0, 80)}
- source: ${String(project.source_type ?? "unknown").slice(0, 40)}
- status: ${String(project.status ?? "unknown").slice(0, 40)}
- ingestion_status: ${String(project.ingestion_status ?? "none").slice(0, 40)}
- description: ${String(project.description ?? "not provided").slice(0, 220)}
- ${manifestContextLine(project.manifest)}
- repositoryType/frameworks: ${project.manifest?.frameworks.join(", ") || "unknown"}
- packageManager: ${project.manifest?.package_managers.join(", ") || "unknown"}
- rootConfigFiles: ${project.manifest?.root_config_files.join(", ") || "none indexed"}
- likelyEntryPoints: ${project.manifest?.likely_entry_points.join(", ") || "none indexed"}
- importantDirectories: ${
    topDirectories(project.files ?? []).join("; ") ||
    project.manifest?.directories
      .map((dir) => `${dir.path} (${dir.file_count})`)
      .slice(0, 12)
      .join("; ") ||
    "not available"
  }
- knownRoutes: ${knownRoutes(files).join(", ") || "not available"}
- knownComponents: ${knownComponents(files).join(", ") || "not available"}
- importantFiles: ${
    files
      .map((file) => file.path)
      .slice(0, 30)
      .join(", ") || "not available"
  }
- buildAndTestCommands: ${inferCommands(project).join("; ")}
- inferredRiskAreas: ${inferRiskAreas(project.files ?? []).join("; ")}
- selectedSafePreviews: ${project.previews?.length ?? 0}
- unavailableContext: raw repository access, full file contents, secret files, node_modules, dist/build artifacts, lockfile contents unless safely previewed, terminal execution, file mutation, patch application, deployment.

Use this context before proposing changes. Prefer real paths from knownRoutes, knownComponents, importantFiles, rootConfigFiles, and preview paths. If exact files are missing, say "likely" or "needs inspection"; do not pretend to have read unavailable files.${previewBlocks ? `\n\nSelected safe preview snippets:\n${previewBlocks}\n` : ""}`;
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
    .select("id,name,description,source_type,status")
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

  const { data: fileRows, error: filesError } = await input.supabase
    .from("project_files")
    .select("id,path,name,extension,size_bytes,mime_type")
    .eq("project_id", project.id)
    .order("path", { ascending: true })
    .limit(250);
  if (filesError) throw filesError;

  const files = (fileRows ?? []).map((file) => ({
    path: file.path,
    name: file.name,
    extension: file.extension,
    size_bytes: file.size_bytes,
    mime_type: file.mime_type,
  }));

  const selectedPreviewIds = input.selectedPreviewIds;
  const previewQuery = input.supabase
    .from("project_text_previews")
    .select("id,file_id,preview_text,summary,detected_language,truncated,token_estimate")
    .eq("project_id", project.id);

  const { data: previewRows, error: previewError } =
    selectedPreviewIds.length > 0
      ? await previewQuery.in("id", selectedPreviewIds).limit(MAX_CONTEXT_PREVIEWS)
      : await previewQuery.order("indexed_at", { ascending: false }).limit(24);
  if (previewError) throw previewError;

  const previewFileIds = Array.from(new Set((previewRows ?? []).map((preview) => preview.file_id)));
  const previewPathRows =
    previewFileIds.length > 0
      ? (fileRows ?? []).filter((file) => previewFileIds.includes(file.id))
      : [];
  const pathByFileId = new Map(previewPathRows.map((file) => [file.id, file.path]));

  const rankedPreviewRows =
    selectedPreviewIds.length > 0
      ? (previewRows ?? [])
      : [...(previewRows ?? [])]
          .sort((a, b) => {
            const aPath = pathByFileId.get(a.file_id) ?? "";
            const bPath = pathByFileId.get(b.file_id) ?? "";
            return priorityForFile(aPath) - priorityForFile(bPath) || aPath.localeCompare(bPath);
          })
          .slice(0, MAX_CONTEXT_PREVIEWS);

  let usedBytes = 0;
  const previews = rankedPreviewRows.flatMap((preview) => {
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

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    source_type: project.source_type as ProjectSourceType,
    status: project.status as ProjectStatus,
    ingestion_status: (latestJob?.status as ProjectIngestionStatus | undefined) ?? "none",
    manifest,
    files,
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
          ? `${SYSTEM_PROMPT}\n\nActive agent mode: ${mode.toUpperCase()}. Bias the response toward this discipline.${buildProjectContextPrompt(project)}`
          : `${SYSTEM_PROMPT}${buildProjectContextPrompt(project)}`;

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
