import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Github, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GithubRepository } from "./githubService";
import { projectKeys } from "../projects/projectQueries";

export function useGithubReposQuery() {
  return useQuery<{ repositories: GithubRepository[] }>({
    queryKey: ["github_repos"],
    queryFn: async () => {
      const res = await fetch("/api/github/repos");
      if (!res.ok) throw new Error("Failed to fetch github repos");
      return res.json();
    },
  });
}

export function useImportGithubMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      installationId: string;
      repoFullName: string;
      branchName?: string;
    }) => {
      const res = await fetch("/api/projects/github-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to import GitHub repo");
      return res.json() as Promise<{ projectId: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function GithubRepoSelector({
  trigger,
  onSuccess,
}: {
  trigger: ReactNode;
  onSuccess?: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGithubReposQuery();
  const importMutation = useImportGithubMutation();

  const handleSelect = async (repo: any) => {
    try {
      toast.message("Importing GitHub Repository...");
      const result = await importMutation.mutateAsync({
        installationId: repo.installation_id,
        repoFullName: repo.full_name,
        branchName: repo.default_branch,
      });
      toast.success("GitHub repository connected and importing!");
      setOpen(false);
      if (onSuccess) onSuccess(result.projectId);
    } catch (e) {
      toast.error("Failed to connect GitHub repository.");
    }
  };

  const appName = process.env.VITE_GITHUB_APP_NAME || "nexus-core"; // Public env var for frontend
  const installUrl = `https://github.com/apps/${appName}/installations/new`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-background sm:max-w-xl p-0">
        <div className="border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Github className="size-5" /> Connect GitHub Repository
            </DialogTitle>
            <DialogDescription>
              Link a GitHub repository to automatically sync changes and export patches as Pull
              Requests.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.repositories.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed border-border bg-surface">
              <Github className="size-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-1">No repositories found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Install the Nexus Core GitHub App to connect your repositories.
              </p>
              <Button asChild>
                <a href={installUrl} target="_blank" rel="noopener noreferrer">
                  Install GitHub App
                </a>
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              {data.repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleSelect(repo)}
                  disabled={importMutation.isPending}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-surface hover:bg-surface-elevated transition-colors text-left"
                >
                  <div>
                    <div className="font-medium text-foreground">{repo.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Branch: {repo.default_branch} {repo.private && "• Private"}
                    </div>
                  </div>
                  {importMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin text-accent" />
                  ) : (
                    <CheckCircle2 className="size-4 text-muted-foreground opacity-50" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
