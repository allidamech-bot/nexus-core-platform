import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchInstallationToken } from "@/features/github/githubService";
import { PROJECT_UPLOAD_BUCKET } from "@/features/projects/constants";

export const Route = createFileRoute("/api/projects/github-import")({
  server: {
    handlers: {
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

        const body = await request.json();
        const { installationId, repoFullName, branchName = "main" } = body;

        if (!installationId || !repoFullName) {
          return new Response("Missing parameters", { status: 400 });
        }

        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            name: repoFullName.split("/").pop() ?? repoFullName,
            source_type: "github",
            github_installation_id: installationId,
            github_repo_full_name: repoFullName,
          })
          .select()
          .single();

        if (projectError || !project) {
          console.error("Failed to create project", projectError);
          return new Response("Failed to create project", { status: 500 });
        }

        void (async () => {
          try {
            const supabaseService = createClient<Database>(
              process.env.VITE_SUPABASE_URL || "",
              process.env.SUPABASE_SERVICE_ROLE_KEY || "",
            );

            const token = await fetchInstallationToken(installationId);
            const zipResponse = await fetch(
              `https://api.github.com/repos/${repoFullName}/zipball/${branchName}`,
              {
                headers: {
                  Authorization: `token ${token}`,
                  "User-Agent": "NexusCore-Platform",
                },
              },
            );

            if (!zipResponse.ok) throw new Error("Failed to download zip");

            const zipBlob = await zipResponse.blob();
            const jobId = crypto.randomUUID();
            const storagePath = `${user.id}/${project.id}/${jobId}.zip`;

            await supabaseService.storage
              .from(PROJECT_UPLOAD_BUCKET)
              .upload(storagePath, zipBlob, { upsert: true });

            const { error: jobError } = await supabaseService
              .from("project_ingestion_jobs")
              .insert({
                id: jobId,
                project_id: project.id,
                user_id: user.id,
                status: "pending",
                metadata: {
                  storage_path: storagePath,
                  file_name: `${repoFullName.split("/").pop()}.zip`,
                  source_type: "github",
                },
              });

            if (!jobError) {
              fetch(`${new URL(request.url).origin}/api/projects/sandbox-jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "process_ingestion", jobId, projectId: project.id }),
              }).catch(console.error);
            }
          } catch (e) {
            console.error("GitHub import failed", e);
          }
        })();

        return Response.json({ projectId: project.id });
      },
    },
  },
});
