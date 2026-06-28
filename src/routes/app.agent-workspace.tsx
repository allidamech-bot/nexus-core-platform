import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { AgentWorkspacePanel } from "@/components/agent-workspace/AgentWorkspacePanel";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/agent-workspace")({
  component: AgentWorkspaceRoute,
});

function AgentWorkspaceRoute() {
  const { session } = useAuth();
  const { activeProject } = useProjectWorkspace();
  const navigate = useNavigate();

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">Sign in to access the agent workspace.</p>
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Select or upload a project first to use the Nexus Agent workspace.
          </p>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-[13px] font-bold text-foreground transition-colors hover:bg-surface-elevated"
          >
            <ArrowLeft className="size-4" />
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return <AgentWorkspacePanel projectId={activeProject.id} />;
}
