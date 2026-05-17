import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectChatMetadata } from "@/features/projects/types";
import { manifestContextLine } from "@/features/projects/contextShaper";

type Body = {
  id?: unknown;
  messages?: unknown;
  mode?: string;
  project?: Partial<ProjectChatMetadata> | null;
};

const SYSTEM_PROMPT = `You are Nexus Core — an AI operating system for businesses and developers.

Every response MUST be structured into the following markdown sections, in order, with bold section headers. Skip a section only when it is genuinely not applicable.

**Understanding**
A 1–3 sentence restatement of the user's intent.

**Plan**
Numbered list of concrete steps you would take.

**Risks**
Bulleted list of potential risks, regressions, or things to watch. If none, say "No material risks detected."

**Files to inspect or change**
Bulleted list of file paths or module names.

**Proposed actions**
Specific commands, edits, or operations you would execute (in a fenced code block when useful).

**Execution log**
Mock or anticipated execution log lines, one per line in a fenced code block.

**Verification**
Bulleted list of checks: Typecheck, Lint, Build, Tests, Security Scan — with PASSED / WARNING / FAILED / NOT RUN labels.

**Final result**
A concise summary of the outcome and next recommended action.

Tone: precise, senior-engineer, business-grade. Never refuse without giving a structured alternative. Never produce filler.`;

function projectContextPrompt(project: Body["project"]) {
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

async function requireThreadAccess(request: Request, threadId: unknown) {
  if (typeof threadId !== "string" || !threadId) {
    return { response: textResponse("Thread id required", 400) };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const { url, key } = getSupabaseEnv();
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
    .select("id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    console.error("[chat] thread access check failed", threadError);
    return { response: textResponse("Unable to verify thread access", 500) };
  }

  if (!thread) {
    return { response: textResponse("Forbidden", 403) };
  }

  return { supabase, userId: claimsData.claims.sub };
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
  project: Body["project"];
}) {
  const selectedPreviews = input.project?.previews?.length ?? 0;
  const contextBytes = byteSize(input.project ?? {});
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: planId } = await input.supabase.rpc("get_effective_plan_id", {
    check_user_id: input.userId,
  });
  const { data: limits, error: limitsError } = await input.supabase
    .from("plan_usage_limits")
    .select("max_ai_requests_monthly,max_context_previews,max_context_payload_bytes")
    .eq("plan_id", planId ?? "starter")
    .maybeSingle();
  if (limitsError) throw limitsError;

  const { data: aiUsed } = await input.supabase.rpc("get_usage_total", {
    check_user_id: input.userId,
    metric_name: "ai_request",
    since_at: monthStart,
  });

  if (
    limits?.max_ai_requests_monthly !== null &&
    limits?.max_ai_requests_monthly !== undefined &&
    Number(aiUsed ?? 0) + 1 > limits.max_ai_requests_monthly
  ) {
    await input.supabase.from("audit_events").insert({
      user_id: input.userId,
      actor_user_id: input.userId,
      thread_id: input.threadId,
      event_type: "quota_hit_ai_request",
      severity: "warning",
      payload: {
        plan_id: planId ?? "starter",
        used: aiUsed,
        limit: limits.max_ai_requests_monthly,
      },
    });
    return textResponse("AI request quota exceeded. Upgrade required.", 402);
  }

  if (limits?.max_context_previews != null && selectedPreviews > limits.max_context_previews) {
    return textResponse("Selected preview quota exceeded.", 413);
  }

  if (
    limits?.max_context_payload_bytes != null &&
    contextBytes > limits.max_context_payload_bytes
  ) {
    return textResponse("Project context payload is too large for this plan.", 413);
  }

  await input.supabase.from("usage_events").insert([
    {
      user_id: input.userId,
      thread_id: input.threadId,
      event_type: "ai_request",
      quantity: 1,
      token_estimate: estimateTokens(input.messages),
      size_bytes: byteSize(input.messages),
      metadata: { selected_previews: selectedPreviews, plan_id: planId ?? "starter" },
    },
    {
      user_id: input.userId,
      thread_id: input.threadId,
      event_type: "ai_context_payload",
      quantity: selectedPreviews,
      token_estimate: estimateTokens(input.project ?? {}),
      size_bytes: contextBytes,
      metadata: { selected_previews: selectedPreviews },
    },
  ]);

  return null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return textResponse("Invalid JSON body", 400);
        }

        const { id, messages, mode, project } = body;
        if (!Array.isArray(messages)) {
          return textResponse("Messages required", 400);
        }

        const access = await requireThreadAccess(request, id);
        if (access.response) return access.response;

        const quotaError = await enforceChatQuota({
          supabase: access.supabase,
          userId: access.userId,
          threadId: id as string,
          messages,
          project,
        });
        if (quotaError) return quotaError;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return textResponse("Missing LOVABLE_API_KEY", 500);

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const system = mode
          ? `${SYSTEM_PROMPT}\n\nActive agent mode: ${mode.toUpperCase()}. Bias the response toward this discipline.${projectContextPrompt(project)}`
          : `${SYSTEM_PROMPT}${projectContextPrompt(project)}`;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
