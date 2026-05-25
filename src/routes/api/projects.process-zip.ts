import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { processProjectArchive } from "@/features/projects/server/ingestionProcessor";
import { ZipRejectedError } from "@/features/projects/server/zipSafety";
import {
  getRequestCorrelationId,
  safeErrorLog,
  safeErrorMessage,
  withLogContext,
  type CorrelationContext,
} from "@/lib/safeLogging";

type Body = {
  projectId?: unknown;
};

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

function isExpectedSetupError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";
  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42883" ||
    maybeError.code === "PGRST202" ||
    message.includes("get_plan_limit") ||
    message.includes("get_usage_total") ||
    message.includes("usage_events") ||
    message.includes("audit_events") ||
    message.includes("project_text_previews") ||
    message.includes("project_files") ||
    message.includes("project_ingestion_jobs")
  );
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

async function createAuthenticatedClient(request: Request, context: CorrelationContext) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: textResponse("Unauthorized", 401) };

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error(
      "[project-ingestion] missing Supabase env",
      withLogContext(context, safeErrorLog(error)),
    );
    return {
      response: jsonResponse(
        {
          error: "supabase_env_missing",
          message: "Supabase environment variables are required before project ingestion can run.",
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
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return { response: textResponse("Unauthorized", 401) };
  }

  return { supabase, userId };
}

export const Route = createFileRoute("/api/projects/process-zip")({
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

        if (typeof body.projectId !== "string" || !body.projectId) {
          return textResponse("Project id required", 400);
        }

        const auth = await createAuthenticatedClient(request, context);
        if (auth.response) return auth.response;

        try {
          const result = await processProjectArchive({
            supabase: auth.supabase,
            userId: auth.userId,
            projectId: body.projectId,
            correlationId,
          });
          const metadata =
            result.job.metadata &&
            typeof result.job.metadata === "object" &&
            !Array.isArray(result.job.metadata)
              ? result.job.metadata
              : {};
          const textPreview =
            "text_preview" in metadata &&
            metadata.text_preview &&
            typeof metadata.text_preview === "object"
              ? (metadata.text_preview as { indexed_count?: number; indexed_bytes?: number })
              : {};

          const { error: usageError } = await auth.supabase.from("usage_events").insert([
            {
              user_id: auth.userId,
              project_id: body.projectId,
              event_type: "manifest_generated",
              quantity: result.fileCount,
              metadata: { correlationId, status: result.project.status },
            },
            {
              user_id: auth.userId,
              project_id: body.projectId,
              event_type: "preview_indexed",
              quantity: Number(textPreview.indexed_count ?? 0),
              size_bytes: Number(textPreview.indexed_bytes ?? 0),
              metadata: { correlationId },
            },
          ]);
          if (usageError) {
            console.warn(
              "[project-ingestion] usage metering skipped",
              withLogContext(context, safeErrorLog(usageError)),
            );
          }

          return Response.json(
            {
              projectId: result.project.id,
              jobId: result.job.id,
              status: result.project.status,
              ingestionStatus: result.job.status,
              fileCount: result.fileCount,
              summary: result.summary,
              manifest: result.manifest,
              message: result.summary.message,
              correlationId,
            },
            { headers: { "x-correlation-id": correlationId } },
          );
        } catch (error) {
          console.error(
            "[project-ingestion] processing failed",
            withLogContext(context, safeErrorLog(error)),
          );
          if (isExpectedSetupError(error)) {
            return jsonResponse(
              {
                error: "database_setup_missing",
                message:
                  "Required project ingestion or governance tables/RPCs are unavailable. Apply Phase 2A through Phase 2E migrations before ZIP processing can run.",
              },
              503,
              context,
            );
          }
          const message = safeErrorMessage(error, "Project manifest extraction failed.");
          const rejected = error instanceof ZipRejectedError;
          if (auth.supabase && auth.userId && typeof body.projectId === "string") {
            try {
              await auth.supabase.from("usage_events").insert({
                user_id: auth.userId,
                project_id: body.projectId,
                event_type: "ingestion_failed",
                metadata: { correlationId, message },
              });
            } catch {
              // Best-effort metering should not mask the ingestion error.
            }
          }
          return jsonResponse(
            {
              error: rejected ? "project_zip_rejected" : "project_ingestion_failed",
              message,
              summary: {
                status: rejected ? "rejected" : "failed",
                totalFilesSeen: 0,
                indexedFiles: 0,
                skippedFiles: 0,
                rejectedFiles: rejected ? 1 : 0,
                totalSafeTextBytes: 0,
                warnings: rejected ? [error.reason] : ["processing_failed"],
                message,
              },
            },
            422,
            context,
          );
        }
      },
    },
  },
});
