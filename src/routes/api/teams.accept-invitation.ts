import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getRequestCorrelationId, withLogContext, safeErrorLog } from "@/lib/safeLogging";
import type { Database } from "@/integrations/supabase/types";

function jsonResponse(payload: Record<string, unknown>, status: number, correlationId: string) {
  return Response.json(
    { ...payload, correlationId },
    {
      status,
      headers: { "x-correlation-id": correlationId },
    },
  );
}

function getSupabaseEnv(): {
  url: string;
  serviceRoleKey: string;
  publishableKey: string;
} {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  const missing = [
    ...(!url ? ["SUPABASE_URL or VITE_SUPABASE_URL"] : []),
    ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ...(!publishableKey
      ? [
          "SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY",
        ]
      : []),
  ];

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return {
    url: url as string,
    serviceRoleKey: serviceRoleKey as string,
    publishableKey: publishableKey as string,
  };
}

export const Route = createFileRoute("/api/teams/accept-invitation")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return new Response("Unauthorized", { status: 401 });

          let env: ReturnType<typeof getSupabaseEnv>;
          try {
            env = getSupabaseEnv();
          } catch (error) {
            console.error(
              "[teams] Missing Supabase environment",
              withLogContext({ correlationId }, safeErrorLog(error)),
            );
            return jsonResponse(
              {
                error: "supabase_env_missing",
                message:
                  "Supabase environment variables are required before invitations can be accepted.",
              },
              503,
              correlationId,
            );
          }

          const supabaseUserClient = createClient<Database>(env.url, env.publishableKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const supabaseAdmin = createClient<Database>(env.url, env.serviceRoleKey, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });

          const {
            data: { user },
            error: authError,
          } = await supabaseUserClient.auth.getUser();
          if (authError || !user) return new Response("Unauthorized", { status: 401 });

          const body = (await request.json()) as { token: string };
          if (!body.token) {
            return new Response(JSON.stringify({ error: "Token is required" }), { status: 400 });
          }

          // Fetch invitation
          const { data: invitation, error: inviteError } = await supabaseAdmin
            .from("organization_invitations")
            .select("*")
            .eq("token", body.token)
            .eq("status", "pending")
            .single();

          if (inviteError || !invitation) {
            return new Response(JSON.stringify({ error: "Invalid or expired invitation" }), {
              status: 400,
            });
          }

          // Check if already a member
          const { data: existingMember } = await supabaseAdmin
            .from("organization_members")
            .select("*")
            .eq("organization_id", invitation.organization_id)
            .eq("user_id", user.id)
            .single();

          if (!existingMember) {
            // Add member
            await supabaseAdmin.from("organization_members").insert({
              organization_id: invitation.organization_id,
              user_id: user.id,
              role: invitation.role,
            });
          }

          // Mark invitation as accepted
          await supabaseAdmin
            .from("organization_invitations")
            .update({ status: "accepted" })
            .eq("id", invitation.id);

          return new Response(
            JSON.stringify({ success: true, organization_id: invitation.organization_id }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("[teams] Accept invitation failed", safeErrorLog(error));
          return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
        }
      },
    },
  },
});
