import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/github/install")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const installationId = url.searchParams.get("installation_id");

        if (!installationId) {
          return new Response("Missing installation_id", { status: 400 });
        }

        const authHeader = request.headers.get("Authorization") ?? "";
        const supabase = createClient<Database>(
          process.env.VITE_SUPABASE_URL || "",
          process.env.SUPABASE_SERVICE_ROLE_KEY || "", // Use service role for upserting
          { global: { headers: { Authorization: authHeader } } },
        );

        // Fetch user context if token passed. Actually, github redirect might not have bearer token.
        // Usually we use cookies or the user must be authenticated.
        // Assuming the app passes token in some way or we'd need to extract from cookie.
        // For this demo, let's just attempt to parse a token or redirect back to app where the frontend will call a POST.

        // Actually, redirect endpoints don't have Authorization headers (it's a browser GET).
        // Best approach is redirect to /app/settings?github_installation_id=...
        // The frontend will then call POST /api/github/install with the ID and its own Auth header.
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/app/settings?github_installation_id=${installationId}`,
          },
        });
      },
      POST: async ({ request }: { request: Request }) => {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env.VITE_SUPABASE_URL || "",
          process.env.VITE_SUPABASE_ANON_KEY || "",
          { global: { headers: { Authorization: authHeader } } },
        );

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) return new Response("Unauthorized", { status: 401 });

        const { installationId } = (await request.json()) as { installationId: string };
        if (!installationId) return new Response("Missing installationId", { status: 400 });

        const { fetchInstallationToken } = await import("@/features/github/githubService");
        let accountLogin = "Unknown";
        let accountId = "Unknown";

        try {
          const token = await fetchInstallationToken(installationId);
          const ghResponse = await fetch(
            `https://api.github.com/app/installations/${installationId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "NexusCore-Platform",
              },
            },
          );
          if (ghResponse.ok) {
            const ghData = await ghResponse.json();
            accountLogin = ghData.account.login;
            accountId = ghData.account.id.toString();
          }
        } catch (e) {
          console.warn("Failed to fetch installation details", e);
        }

        const supabaseService = createClient<Database>(
          process.env.VITE_SUPABASE_URL || "",
          process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        );

        const { error } = await supabaseService.from("user_github_installations").upsert(
          {
            user_id: user.id,
            installation_id: installationId,
            account_login: accountLogin,
            account_id: accountId,
          },
          { onConflict: "user_id,installation_id" },
        );

        if (error) {
          return new Response("Database error", { status: 500 });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
