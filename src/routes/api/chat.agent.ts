import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { runAgentSession } from "@/lib/agent-runtime";
import { classifyIntent } from "@/lib/agent-classifier";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";
import type { Database } from "@/integrations/supabase/types";

interface Body {
  projectId?: unknown;
  userInstruction?: unknown;
  maxContextBytes?: unknown;
  intent?: unknown;
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
      "[chat-agent] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return {
      response: jsonResponse({ message: "Agent chat unavailable" }, 503, correlationId),
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

export const Route = createFileRoute("/api/chat/agent")({
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
        const intent =
          typeof body.intent === "string"
            ? (body.intent as "greeting" | "general_chat" | "project_review" | "patch_request" | "bugfix" | "refactor" | "planning")
            : classifyIntent(userInstruction);

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
            "[chat-agent] project lookup failed",
            withLogContext({ correlationId }, safeErrorLog(projectError)),
          );
          return jsonResponse({ message: "Project not found" }, 404, correlationId);
        }
        if (!project) {
          return jsonResponse({ message: "Project not found" }, 404, correlationId);
        }

        const devMode = isDeveloperMode(request);

        try {
          const result = await runAgentSession(
            supabase,
            {
              projectId,
              userInstruction,
              maxContextBytes,
            },
            devMode,
          );

          const sanitized: Record<string, unknown> = {
            stage: result.stage,
            taskType: result.taskType,
            provider: devMode ? result.providerUsed : "nexus-core-ai",
            status: result.status,
            aiStatus: result.status === "success" ? "available" : "unavailable",
          };

          if (result.error) {
            sanitized.error = devMode
              ? result.error
              : { message: "Agent execution encountered an error." };
          }

          if (result.context) {
            sanitized.context = {
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
            sanitized.plan = {
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
            sanitized.proposedChanges = result.proposedChanges.map((c) => ({
              filePath: c.filePath,
              reason: c.reason,
              suggestedPatch: c.suggestedPatch,
              riskLevel: c.riskLevel,
            }));
          }

          if (result.validationPlan) {
            sanitized.validationPlan = {
              commands: result.validationPlan.commands,
              explanation: result.validationPlan.explanation,
            };
          }

          if (result.finalReport) {
            sanitized.finalReport = {
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
            sanitized.patchProposals = {
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

          if (result.executionTrace) {
            sanitized.executionTrace = result.executionTrace;
          }

          if (devMode) {
            sanitized.developerDiagnostics = {
              internalProvider: result.providerUsed,
              internalModel: result.modelUsed,
            };
          }

          if (result.naturalResponse) {
            sanitized.naturalResponse = result.naturalResponse;
          }

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
            "[chat-agent] session failed",
            withLogContext({ correlationId }, safeErrorLog(error)),
          );
          return jsonResponse(
            {
              message: "Agent chat session failed.",
              error: devMode ? safeErrorLog(error) : undefined,
            },
            502,
            correlationId,
          );
        }
      },
    },
  },
});
