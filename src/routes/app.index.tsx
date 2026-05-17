import { createFileRoute } from "@tanstack/react-router";
import { Terminal, Sparkles, ShieldCheck, Boxes } from "lucide-react";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { getProjectManifest } from "@/features/projects/projectManifest";
import { ProjectManifestCard } from "@/features/projects/ProjectManifestCard";
import { ProjectTextPreviewPanel } from "@/features/projects/ProjectTextPreviewPanel";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { projects, activeProject, activeProjectPreviews, activeProjectPreviewsLoading } =
    useProjectWorkspace();
  const manifest = getProjectManifest(activeProject);

  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="max-w-xl text-center">
        <div className="size-12 rounded-xl bg-accent/10 border border-accent/20 grid place-items-center mx-auto mb-6">
          <Terminal className="size-5 text-accent" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Ready for instructions.</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Start a new session from the sidebar. Nexus Core will plan, execute, and verify the work -
          surfacing every step in real time.
        </p>
        {projects.length === 0 ? (
          <div className="mb-8 rounded-lg border border-border bg-surface p-5 text-left">
            <Boxes className="mb-3 size-5 text-accent" />
            <div className="text-sm font-semibold">Project ingestion foundation is ready.</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Upload a ZIP from the sidebar to create project records, ingestion jobs, and a safe
              server-side manifest. Execution stays disabled until later phases.
            </p>
          </div>
        ) : activeProject ? (
          <div className="mb-8 rounded-lg border border-accent/20 bg-accent/5 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{activeProject.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Active project / {activeProject.source_type}
                </div>
              </div>
              <ProjectStatusBadge
                status={activeProject.latest_job?.status ?? activeProject.status}
              />
            </div>
            <div className="mt-4">
              <ProjectManifestCard manifest={manifest} />
            </div>
            <div className="mt-4">
              <ProjectTextPreviewPanel
                previews={activeProjectPreviews}
                loading={activeProjectPreviewsLoading}
              />
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-3 text-left">
          {[
            { i: Sparkles, t: "Structured planning", b: "Understanding / Plan / Risks / Files" },
            { i: Terminal, t: "Live execution", b: "Streaming logs with approval gates" },
            { i: ShieldCheck, t: "Verified output", b: "Typecheck / Lint / Build / Tests" },
          ].map((c) => (
            <div key={c.t} className="p-4 rounded-lg border border-border bg-surface">
              <c.i className="size-4 text-accent mb-2" />
              <div className="text-xs font-semibold">{c.t}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
