import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Send,
  Upload,
  GitBranch,
  Loader2,
  Terminal,
  PanelRight,
  MessageSquare,
  FolderOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const agentModes = [
  { id: "engineering", label: "Engineering" },
  { id: "business", label: "Business" },
  { id: "research", label: "Research" },
] as const;

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AgentMode } from "@/lib/types";
import { toast } from "sonner";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectManifestCard } from "@/features/projects/ProjectManifestCard";
import { ProjectTextPreviewPanel } from "@/features/projects/ProjectTextPreviewPanel";
import { ProjectSafePreviewPanel } from "@/features/projects/ProjectSafePreviewPanel";
import { ProjectPatchPreviewPanel } from "@/features/projects/ProjectPatchPreviewPanel";
import { getProjectManifest } from "@/features/projects/projectManifest";
import {
  useProjectFilesQuery,
  useProjectQuery,
  useProjectTextPreviewsQuery,
} from "@/features/projects/projectQueries";
import { resolveThreadProjectContext } from "@/features/projects/projectThreadContext";
import {
  attachProjectToThread,
  logThreadContextSelection,
} from "@/features/projects/projectService";
import type { ProjectTextPreviewWithPath } from "@/features/projects/types";
import { governanceKeys, useUsageOverviewQuery } from "@/features/governance/governanceQueries";
import {
  estimateByteSize,
  recordAuditEvent,
  recordUsageEvent,
} from "@/features/governance/governanceService";
import { useLocale } from "@/features/i18n/localeContext";
import type { TranslationKey } from "@/features/i18n/translations";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { PricingUpgradeModal } from "@/components/agent-workspace/PricingUpgradeModal";

export const Route = createFileRoute("/app/$threadId")({
  component: ThreadView,
});

interface MessageRow {
  id: string;
  role: string;
  parts: unknown;
  created_at: string;
}

function friendlyChatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("ai_gateway_env_missing") || message.includes("LOVABLE_API_KEY")) {
    return "AI gateway is not configured yet. Add LOVABLE_API_KEY, then retry the chat.";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Your session could not be verified. Sign in again and retry.";
  }
  if (message.includes("database_setup_missing") || message.includes("governance_unavailable")) {
    return "Workspace governance is not fully configured. Apply the Supabase migrations, then retry.";
  }
  if (message.includes("project_context_unavailable")) {
    return "Project context is temporarily unavailable. Try again without selected previews.";
  }
  return message || "Chat is unavailable. Check project configuration and try again.";
}

function ThreadView() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const qc = useQueryClient();
  const { t } = useLocale();
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [mode, setMode] = useState<AgentMode>("engineering");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { activeProject, selectedPreviewIds, setSelectedPreviewIds, setSelectedProjectId } =
    useProjectWorkspace();
  const { data: usageOverview } = useUsageOverviewQuery(session?.user.id ?? null);

  const { data: thread } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .eq("id", threadId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const threadProjectId = typeof thread?.project_id === "string" ? thread.project_id : null;
  const threadProjectName =
    typeof thread?.project_name === "string" && thread.project_name.trim()
      ? thread.project_name
      : null;
  const {
    data: hydratedAttachedProject = null,
    isLoading: attachedProjectLoading,
    isError: attachedProjectError,
  } = useProjectQuery(threadProjectId);
  const resolvedProjectContext = resolveThreadProjectContext({
    threadProjectId,
    threadProjectName,
    activeProject,
    attachedProject: hydratedAttachedProject,
  });
  const projectContextProjectId = resolvedProjectContext.projectId;
  const projectContextProject = resolvedProjectContext.project;
  const projectContextName = resolvedProjectContext.projectName;
  const activeProjectManifest = useMemo(
    () => getProjectManifest(projectContextProject),
    [projectContextProject],
  );
  const {
    data: projectFiles = [],
    isLoading: projectFilesLoading,
    isError: projectFilesError,
  } = useProjectFilesQuery(projectContextProjectId);
  const {
    data: projectPreviews = [],
    isLoading: projectPreviewsLoading,
    isError: projectPreviewsError,
  } = useProjectTextPreviewsQuery(projectContextProjectId);
  const projectContextState = resolvedProjectContext.state;
  const projectPreviewDataUnavailable =
    attachedProjectError || projectFilesError || projectPreviewsError;
  const projectContextEmptyMessage = projectPreviewDataUnavailable
    ? `${t("projectPreviewDataUnavailable")}. ${t("checkZipProcessingStatus")}.`
    : t("projectContextAttachedNoProcessedFiles");
  const hasThreadLifecycle = thread
    ? "status" in thread && "archived_at" in thread && "archived_by" in thread
    : false;
  const isArchived =
    hasThreadLifecycle && (thread?.status === "archived" || Boolean(thread?.archived_at));

  useEffect(() => {
    if (threadProjectId) setSelectedProjectId(threadProjectId);
  }, [setSelectedProjectId, threadProjectId]);

  const { data: initialMessages, isLoading: loadingMsgs } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async (): Promise<UIMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as MessageRow[]).map((r) => ({
        id: r.id,
        role: r.role as UIMessage["role"],
        parts: (Array.isArray(r.parts) ? r.parts : []) as UIMessage["parts"],
      }));
    },
  });

  useEffect(() => {
    if (thread?.mode) setMode(thread.mode as AgentMode);
  }, [thread?.mode]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          mode,
          selectedPreviewIds,
        }),
        prepareSendMessagesRequest: async (options) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;

          return {
            body: {
              ...options.body,
              id: options.id,
              messages: options.messages,
              trigger: options.trigger,
              messageId: options.messageId,
            },
            headers: token
              ? {
                  ...options.headers,
                  Authorization: `Bearer ${token}`,
                }
              : options.headers,
          };
        },
      }),
    [mode, selectedPreviewIds],
  );

  const { messages, setMessages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: async ({ message }) => {
      if (!session) return;
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        user_id: session.user.id,
        role: message.role,
        parts: message.parts as never,
      });
      if (error) console.error("save assistant", error);
    },
    onError: (err) => {
      const msg = friendlyChatError(err);
      if (msg.includes("limit") || msg.includes("quota")) {
        setIsUpgradeModalOpen(true);
      } else {
        toast.error(msg);
      }
    },
  });

  const hydratedThreadRef = useRef<string | null>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    hydratedThreadRef.current = null;
  }, [threadId]);

  useEffect(() => {
    if (!initialMessages || hydratedThreadRef.current === threadId || busy) return;
    setMessages(initialMessages);
    hydratedThreadRef.current = threadId;
  }, [busy, initialMessages, setMessages, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  async function handleArchiveThread() {
    if (!session || !thread || isArchived) return;
    if (!window.confirm(t("archiveSessionConfirm"))) return;

    const archivedAt = new Date().toISOString();
    const { error } = await supabase
      .from("threads")
      .update({
        status: "archived",
        archived_at: archivedAt,
        archived_by: session.user.id,
        updated_at: archivedAt,
      })
      .eq("id", threadId);

    if (error) {
      toast.error(t("archiveSessionFailed"));
      return;
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["thread", threadId] }),
      qc.invalidateQueries({ queryKey: ["threads"] }),
      qc.invalidateQueries({ queryKey: ["threads", "recent", session.user.id] }),
      qc.invalidateQueries({ queryKey: governanceKeys.usage(session.user.id) }),
    ]);
    toast.success(t("sessionArchived"));
    navigate({ to: "/app" });
  }

  async function handleNewSession() {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from("threads")
        .insert({ user_id: session.user.id, title: "New Session", mode: "engineering" })
        .select()
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/app/$threadId", params: { threadId: data.id } });
    } catch (err) {
      toast.error("Failed to create new session");
    }
  }

  async function handleAttachProject() {
    if (!session || !activeProject || isArchived) return;
    try {
      await attachProjectToThread({
        threadId,
        projectId: activeProject.id,
        projectName: activeProject.name,
      });
      await logThreadContextSelection({
        threadId,
        projectId: activeProject.id,
        userId: session.user.id,
        action: "attached_project",
        metadata: { project_name: activeProject.name },
      });
      await recordAuditEvent({
        userId: session.user.id,
        actorUserId: session.user.id,
        threadId,
        projectId: activeProject.id,
        eventType: "thread_project_attached",
        payload: { project_name: activeProject.name },
      }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      toast.success("Project attached to this session.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project attachment failed.");
    }
  }

  async function handleTogglePreview(preview: ProjectTextPreviewWithPath) {
    if (!session || !projectContextProjectId || isArchived) return;
    const selected = selectedPreviewIds.includes(preview.id);
    const previewLimit = usageOverview?.limits?.max_context_previews ?? 6;
    if (!selected && selectedPreviewIds.length >= previewLimit) {
      toast.error(
        `Selected preview limit reached for the ${usageOverview?.planId ?? "current"} plan.`,
      );
      await recordAuditEvent({
        userId: session.user.id,
        actorUserId: session.user.id,
        threadId,
        projectId: projectContextProjectId,
        eventType: "quota_hit_context_previews",
        severity: "warning",
        payload: { limit: previewLimit, selected: selectedPreviewIds.length },
      }).catch(() => {});
      return;
    }
    const nextPreviewIds = selected
      ? selectedPreviewIds.filter((previewId) => previewId !== preview.id)
      : [...selectedPreviewIds, preview.id];

    setSelectedPreviewIds(nextPreviewIds);

    if (!selected) {
      await recordUsageEvent({
        userId: session.user.id,
        threadId,
        projectId: projectContextProjectId,
        eventType: "context_preview_selected",
        sizeBytes: estimateByteSize(preview.preview_text),
        tokenEstimate: preview.token_estimate,
        metadata: { path: preview.path },
      }).catch(() => {});
    }

    await logThreadContextSelection({
      threadId,
      projectId: projectContextProjectId,
      userId: session.user.id,
      action: selected ? "cleared_preview" : "selected_preview",
      previewId: preview.id,
      fileId: preview.file_id,
      metadata: { path: preview.path, summary: preview.summary },
    }).catch((error) => console.warn("[context-selection] audit write failed", error));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !session) return;
    if (isArchived) {
      toast.error(t("thisSessionIsArchived"));
      return;
    }
    setInput("");

    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    };
    const { error: messageError } = await supabase.from("messages").insert({
      thread_id: threadId,
      user_id: session.user.id,
      role: "user",
      parts: userMsg.parts as never,
    });
    if (messageError) {
      toast.error(`Could not save your message: ${messageError.message}`);
      return;
    }

    if ((messages?.length ?? 0) === 0) {
      const title = text.slice(0, 60);
      await supabase
        .from("threads")
        .update({ title, mode, updated_at: new Date().toISOString() })
        .eq("id", threadId);
      qc.invalidateQueries({ queryKey: ["threads"] });
    } else {
      await supabase
        .from("threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
    }

    sendMessage({ text });
  }

  return (
    <>
      <div className="flex h-full min-w-0 flex-1 overflow-hidden bg-background">
        {/* LEFT SIDEBAR: FILE TREE */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-surface/20 overflow-y-auto shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
          <DrawerSection title="Project Context">
            <ProjectContextStatus
              state={projectContextState}
              projectName={projectContextName}
              isArchived={isArchived}
              onAttach={handleAttachProject}
              t={t}
            />
          </DrawerSection>
          {projectContextProjectId && activeProjectManifest && (
            <DrawerSection title="Project Scope">
              <ProjectManifestCard manifest={activeProjectManifest} />
            </DrawerSection>
          )}
          <DrawerSection title={projectContextProjectId ? t("safePreview") : "File Explorer"}>
            {projectContextProjectId ? (
              <ProjectSafePreviewPanel
                files={projectFiles}
                previews={projectPreviews}
                manifest={activeProjectManifest}
                latestJob={projectContextProject?.latest_job ?? null}
                loading={projectFilesLoading || projectPreviewsLoading || attachedProjectLoading}
                emptyMessage={threadProjectId ? projectContextEmptyMessage : undefined}
              />
            ) : (
              <div className="text-xs text-muted-foreground">
                Select a project to view file tree.
              </div>
            )}
          </DrawerSection>
        </aside>

        {/* CENTER CORE: EDITOR & TERMINAL */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a0a]">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {projectContextProjectId ? (
              <div className="mx-auto max-w-5xl space-y-6">
                <div className="overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                  <div className="flex items-center gap-2 border-b border-border bg-surface/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <PanelRight className="size-3.5" /> Editor Tabs
                  </div>
                  <div className="p-4">
                    <ProjectTextPreviewPanel
                      previews={projectPreviews}
                      loading={projectPreviewsLoading}
                      selectedPreviewIds={selectedPreviewIds}
                      onTogglePreview={handleTogglePreview}
                    />
                  </div>
                </div>

                {session && (
                  <div className="overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                    <div className="flex items-center gap-2 border-b border-border bg-surface/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      <GitBranch className="size-3.5" /> Patch Workstation
                    </div>
                    <div className="p-4">
                      <ProjectPatchPreviewPanel
                        projectId={projectContextProjectId}
                        userId={session.user.id}
                        previews={projectPreviews}
                        disabled={
                          isArchived || !projectContextProject || projectPreviewDataUnavailable
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid h-full place-items-center text-center text-muted-foreground">
                <div>
                  <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
                    <FolderOpen className="size-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-foreground">
                    No active project context
                  </h3>
                  <p className="text-sm">Seed a demo workspace or upload a project to begin.</p>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM TERMINAL */}
          <div className="h-[30vh] min-h-[200px] shrink-0 border-t border-border bg-[#050505] p-4 font-mono text-[11px] text-muted-foreground overflow-y-auto shadow-inner">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
              <Terminal className="size-3.5" /> Sandbox Execution Stdout
            </div>
            <div className="space-y-1">
              <div>&gt; Nexus IDE Engine Initialized.</div>
              <div>&gt; Listening for sandbox execution jobs...</div>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR: AI CHAT */}
        <aside className="flex w-full shrink-0 flex-col border-l border-border bg-surface/30 md:w-[28rem] z-30 shadow-[-1px_0_10px_rgba(0,0,0,0.02)]">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-background/50 px-3 py-2 sm:px-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold leading-tight md:text-sm">
                {thread?.title ?? "Session"}
              </div>
              <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Agent #{threadId.slice(0, 6)} / {mode}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleNewSession}
                className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20 md:min-h-[32px]"
              >
                <MessageSquare className="size-3.5 md:size-3" />
                <span className="hidden md:inline">New Chat</span>
              </button>
              {hasThreadLifecycle && !isArchived && (
                <button
                  type="button"
                  onClick={handleArchiveThread}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted md:min-h-[32px]"
                >
                  <Archive className="size-3.5 md:size-3" />
                </button>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-6 pt-4 md:px-5">
            {loadingMsgs && (
              <div className="font-mono text-xs text-muted-foreground">Loading session...</div>
            )}
            {!loadingMsgs && messages.length === 0 && <EmptyChat />}
            {messages.map((m) => (
              <MessageBlock key={m.id} message={m} />
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-accent">
                <Loader2 className="size-3 animate-spin" /> {t("initializingWorkspace")}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-background p-3 md:p-4">
            <div className="mb-3 flex min-w-0 gap-1.5 overflow-x-auto">
              {agentModes.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    disabled={isArchived}
                    onClick={() => setMode(m.id as AgentMode)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      active
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-border bg-muted/60 text-muted-foreground hover:text-foreground"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="relative min-w-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Nexus IDE..."
                disabled={isArchived}
                className="min-h-[100px] w-full resize-none rounded-xl border border-border bg-surface p-4 text-sm text-start shadow-inner focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60 md:pb-4 md:pr-14"
                dir="auto"
              />
              <button
                onClick={handleSend}
                disabled={busy || !input.trim() || isArchived}
                className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-md disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
            <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Cmd/Ctrl + Enter to send
            </div>
          </div>
        </aside>
      </div>

      <PricingUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  );
}

function EmptyChat() {
  const { t } = useLocale();
  return (
    <div className="min-w-0 py-10 text-center sm:py-12">
      <div className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
        <Terminal className="size-4" />
      </div>
      <h2 className="mb-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
        {t("tellNexusToChange")}
      </h2>
      <div className="text-sm text-muted-foreground font-medium">{t("nexusHelperText")}</div>
      <div className="mx-auto mt-6 grid w-full max-w-none grid-cols-1 gap-2 text-left md:max-w-xl md:grid-cols-2">
        {[t("examplePrompt1"), t("examplePrompt2"), t("examplePrompt3"), t("examplePrompt4")].map(
          (p, i) => (
            <div
              key={i}
              className="min-h-[64px] rounded-lg border border-border bg-surface p-3 text-start text-sm leading-relaxed text-muted-foreground md:text-xs"
            >
              {p}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function ProjectContextStatus({
  state,
  projectName,
  isArchived,
  onAttach,
  t,
}: {
  state: "attached" | "detached" | "none";
  projectName: string | null;
  isArchived: boolean;
  onAttach: () => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
}) {
  const isAttached = state === "attached";
  const title =
    state === "attached"
      ? t("projectContextAttached")
      : state === "detached"
        ? t("projectContextNotAttached")
        : t("noProjectContextAvailable");
  const body = isAttached
    ? t("assistantCanUseIndexedProjectContext")
    : state === "detached"
      ? t("attachProjectToImproveProposals")
      : t("responsesMayBeGeneralWithoutProjectContext");

  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs ${
        isAttached ? "border-accent/30 bg-accent/5" : "border-border bg-surface/50"
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={isAttached ? "font-semibold text-accent" : "font-semibold text-foreground"}
          >
            {title}
          </div>
          <div className="mt-1 text-muted-foreground">
            {projectName ? (
              <>
                <span className="font-medium text-foreground">
                  {isAttached ? t("attachedProject") : t("activeProject")}:
                </span>{" "}
                {projectName}
              </>
            ) : (
              body
            )}
          </div>
          {projectName && <div className="mt-1 text-muted-foreground">{body}</div>}
        </div>
        {state === "detached" && !isArchived && (
          <button
            type="button"
            onClick={onAttach}
            className="min-h-[44px] shrink-0 rounded border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            {t("attachThisProject")}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MessageBlock({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[92%] rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground whitespace-pre-wrap sm:max-w-[85%]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-accent">
        <div className="size-1.5 rounded-full bg-accent" />
        Nexus Core
      </div>
      <StructuredAssistant text={text} />
    </div>
  );
}

const SECTION_NAMES = [
  "Project Context Used",
  "Implementation Plan",
  "Files Likely Affected",
  "Patch Preview / Proposed Changes",
  "Verification Checklist",
  "Risks / Notes",
  "Limitations / Not Applied Yet",
  "Readiness log",
  "Understanding",
  "Plan",
  "Risks",
  "Files to inspect or change",
  "Proposed actions",
  "Execution log",
  "Verification",
  "Final result",
];

function StructuredAssistant({ text }: { text: string }) {
  if (!text) return <div className="text-xs text-muted-foreground font-mono">Thinking...</div>;

  const sections: { name: string; body: string }[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  const indices: { name: string; index: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const sectionName = m[1]?.trim();
    if (sectionName && SECTION_NAMES.some((n) => n.toLowerCase() === sectionName.toLowerCase())) {
      indices.push({ name: sectionName, index: m.index, len: m[0].length });
    }
  }
  if (indices.length === 0) {
    return (
      <div className="text-sm text-foreground leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
            ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
            ol: ({ node, ...props }) => (
              <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />
            ),
            h1: ({ node, ...props }) => <h1 className="mb-2 mt-4 text-lg font-bold" {...props} />,
            h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-base font-bold" {...props} />,
            h3: ({ node, ...props }) => <h3 className="mb-2 mt-3 text-sm font-bold" {...props} />,
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code
                  className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-accent"
                  {...props}
                />
              ) : (
                <pre className="mb-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px]">
                  <code {...props} />
                </pre>
              ),
            a: ({ node, ...props }) => (
              <a className="text-accent underline underline-offset-2" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }
  indices.forEach((it, i) => {
    const start = it.index + it.len;
    const end = i + 1 < indices.length ? indices[i + 1].index : text.length;
    sections.push({ name: it.name, body: text.slice(start, end).trim() });
  });

  return (
    <div className="min-w-0 space-y-4">
      {sections.map((s, i) => (
        <SectionBlock key={i} name={s.name} body={s.body} />
      ))}
    </div>
  );
}

function SectionBlock({ name, body }: { name: string; body: string }) {
  const isRisk = name.toLowerCase().startsWith("risk");
  const isLog = ["execution log", "readiness log"].includes(name.toLowerCase());
  const isPatchPreview = name.toLowerCase() === "patch preview / proposed changes";
  const isVerif = ["verification", "verification checklist"].includes(name.toLowerCase());

  return (
    <section
      className={`rounded-lg border ${
        isRisk ? "border-destructive/30 bg-destructive/5" : "border-border bg-surface"
      } overflow-hidden`}
    >
      <header
        className={`px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-widest ${
          isRisk ? "text-destructive" : "text-accent"
        }`}
      >
        {name}
      </header>
      <div className="min-w-0 p-4">
        {isPatchPreview ? (
          <pre className="overflow-x-auto rounded border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
            {stripCodeFence(body)}
          </pre>
        ) : isLog ? (
          <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/50 rounded p-3 border border-border">
            {stripCodeFence(body)}
          </pre>
        ) : isVerif ? (
          <VerificationFromText text={body} />
        ) : (
          <div className="text-sm text-foreground leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                ul: ({ node, ...props }) => (
                  <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />
                ),
                h1: ({ node, ...props }) => (
                  <h1 className="mb-2 mt-4 text-lg font-bold" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="mb-2 mt-4 text-base font-bold" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="mb-2 mt-3 text-sm font-bold" {...props} />
                ),
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code
                      className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-accent"
                      {...props}
                    />
                  ) : (
                    <pre className="mb-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px]">
                      <code {...props} />
                    </pre>
                  ),
                a: ({ node, ...props }) => (
                  <a className="text-accent underline underline-offset-2" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-semibold text-foreground" {...props} />
                ),
              }}
            >
              {body}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </section>
  );
}

export type VerificationStatus = "passed" | "failed" | "warning" | "not_run" | "running";
export type TaskStatus =
  | "pending"
  | "running"
  | "verifying"
  | "completed"
  | "failed"
  | "awaiting_approval";
export type FileNode = {
  id: string;
  name: string;
  type: "file" | "dir";
  status?: "added" | "modified" | "removed" | "unchanged";
  children?: FileNode[];
};

function stripCodeFence(s: string) {
  return s
    .replace(/^```[a-z]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

function VerificationFromText({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = lines.map((l) => {
    const m = l.match(
      /(Typecheck|Lint(?:er|ing)?|Build|Tests?|Security(?: Scan)?|Performance)[^A-Z]*?(PASSED|FAILED|WARNING|NOT RUN|RUNNING)/i,
    );
    if (!m) return { label: l.replace(/^[-*\s]+/, ""), status: "not_run" as VerificationStatus };
    return {
      label: m[1],
      status: m[2].toUpperCase().replace(" ", "_").toLowerCase() as VerificationStatus,
    };
  });
  return (
    <div className="space-y-1.5">
      {parsed.map((p, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-foreground">{p.label}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${verifPill(p.status)}`}
          >
            {p.status.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-border last:border-b-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function FileTree({ nodes, depth }: { nodes: FileNode[]; depth: number }) {
  return (
    <div className="space-y-0.5 font-mono text-[12px]">
      {nodes.map((n) => (
        <div key={n.id}>
          <div
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted"
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {n.type === "dir" ? (
              <span className="text-muted-foreground">&gt;</span>
            ) : (
              <span
                className={
                  n.status === "added"
                    ? "text-emerald-400"
                    : n.status === "modified"
                      ? "text-accent"
                      : "text-muted-foreground"
                }
              >
                {n.status === "added" ? "+" : n.status === "modified" ? "~" : "-"}
              </span>
            )}
            <span className={n.type === "dir" ? "text-foreground" : "text-muted-foreground"}>
              {n.name}
            </span>
          </div>
          {n.children && <FileTree nodes={n.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

function statusDot(s: TaskStatus): string {
  switch (s) {
    case "completed":
      return "bg-emerald-500";
    case "running":
    case "verifying":
      return "bg-accent animate-pulse";
    case "failed":
      return "bg-destructive";
    case "awaiting_approval":
      return "bg-warning";
    default:
      return "bg-muted-foreground";
  }
}

function verifPill(s: VerificationStatus): string {
  switch (s) {
    case "passed":
      return "bg-emerald-500/10 text-emerald-400";
    case "failed":
      return "bg-destructive/10 text-destructive";
    case "warning":
      return "bg-warning/10 text-warning";
    case "running":
      return "bg-accent/10 text-accent";
    default:
      return "bg-muted text-muted-foreground";
  }
}
