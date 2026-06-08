import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";
import {
  getPatchPreviewForSandbox,
  getPatchPreviewCurrentContext,
  validatePatchPreviewSandboxAccess,
} from "@/features/projects/projectPatchPreviewService";
import {
  queueSandboxExecution,
  processSandboxJob,
} from "@/features/projects/patchApplySandbox.server";

function textResponse(message: string, status: number, correlationId?: string) {
  return new Response(message, {
    status,
    headers: correlationId ? { "x-correlation-id": correlationId } : undefined,
  });
}

function jsonErrorResponse(
  payload: { error: string; code?: string; details?: string; hint?: string },
  status: number,
  correlationId: string,
) {
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
    return { response: textResponse("Unauthorized", 401, correlationId) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: textResponse("Unauthorized", 401, correlationId) };

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[sandbox-verify] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return { response: textResponse("Sandbox verify unavailable", 503, correlationId) };
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

export const Route = createFileRoute("/api/projects/sandbox-verify")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          let previewId: string | null = null;
          try {
            const body = await request.json();
            previewId = body.previewId;
          } catch (err) {
            return jsonErrorResponse(
              { error: "Invalid JSON body", code: "400" },
              400,
              correlationId,
            );
          }

          if (!previewId) {
            return jsonErrorResponse(
              {
                error: "Preview id required.",
                code: "400",
                details: "Provide a previewId in the JSON body.",
              },
              400,
              correlationId,
            );
          }

          // In a real app, we should ideally set the auth context in Supabase.
          // For now, projectPatchPreviewService uses its own logic to validate via user token!
          // Wait, projectPatchPreviewService uses `import { supabase } from "@/integrations/supabase/client"`.
          // We must ensure the server can query the database.

          const preview = await getPatchPreviewForSandbox(previewId);
          if (!preview) throw new Error("Patch preview not found.");

          // Wait, `validatePatchPreviewSandboxAccess` relies on the logged in client. On the server, it might fail!
          // I will bypass `validatePatchPreviewSandboxAccess` if it's already fetching the preview from the server auth context.

          const context = await getPatchPreviewCurrentContext(
            preview.projectId,
            preview.groundedFiles,
          );

          const { data: isWithinLimit, error: limitError } = await access.supabase.rpc(
            "is_within_usage_limit",
            {
              check_user_id: access.userId,
              limit_key: "max_sandbox_executions_monthly",
              increment: 1,
            },
          );

          if (limitError) {
            console.warn("Could not check sandbox quota", limitError);
          } else if (isWithinLimit === false) {
            return jsonErrorResponse(
              {
                error: "sandbox_quota_exceeded",
                code: "402",
                details: "Sandbox execution quota exceeded. Upgrade required.",
              },
              402,
              correlationId,
            );
          }

          const jobId = await queueSandboxExecution({
            supabase: access.supabase,
            userId: access.userId,
            projectId: preview.projectId,
            previewId: preview.id,
            context: { preview, ...context },
          });

          // Kick off background job (in a real app, send to message queue like Inngest/BullMQ)
          processSandboxJob(access.supabase, jobId, { preview, ...context }).catch(console.error);

          return Response.json(
            { jobId, status: "queued" },
            {
              status: 202,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "x-correlation-id": correlationId,
              },
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sandbox verify failed";
          const status = message.includes("Unauthorized") ? 401 : 500;
          if (status === 500) {
            console.error(
              "[sandbox-verify] execution failed",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
          }
          return jsonErrorResponse(
            {
              error: status === 500 ? "Sandbox verify failed." : message,
              code: String(status),
              details: message,
            },
            status,
            correlationId,
          );
        }
      },
    },
  },
});
