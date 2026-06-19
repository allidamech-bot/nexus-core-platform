import { FileArchive, FolderSync, Loader2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import {
  createProjectAttachedThread,
  logThreadContextSelection,
} from "@/features/projects/projectService";
import { ProjectSelectorDialog } from "@/components/agent-workspace/ProjectSelectorDialog";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";

import { useLocale } from "@/features/i18n/localeContext";

const PIPELINE_STEPS = [
  { id: "source", label: "Source Package" },
  { id: "preview", label: "Safe Preview" },
  { id: "review", label: "Review Gate" },
  { id: "export", label: "Working Copy Export" },
] as const;

export function ProjectControlCenter() {
  const { session } = useAuth();
  const { activeProject, setSelectedProjectId } = useProjectWorkspace();
  const { t } = useLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  if (!session || !activeProject) return null;

  const project = activeProject;

  const previewReady =
    project.status === "indexed_manifest" ||
    project.status === "completed" ||
    project.latest_job?.status === "completed" ||
    project.latest_job?.status === "indexing_mocked";

  const currentPipelineIndex = previewReady ? 1 : 0;

  async function handleNewSession() {
    if (creatingSession || !session) return;
    setCreatingSession(true);
    try {
      const title = project.name?.slice(0, 60) || "New Session";
      const status = project.latest_job?.status ?? project.status;
      const thread = await createProjectAttachedThread({
        userId: session.user.id,
        title,
        projectId: project.id,
        projectName: project.name,
      });

      const { error } = await supabase.from("messages").insert({
        thread_id: thread.id,
        user_id: session.user.id,
        role: "user",
        parts: [
          {
            type: "text",
            text: `Workspace handoff for ${project.name}. Source type: ${project.source_type}. Status: ${status}. Nexus Core will use the governed preview, review, and export flow for this project.`,
          },
        ] as never,
      });
      if (error) throw error;

      await logThreadContextSelection({
        threadId: thread.id,
        projectId: project.id,
        userId: session.user.id,
        action: "attached_project",
        metadata: {
          project_name: project.name,
          source_type: project.source_type,
          status,
        },
      }).catch(() => undefined);

      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["thread", thread.id] });
      navigate({ to: "/app/$threadId", params: { threadId: thread.id } });
    } catch {
      toast.error("Failed to create session for this project.");
    } finally {
      setCreatingSession(false);
    }
  }

  function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectorOpen(false);
    toast.success("Project switched.");
  }

  return (
    <div className="mx-auto mt-5 flex w-full max-w-none min-w-0 flex-col gap-4 md:max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold text-foreground">{project.name}</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono uppercase tracking-wider">{project.source_type}</span>
              <span className="text-border">|</span>
              <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleNewSession}
              disabled={creatingSession}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {creatingSession ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="size-4" />
              )}
              {t("continueWorkspace")}
            </button>

            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated"
            >
              <FolderSync className="size-4" />
              {t("chooseDifferent")}
            </button>

            <ProjectUploadDialog
              userId={session.user.id}
              defaultMode="zip"
              onSuccess={setSelectedProjectId}
              trigger={
                <button className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated">
                  <FileArchive className="size-4" />
                  {t("uploadAnother")}
                </button>
              }
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("governedPipeline")}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PIPELINE_STEPS.map((step, idx) => {
              const isCurrent = idx === currentPipelineIndex;
              const isCompleted = idx < currentPipelineIndex;

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border px-3 py-2.5 text-center transition-colors ${
                    isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : isCurrent
                        ? "border-accent/30 bg-accent/10"
                        : "border-border bg-background/40"
                  }`}
                >
                  <div
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isCompleted
                        ? "text-emerald-400"
                        : isCurrent
                          ? "text-accent"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {isCompleted ? t("ready") : isCurrent ? t("inProgress") : t("upNext")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ProjectSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleSelectProject}
      />
    </div>
  );
}
