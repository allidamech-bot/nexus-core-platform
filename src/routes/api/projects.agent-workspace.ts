import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { runAgentSession } from "@/lib/agent-runtime";
import type { Database } from "@/integrations/supabase/types";
import type { AgentSessionInput, AgentSessionResult } from "@/lib/agent-types";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";
import { getProviderRegistry } from "@/lib/provider-registry";

interface Body {
  projectId?: unknown;
  userInstruction?: unknown;
  maxContextBytes?: unknown;
}

function isDeveloperMode(request: Request): boolean {
  const devHeader = request.headers.get("x-developer-mode");
  return devHeader === "true" || process.env.NODE_ENV !== "production";
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
  if (!token) {
    return { response: jsonResponse({ message: "Unauthorized" }, 401, correlationId) };
  }
  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[agent-workspace] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return {
      response: jsonResponse({ message: "Agent workspace unavailable" }, 503, correlationId),
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

function sanitizeResult(result: AgentSessionResult, devMode: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    stage: result.stage,
    taskType: result.taskType,
    provider: devMode ? result.providerUsed : "nexus-core-ai",
    status: result.status,
  };

  if (result.error) {
    base.error = devMode ? result.error : { message: "Agent execution encountered an error." };
  }

  if (result.context) {
    base.context = {
      projectId: result.context.projectId,
      projectName: result.context.projectName,
      files: result.context.files.map((f) => ({
        path: f.path,
        name: f.name,
        extension: f.extension,
        sizeBytes: f.sizeBytes,
      })),
      previews: result.context.previews.map((p) => ({
        path: p.path,
        summary: p.summary,
        detectedLanguage: p.detectedLanguage,
        truncated: p.truncated,
      })),
      totalBytes: result.context.totalBytes,
      trimmed: result.context.trimmed,
    };
  }

  if (result.plan) {
    base.plan = {
      summary: result.plan.summary,
      steps: result.plan.steps.map((s) => ({
        order: s.order,
        description: s.description,
        targetFiles: s.targetFiles,
        estimatedComplexity: s.estimatedComplexity,
      })),
    };
  }

  if (result.proposedChanges) {
    base.proposedChanges = result.proposedChanges.map((c) => ({
      filePath: c.filePath,
      reason: c.reason,
      suggestedPatch: c.suggestedPatch,
      riskLevel: c.riskLevel,
    }));
  }

  if (result.validationPlan) {
    base.validationPlan = {
      commands: result.validationPlan.commands,
      explanation: result.validationPlan.explanation,
    };
  }

  if (result.finalReport) {
    base.finalReport = {
      summary: result.finalReport.summary,
      plan: result.finalReport.plan
        ? {
            summary: result.finalReport.plan.summary,
            steps: result.finalReport.plan.steps.map((s) => ({
              order: s.order,
              description: s.description,
              targetFiles: s.targetFiles,
              estimatedComplexity: s.estimatedComplexity,
            })),
          }
        : undefined,
      proposedChanges: result.finalReport.proposedChanges.map((c) => ({
        filePath: c.filePath,
        reason: c.reason,
        suggestedPatch: c.suggestedPatch,
        riskLevel: c.riskLevel,
      })),
      validationPlan: result.finalReport.validationPlan,
      risks: result.finalReport.risks,
    };
  }

  if (result.patchProposals) {
    base.patchProposals = {
      proposals: result.patchProposals.proposals.map((p) => ({
        proposal_id: p.proposal_id,
        target_file_path: p.target_file_path,
        change_summary: p.change_summary,
        risk_level: p.risk_level,
        change_type: p.change_type,
        before_preview: p.before_preview,
        after_preview: p.after_preview,
        unified_diff: p.unified_diff,
        approval_required: p.approval_required,
        approval_status: p.approval_status,
        blocked_reason: p.blocked_reason,
        risk_reasons: p.risk_reasons,
        validation_suggestions: p.validation_suggestions,
        agent_confidence: p.agent_confidence,
      })),
      summary: result.patchProposals.summary,
    };
  }

  if (devMode) {
    base.developerDiagnostics = {
      internalProvider: result.providerUsed,
      internalModel: result.modelUsed,
    };
  }

  return base;
}

export const Route = createFileRoute("/api/projects/agent-workspace")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        const authResult = await requireAuthenticatedClient(request, correlationId);
        if ("response" in authResult) {
          return authResult.response;
        }
        const { supabase, userId } = authResult;

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return jsonResponse({ message: "Invalid request body" }, 400, correlationId);
        }

        const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
        const userInstruction =
          typeof body.userInstruction === "string" ? body.userInstruction.trim() : "";
        const maxContextBytes =
          typeof body.maxContextBytes === "number" && Number.isFinite(body.maxContextBytes)
            ? body.maxContextBytes
            : undefined;

        if (!projectId) {
          return jsonResponse({ message: "projectId is required" }, 400, correlationId);
        }
        if (!userInstruction) {
          return jsonResponse({ message: "userInstruction is required" }, 400, correlationId);
        }

        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id,name,status")
          .eq("id", projectId)
          .maybeSingle();

        if (projectError) {
          console.error(
            "[agent-workspace] project lookup failed",
            withLogContext({ correlationId }, safeErrorLog(projectError)),
          );
          return jsonResponse({ message: "Project not found" }, 404, correlationId);
        }
        if (!project) {
          return jsonResponse({ message: "Project not found" }, 404, correlationId);
        }

        const devMode = isDeveloperMode(request);

        try {
          const result = await runAgentSession(supabase, {
            projectId,
            userInstruction,
            maxContextBytes,
          });

          const sanitized = sanitizeResult(result, devMode);
          return jsonResponse(
            {
              ...sanitized,
              projectId,
              projectName: project.name ?? undefined,
            },
            200,
            correlationId,
          );
        } catch (error) {
          console.error(
            "[agent-workspace] session failed",
            withLogContext({ correlationId }, safeErrorLog(error)),
          );
          return jsonResponse(
            {
              message: "Agent workspace session failed.",
              error: devMode ? safeErrorLog(error) : undefined,
            },
            502,
            correlationId,
          );
        }
      },
      GET: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        const devMode = isDeveloperMode(request);
        const providers = getProviderRegistry();
        const configuredProviders = providers.filter((p) => p.status === "configured");
        const hasConfiguredProvider = configuredProviders.length > 0;

        const baseResponse = {
          ready: hasConfiguredProvider,
          provider: "nexus-core-ai",
          status: hasConfiguredProvider ? "ready" : "blocked",
          code: hasConfiguredProvider ? null : "BLOCKED_AI_PROVIDER_REQUIRED",
          message: hasConfiguredProvider
            ? "Nexus Core AI is ready for agent workspace."
            : "AI provider configuration is required before agent workspace can run.",
          requiredEnv: hasConfiguredProvider
            ? []
            : ["GEMINI_API_KEY", "OPENROUTER_FREE_API_KEY", "GROQ_API_KEY", "OLLAMA_BASE_URL"],
        };

        if (!devMode) {
          return jsonResponse(baseResponse, 200, correlationId);
        }

        const missingProviders = providers.filter((p) => p.status === "missing_key");
        return jsonResponse(
          {
            ...baseResponse,
            _diagnostics: {
              totalProviders: providers.length,
              configuredCount: configuredProviders.length,
              missingKeyCount: missingProviders.length,
              providers: providers.map((p) => ({
                id: p.id,
                status: p.status,
                capabilities: p.capabilities,
                priority: p.priority,
                freeTier: p.freeTier,
              })),
            },
          },
          200,
          correlationId,
        );
      },
    },
  },
});
