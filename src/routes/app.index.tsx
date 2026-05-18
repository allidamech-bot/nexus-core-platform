import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Terminal, Sparkles, ShieldCheck, Boxes, CircleDashed, LockKeyhole } from "lucide-react";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { getProjectManifest } from "@/features/projects/projectManifest";
import { ProjectManifestCard } from "@/features/projects/ProjectManifestCard";
import { ProjectTextPreviewPanel } from "@/features/projects/ProjectTextPreviewPanel";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { projects, activeProject, activeProjectPreviews, activeProjectPreviewsLoading } =
    useProjectWorkspace();
  const manifest = getProjectManifest(activeProject);

  async function createSession() {
    if (!session) return;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: session.user.id, title: "New Session", mode: "engineering" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/app/$threadId", params: { threadId: data.id } });
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl">
        <div className="size-12 rounded-xl bg-accent/10 border border-accent/20 grid place-items-center mx-auto mb-6">
          <Terminal className="size-5 text-accent" />
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight mb-3">
          Welcome to your AI operations workspace.
        </h1>
        <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-muted-foreground">
          Upload a project, inspect the safe manifest, select preview context, then open a session
          for structured AI planning. Execution remains disabled until the sandbox phase.
        </p>
        <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {session && (
            <ProjectUploadDialog
              userId={session.user.id}
              trigger={
                <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-zinc-200">
                  Upload or import project
                </button>
              }
            />
          )}
          <button
            onClick={createSession}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            Create AI session
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="mb-8 rounded-lg border border-border bg-surface p-5">
            <Boxes className="mb-3 size-5 text-accent" />
            <div className="text-sm font-semibold">Project ingestion foundation is ready.</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Upload a ZIP or select a local folder to create project records, ingestion jobs, safe
              file inventory, and manifest context. Nexus never executes imported code.
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
        <div className="grid gap-3 text-left md:grid-cols-3">
          {[
            { i: Sparkles, t: "Structured planning", b: "Understanding / Plan / Risks / Files" },
            { i: ShieldCheck, t: "Safe project context", b: "Manifest / Preview / File inventory" },
            { i: LockKeyhole, t: "Governed access", b: "Quota checks / Audit events / RLS" },
          ].map((c) => (
            <div key={c.t} className="p-4 rounded-lg border border-border bg-surface">
              <c.i className="size-4 text-accent mb-2" />
              <div className="text-xs font-semibold">{c.t}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.b}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <InfoPanel
            icon={CircleDashed}
            title="What Nexus can do now"
            items={[
              "Ingest ZIP archives and folder manifests",
              "Generate safe file inventory and preview context",
              "Attach projects to threaded AI sessions",
              "Meter usage and audit sensitive actions",
            ]}
          />
          <InfoPanel
            icon={Terminal}
            title="Not yet supported"
            items={[
              "No shell, terminal, sandbox, or dependency installation",
              "No autonomous code modification or pull requests",
              "No GitHub OAuth, embeddings, or payment checkout yet",
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
