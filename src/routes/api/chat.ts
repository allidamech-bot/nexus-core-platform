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

const SYSTEM_PROMPT = `You are Nexus Core - a powerful autonomous software engineering agent engine.

Nexus Core is a heavy-duty execution machine. You have the ability to run real terminal commands, install dependencies, mutate files, and build the project in a true sandbox execution loop.

When executing tasks:
- Think step-by-step and plan your execution.
- Utilize your ability to run arbitrary shell commands to compile, test, and debug.
- Provide real-time stdout and stderr feedback to the user.
- If a build fails, analyze the stack trace and auto-correct your patch in a self-healing loop.

For every response, ensure you adhere to the highest engineering standards. Maintain absolute strictness with TypeScript types, ESLint rules, and RLS security policies. Tone: precise, senior-engineer, business-grade. Never refuse without giving a structured alternative. Never produce filler.`;
const MAX_CONTEXT_PREVIEWS = 6;
const MAX_CONTEXT_BYTES = 8_000;
const MAX_CONTEXT_FILES = 80;
const MAX_CONTEXT_PAYLOAD_BYTES = 7_000;
const MAX_PREVIEW_CHARS = 1_000;

const DEFAULT_CONTEXT_KEYWORDS = [
  "header",
  "layout",
  "component",
  "route",
  "app",
  "i18n",
  "auth",
  "admin",
  "archive",
  "quota",
  "project",
  "chat",
];

function uniqueList(items: Array<string | null | undefined>, limit = 12) {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item)))).slice(0, limit);
}

function pathIncludes(path: string, needles: string[]) {
  const lower = path.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function priorityForFile(path: string, requestKeywords: string[] = []) {
  const lower = path.toLowerCase();
  if (requestKeywords.some((keyword) => lower.includes(keyword))) return -1;
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

function isSafeContextPath(path: string) {
  const lower = path.toLowerCase();
  if (
    lower.includes("node_modules/") ||
    lower.includes("/dist/") ||
    lower.includes("/build/") ||
    lower.includes(".env") ||
    lower.endsWith("package-lock.json") ||
    lower.endsWith("pnpm-lock.yaml") ||
    lower.endsWith("yarn.lock")
  ) {
    return false;
  }
  return true;
}

function requestKeywords(text: string) {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9_/.-]+/g)
    .filter((word) => word.length >= 3)
    .slice(0, 30);
  return uniqueList([...DEFAULT_CONTEXT_KEYWORDS, ...words], 40);
}

function rankFiles(files: ProjectContextFile[], keywords: string[] = []) {
  return files
    .filter((file) => isSafeContextPath(file.path))
    .filter(
      (file, index, array) =>
        array.findIndex((candidate) => candidate.path === file.path) === index,
    )
    .sort(
      (a, b) =>
        priorityForFile(a.path, keywords) - priorityForFile(b.path, keywords) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, MAX_CONTEXT_FILES);
}

function rankPreviewRows<T extends { file_id: string }>(
  previews: T[],
  pathByFileId: Map<string, string>,
  keywords: string[] = [],
) {
  return [...previews].sort((a, b) => {
    const aPath = pathByFileId.get(a.file_id) ?? "";
    const bPath = pathByFileId.get(b.file_id) ?? "";
    const aHasPath = aPath && aPath !== "unknown" ? 0 : 1;
    const bHasPath = bPath && bPath !== "unknown" ? 0 : 1;
    return (
      aHasPath - bHasPath ||
      priorityForFile(aPath, keywords) - priorityForFile(bPath, keywords) ||
      aPath.localeCompare(bPath)
    );
  });
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

function previewPaths(project: ProjectChatMetadata) {
  return uniqueList(
    (project.previews ?? [])
      .filter((preview) => String(preview.preview_text ?? "").trim().length > 0)
      .map((preview) => preview.path),
    12,
  );
}

function pathConfidenceReason(path: string, project: ProjectChatMetadata) {
  if (previewPaths(project).includes(path)) return "grounded";
  if ((project.files ?? []).some((file) => file.path === path)) return "inferred";
  return "illustrative";
}

function fileConfidenceHints(project: ProjectChatMetadata) {
  const previewBackedPaths = previewPaths(project);
  const inventoryPaths = (project.files ?? [])
    .map((file) => file.path)
    .filter((path) => !previewBackedPaths.includes(path))
    .slice(0, 16);
  const manifestPaths = [
    ...(project.manifest?.likely_entry_points ?? []),
    ...(project.manifest?.root_config_files ?? []),
  ].filter((path) => !previewBackedPaths.includes(path) && !inventoryPaths.includes(path));

  const paths = uniqueList([...previewBackedPaths, ...inventoryPaths, ...manifestPaths], 24);

  return paths.map((path) => {
    const confidence = pathConfidenceReason(path, project);
    const reason =
      confidence === "grounded"
        ? "preview included"
        : confidence === "inferred"
          ? "path-only inventory or manifest hint"
          : "conceptual fallback";
    return `${path} (${confidence}; ${reason})`;
  });
}

function compactManifest(manifest: ProjectManifest | null | undefined): ProjectManifest | null {
  if (!manifest) return null;
  return {
    ...manifest,
    languages: manifest.languages.slice(0, 12),
    frameworks: manifest.frameworks.slice(0, 12),
    package_managers: manifest.package_managers.slice(0, 8),
    root_config_files: manifest.root_config_files.slice(0, 16),
    likely_entry_points: manifest.likely_entry_points.slice(0, 16),
    directories: manifest.directories.slice(0, 16),
    stack_hints: manifest.stack_hints.slice(0, 16),
    skipped_reasons: Object.fromEntries(Object.entries(manifest.skipped_reasons).slice(0, 8)),
  };
}

function budgetPreviews(
  previews: ProjectChatMetadata["previews"] = [],
  keywords: string[],
  maxPreviews: number,
  maxPreviewChars: number,
) {
  const ranked = [...previews]
    .filter((preview) => isSafeContextPath(preview.path))
    .sort(
      (a, b) =>
        priorityForFile(a.path, keywords) - priorityForFile(b.path, keywords) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, maxPreviews);

  return ranked.map((preview) => {
    const previewText = String(preview.preview_text ?? "").slice(0, maxPreviewChars);
    return {
      ...preview,
      summary: String(preview.summary ?? "Safe text preview").slice(0, 180),
      preview_text: previewText,
      truncated: preview.truncated || preview.preview_text.length > previewText.length,
      token_estimate: Math.ceil(previewText.length / 4),
    };
  });
}

function withBudgetMetadata(
  project: ProjectChatMetadata,
  source: ProjectChatMetadata,
): ProjectChatMetadata {
  return {
    ...project,
    context_budget: {
      contextWasTrimmed:
        (source.files?.length ?? 0) > (project.files?.length ?? 0) ||
        (source.previews?.length ?? 0) > (project.previews?.length ?? 0) ||
        byteSize(source.manifest ?? null) > byteSize(project.manifest ?? null),
      includedFileCount: project.files?.length ?? 0,
      omittedFileCount: Math.max(0, (source.files?.length ?? 0) - (project.files?.length ?? 0)),
      includedPreviewCount: project.previews?.length ?? 0,
      omittedPreviewCount: Math.max(
        0,
        (source.previews?.length ?? 0) - (project.previews?.length ?? 0),
      ),
      approximateContextChars: JSON.stringify(project).length,
    },
  };
}

function budgetProjectContext(
  project: ProjectChatMetadata | null,
  requestText: string,
): ProjectChatMetadata | null {
  if (!project) return null;
  const keywords = requestKeywords(requestText);
  const rankedFiles = rankFiles(project.files ?? [], keywords);
  const stages = [
    { files: 80, previews: 6, previewChars: MAX_PREVIEW_CHARS, manifest: true },
    { files: 60, previews: 5, previewChars: 800, manifest: true },
    { files: 40, previews: 4, previewChars: 600, manifest: true },
    { files: 25, previews: 3, previewChars: 450, manifest: true },
    { files: 16, previews: 2, previewChars: 320, manifest: false },
  ];

  let best: ProjectChatMetadata | null = null;
  for (const stage of stages) {
    const candidate: ProjectChatMetadata = {
      ...project,
      description: project.description ? project.description.slice(0, 220) : project.description,
      manifest: stage.manifest ? compactManifest(project.manifest) : null,
      files: rankedFiles.slice(0, stage.files),
      previews: budgetPreviews(project.previews, keywords, stage.previews, stage.previewChars),
    };
    best = withBudgetMetadata(candidate, project);
    if (byteSize(best) <= MAX_CONTEXT_PAYLOAD_BYTES) return best;
  }

  const identityOnly = withBudgetMetadata(
    {
      ...project,
      description: project.description ? project.description.slice(0, 160) : project.description,
      manifest: null,
      files: [],
      previews: [],
    },
    project,
  );

  return byteSize(identityOnly) <= MAX_CONTEXT_PAYLOAD_BYTES ? identityOnly : best;
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

  const files = project.files ?? [];
  const budget = project.context_budget;
  const safePreviewStatus =
    (project.previews?.length ?? 0) > 0
      ? "safePreviewStatus: safe preview snippets are included for the files listed in filesWithSafePreviews."
      : "safePreviewStatus: no safe preview snippets are included in this prompt. File inventory or manifest context may still be available, but Patch Preview confidence must be inferred or illustrative. For grounded confidence, upload or reprocess a ZIP project that has safe previews.";
  const lifecycleStatus =
    project.status === "archived"
      ? "projectLifecycle: archived; this project is preserved for existing session context and should be treated as read-only historical context, not an active project for new work."
      : "projectLifecycle: active; this project may be used for current planning context.";
  const trimmedLine = budget?.contextWasTrimmed
    ? `contextWasTrimmed: true; Project context was trimmed to fit the safe prompt budget. The proposal is based on the included indexed context. Some files may require manual inspection before implementation.
- includedFileCount: ${budget.includedFileCount}; omittedFileCount: ${budget.omittedFileCount}; includedPreviewCount: ${budget.includedPreviewCount}; omittedPreviewCount: ${budget.omittedPreviewCount}; approximateContextChars: ${budget.approximateContextChars}`
    : "contextWasTrimmed: false";
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
- ${lifecycleStatus}
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
- filesWithSafePreviews: ${previewPaths(project).join(", ") || "none included"}
- ${safePreviewStatus}
- patchPreviewFileConfidenceHints: ${fileConfidenceHints(project).join("; ") || "not available"}
- buildAndTestCommands: ${inferCommands(project).join("; ")}
- inferredRiskAreas: ${inferRiskAreas(project.files ?? []).join("; ")}
- selectedSafePreviews: ${project.previews?.length ?? 0}
- ${trimmedLine}
- unavailableContext: raw repository access, full file contents, secret files, node_modules, dist/build artifacts, lockfile contents unless safely previewed, terminal execution, file mutation, patch application, deployment.

Use this context before proposing changes. Prefer real paths from knownRoutes, knownComponents, importantFiles, rootConfigFiles, and preview paths. If exact files are missing, say "likely" or "needs inspection"; do not pretend to have read unavailable files.

For **Patch Preview / Proposed Changes**, make the preview file-aware:
- Create one subsection per proposed file using "### path/to/file".
- Prefer relevant files listed in filesWithSafePreviews before path-only files. For header/layout requests, first look for preview-backed paths containing app, layout, header, navigation, route, component, css, tailwind, or i18n.
- Add "Context confidence: grounded" only for files listed in filesWithSafePreviews or backed by selected safe preview snippets for that exact file. Grounded means you saw a content excerpt, not just a path.
- Add "Context confidence: inferred" for files known only from file inventory, manifest, routes, components, or entry points.
- Add "Context confidence: illustrative" when the exact file path or current contents are not available.
- Do not label a file grounded only because its path exists, route name is known, or component name is known.
- If no preview-backed file is relevant, use inferred files and explicitly say the current contents were not included.
- If filesWithSafePreviews is "none included", explicitly say safe preview snippets are not available, file inventory may be available, and grounded Patch Preview confidence is not available for this response.
- Use approximate deletions only when current contents were not included; label them approximate in prose.

If contextWasTrimmed is true, include these exact sentences in **Project Context Used** or **Limitations / Not Applied Yet**:
"Project context was trimmed to fit the safe prompt budget."
"Some files may require manual inspection before implementation."
Also note that the proposal is based on included indexed context only.${previewBlocks ? `\n\nSelected safe preview snippets:\n${previewBlocks}\n` : ""}`;
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

function textFromMessage(message: unknown) {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  if (typeof record.content === "string") return record.content;
  if (!Array.isArray(record.parts)) return "";
  return record.parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const partRecord = part as Record<string, unknown>;
      return typeof partRecord.text === "string" ? partRecord.text : "";
    })
    .join("\n");
}

function latestUserRequest(messages: unknown[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") continue;
    const role = (message as Record<string, unknown>).role;
    if (role === "user") return textFromMessage(message);
  }
  return "";
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
  requestText: string;
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
  const keywords = requestKeywords(input.requestText);
  const rankedFileRows = [...(fileRows ?? [])].sort(
    (a, b) =>
      priorityForFile(a.path, keywords) - priorityForFile(b.path, keywords) ||
      a.path.localeCompare(b.path),
  );
  const priorityFileIds = rankedFileRows.slice(0, 80).map((file) => file.id);
  const previewQuery = input.supabase
    .from("project_text_previews")
    .select("id,file_id,preview_text,summary,detected_language,truncated,token_estimate")
    .eq("project_id", project.id);

  const { data: preferredPreviewRows, error: previewError } = selectedPreviewIds.length
    ? await previewQuery.in("id", selectedPreviewIds).limit(MAX_CONTEXT_PREVIEWS)
    : priorityFileIds.length
      ? await previewQuery.in("file_id", priorityFileIds).limit(48)
      : await previewQuery.order("indexed_at", { ascending: false }).limit(24);
  if (previewError) throw previewError;
  let previewRows = preferredPreviewRows ?? [];
  if (!selectedPreviewIds.length && previewRows.length === 0) {
    const { data: fallbackPreviewRows, error: fallbackPreviewError } = await input.supabase
      .from("project_text_previews")
      .select("id,file_id,preview_text,summary,detected_language,truncated,token_estimate")
      .eq("project_id", project.id)
      .order("indexed_at", { ascending: false })
      .limit(24);
    if (fallbackPreviewError) throw fallbackPreviewError;
    previewRows = fallbackPreviewRows ?? [];
  }

  const previewFileIds = Array.from(new Set(previewRows.map((preview) => preview.file_id)));
  const previewPathRows =
    previewFileIds.length > 0
      ? (fileRows ?? []).filter((file) => previewFileIds.includes(file.id))
      : [];
  const pathByFileId = new Map(previewPathRows.map((file) => [file.id, file.path]));

  const rankedPreviewRows =
    selectedPreviewIds.length > 0
      ? previewRows
      : rankPreviewRows(previewRows, pathByFileId, keywords).slice(0, MAX_CONTEXT_PREVIEWS);

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

  return budgetProjectContext(
    {
      id: project.id,
      name: project.name,
      description: project.description,
      source_type: project.source_type as ProjectSourceType,
      status: project.status as ProjectStatus,
      ingestion_status: (latestJob?.status as ProjectIngestionStatus | undefined) ?? "none",
      manifest,
      files,
      previews,
    },
    input.requestText,
  );
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
        const requestText = latestUserRequest(messages);
        try {
          project = await fetchTrustedProjectContext({
            supabase: access.supabase,
            threadProjectId:
              typeof access.thread?.project_id === "string" ? access.thread.project_id : null,
            selectedPreviewIds: parseSelectedPreviewIds(body.selectedPreviewIds),
            requestText,
          });
        } catch (error) {
          console.warn(
            "[chat] trusted project context failed",
            withLogContext(context, safeErrorLog(error)),
          );
          project = null;
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

        // @ts-expect-error - dynamic provider query
        const { data: dbKeyData } = await (access.supabase as any)
          .from("ai_provider_keys")
          .select("api_key, base_url, provider_type")
          .eq("user_id", access.userId)
          .maybeSingle();

        let model;
        if (dbKeyData?.api_key) {
          const { createDynamicProvider } = await import("@/lib/ai-gateway");
          const dynamicGateway = createDynamicProvider(
            dbKeyData.api_key,
            dbKeyData.base_url || undefined,
          );
          model = dynamicGateway(dbKeyData.provider_type === "ollama" ? "llama3" : "gpt-4o");
        } else {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            console.error(
              "[chat] missing LOVABLE_API_KEY and no dynamic key found",
              withLogContext(context),
            );
            return jsonResponse(
              {
                error: "ai_gateway_env_missing",
                message: "A provider key is required before chat streaming can run.",
              },
              503,
              context,
            );
          }
          const gateway = createLovableAiGatewayProvider(key);
          model = gateway("google/gemini-3-flash-preview");
        }

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
