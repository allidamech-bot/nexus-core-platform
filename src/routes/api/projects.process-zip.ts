import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { processProjectArchive } from "@/features/projects/server/ingestionProcessor";

type Body = {
  projectId?: unknown;
};

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

async function createAuthenticatedClient(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: textResponse("Unauthorized", 401) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: textResponse("Unauthorized", 401) };

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
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return textResponse("Invalid JSON body", 400);
        }

        if (typeof body.projectId !== "string" || !body.projectId) {
          return textResponse("Project id required", 400);
        }

        const auth = await createAuthenticatedClient(request);
        if (auth.response) return auth.response;

        try {
          const result = await processProjectArchive({
            supabase: auth.supabase,
            userId: auth.userId,
            projectId: body.projectId,
          });

          return Response.json({
            projectId: result.project.id,
            jobId: result.job.id,
            status: result.project.status,
            ingestionStatus: result.job.status,
            fileCount: result.fileCount,
            manifest: result.manifest,
          });
        } catch (error) {
          console.error("[project-ingestion] processing failed", error);
          const message =
            error instanceof Error ? error.message : "Project manifest extraction failed.";
          return textResponse(message, 422);
        }
      },
    },
  },
});
