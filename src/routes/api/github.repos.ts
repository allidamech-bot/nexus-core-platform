import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { listInstallationRepositories } from "@/features/github/githubService";

export const Route = createFileRoute("/api/github/repos")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
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

        const { data: installations, error } = await supabase
          .from("user_github_installations")
          .select("*")
          .eq("user_id", user.id);

        if (error || !installations) {
          return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
        }

        if (installations.length === 0) {
          return new Response(JSON.stringify({ repositories: [] }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const allRepos = [];
        for (const inst of installations) {
          try {
            const repos = await listInstallationRepositories(inst.installation_id);
            allRepos.push(
              ...repos.map((r: any) => ({ ...r, installation_id: inst.installation_id })),
            );
          } catch (e) {
            console.error(`Failed to fetch repos for installation ${inst.installation_id}`, e);
          }
        }

        return new Response(JSON.stringify({ repositories: allRepos }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
