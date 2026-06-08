import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";

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
      "[sandbox-jobs] missing Supabase env",
      withLogContext({ correlationId }, safeErrorLog(error)),
    );
    return { response: textResponse("Sandbox jobs unavailable", 503, correlationId) };
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

export const Route = createFileRoute("/api/projects/sandbox-jobs")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const access = await requireAuthenticatedClient(request, correlationId);
          if (access.response) return access.response;

          const url = new URL(request.url);
          const jobId = url.searchParams.get("jobId");

          if (!jobId) {
            return jsonErrorResponse(
              {
                error: "Job id required.",
                code: "400",
                details: "Provide a jobId in the query parameters.",
              },
              400,
              correlationId,
            );
          }

          const { data, error } = await (access.supabase as any)
            .from("sandbox_execution_jobs")
            .select("id, status, stdout, stderr, result, created_at, updated_at")
            .eq("id", jobId)
            .single();

          if (error || !data) {
            return jsonErrorResponse(
              { error: "Job not found", code: "404" },
              404,
              correlationId,
            );
          }

          return Response.json(data, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "x-correlation-id": correlationId,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Fetching job failed";
          const status = message.includes("Unauthorized") ? 401 : 500;
          return jsonErrorResponse(
            {
              error: status === 500 ? "Fetching job failed." : message,
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
