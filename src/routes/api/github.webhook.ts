import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhookSignature, fetchInstallationToken } from "@/features/github/githubService";
import { PROJECT_UPLOAD_BUCKET } from "@/features/projects/constants";

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const signature = request.headers.get("x-hub-signature-256");
        const event = request.headers.get("x-github-event");
        const payloadText = await request.text();

        if (!signature || !verifyWebhookSignature(payloadText, signature)) {
          return new Response("Unauthorized webhook", { status: 401 });
        }

        const payload = JSON.parse(payloadText);

        if (event !== "push") {
          return new Response("Ignored event type", { status: 200 });
        }

        const repoFullName = payload.repository?.full_name;
        const branch = payload.ref?.replace("refs/heads/", "");
        const defaultBranch = payload.repository?.default_branch;
        const installationId = payload.installation?.id?.toString();

        if (!repoFullName || branch !== defaultBranch || !installationId) {
          return new Response("Not a default branch push or missing data", { status: 200 });
        }

        const response = new Response("Push event received", { status: 200 });

        void (async () => {
          try {
            const supabase = createClient<Database>(
              process.env.VITE_SUPABASE_URL || "",
              process.env.SUPABASE_SERVICE_ROLE_KEY || "",
            );

            const { data: projects, error } = await supabase
              .from("projects")
              .select("*")
              .eq("source_type", "github")
              .eq("github_repo_full_name", repoFullName)
              .eq("github_installation_id", installationId);

            if (error || !projects || projects.length === 0) return;

            const token = await fetchInstallationToken(installationId);
            const zipResponse = await fetch(
              `https://api.github.com/repos/${repoFullName}/zipball/${branch}`,
              {
                headers: {
                  Authorization: `token ${token}`,
                  "User-Agent": "NexusCore-Platform",
                },
              },
            );

            if (!zipResponse.ok) {
              console.error(`Failed to download zip from GitHub: ${zipResponse.statusText}`);
              return;
            }

            const zipBlob = await zipResponse.blob();

            for (const project of projects) {
              const jobId = crypto.randomUUID();
              const storagePath = `${project.user_id}/${project.id}/${jobId}.zip`;

              const { error: uploadError } = await supabase.storage
                .from(PROJECT_UPLOAD_BUCKET)
                .upload(storagePath, zipBlob, { upsert: true });

              if (uploadError) {
                console.error("Failed to upload GitHub ZIP to Supabase", uploadError);
                continue;
              }

              const { error: jobError } = await supabase.from("project_ingestion_jobs").insert({
                id: jobId,
                project_id: project.id,
                user_id: project.user_id,
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
                  body: JSON.stringify({
                    action: "process_ingestion",
                    jobId,
                    projectId: project.id,
                  }),
                }).catch((e) => console.error("Failed to trigger ingestion job", e));
              }
            }
          } catch (err) {
            console.error("Background webhook processing failed", err);
          }
        })();

        return response;
      },
    },
  },
});
