import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Send, Upload, GitBranch, Loader2, Terminal, PanelRight, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { agentModes, mockExecutionSteps, mockFileTree, mockVerification } from "@/lib/mock-data";
import type { AgentMode, FileNode, TaskStatus, VerificationStatus } from "@/lib/types";
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
    onError: (err) => toast.error(friendlyChatError(err)),
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
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      <section className="flex min-w-0 flex-1 flex-col border-r border-border">
        <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-surface/30 px-3 py-2 sm:px-4 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold leading-tight md:text-sm">
              {thread?.title ?? "Session"}
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:text-[11px]">
              Agent #{threadId.slice(0, 6)} / {mode}
              {projectContextName ? ` / ${projectContextName}` : ""}
              {isArchived ? ` / ${t("archivedSession")}` : ""}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {session && (
              <ProjectUploadDialog
                userId={session.user.id}
                trigger={
                  <button
                    type="button"
                    className="hidden min-h-[44px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted md:flex"
                  >
                    <Upload className="size-4 md:size-3" />
                    <span className="hidden md:inline">Upload ZIP</span>
                  </button>
                }
              />
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <button
                      className="hidden min-h-[44px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 md:flex"
                      disabled
                    >
                      <GitBranch className="size-4 md:size-3" />
                      <span className="hidden md:inline">{t("connectRepo")}</span>
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t("connectRepoDisabledTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              type="button"
              onClick={handleNewSession}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors md:flex"
            >
              <MessageSquare className="size-4 md:size-3" />
              <span className="hidden md:inline">New Session</span>
            </button>
            {hasThreadLifecycle && !isArchived && (
              <button
                type="button"
                onClick={handleArchiveThread}
                className="hidden min-h-[44px] items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted md:flex"
              >
                <Archive className="size-4 md:size-3" />
                <span className="hidden md:inline">{t("archiveSession")}</span>
              </button>
            )}
            <button
              onClick={() => setIsInspectorOpen((o) => !o)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isInspectorOpen
                  ? "bg-accent/10 border-accent/20 text-accent"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <PanelRight className="size-4 md:size-3" />
              <span className="hidden md:inline">Inspector</span>
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-none min-w-0 space-y-4 px-3 pb-6 pt-4 md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
            {isArchived && (
              <div className="rounded-md border border-border bg-surface/70 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("thisSessionIsArchived")}</span>{" "}
                {t("startNewTaskAfterArchiving")}
              </div>
            )}
            <ProjectContextStatus
              state={projectContextState}
              projectName={projectContextName}
              isArchived={isArchived}
              onAttach={handleAttachProject}
              t={t}
            />
            {loadingMsgs && (
              <div className="text-xs text-muted-foreground font-mono">Loading session...</div>
            )}
            {!loadingMsgs && messages.length === 0 && <EmptyChat />}
            {messages.map((m) => (
              <MessageBlock key={m.id} message={m} />
            ))}
            {status === "submitted" && (
              <div className="font-mono text-[11px] text-accent flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" /> {t("initializingWorkspace")}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-background px-3 py-4 md:px-6">
          <div className="mx-auto w-full max-w-none min-w-0 md:max-w-3xl">
            <div className="mb-3 flex min-w-0 gap-1.5 overflow-x-auto">
              {agentModes.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    disabled={isArchived}
                    onClick={() => setMode(m.id as AgentMode)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors ${
                      active
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "bg-muted/60 text-muted-foreground border-border hover:text-foreground"
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
                placeholder="Ask Nexus Core to analyze, plan, scope, or review..."
                disabled={isArchived}
                className="min-h-[116px] w-full resize-none rounded-xl border border-border bg-surface p-4 text-base focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[100px] md:pb-4 md:pr-28 md:text-sm"
              />
              <button
                onClick={handleSend}
                disabled={busy || !input.trim() || isArchived}
                className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[13px] font-bold text-accent-foreground shadow-lg disabled:opacity-50 md:absolute md:bottom-3 md:right-3 md:mt-0 md:min-h-[44px] md:w-auto md:rounded-md"
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Send
              </button>
            </div>
            <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Cmd/Ctrl + Enter to send · {t("nexusHelperText")}
            </div>
          </div>
        </div>
      </section>

      {isInspectorOpen && (
        <aside className="fixed inset-y-0 right-0 z-40 flex w-[95vw] max-w-md shrink-0 flex-col overflow-y-auto border-l border-border bg-surface shadow-xl md:static md:w-72 md:bg-surface/40 md:shadow-none">
          <DrawerSection title="Active Project">
            {projectContextProject ? (
              <div className="rounded-md border border-accent/20 bg-accent/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs font-semibold text-foreground">
                    {projectContextProject.name}
                  </div>
                  <ProjectStatusBadge
                    status={
                      projectContextProject.latest_job?.status ?? projectContextProject.status
                    }
                  />
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {projectContextProject.source_type} / ingestion{" "}
                  {projectContextProject.latest_job?.status.replace(/_/g, " ") ?? "not started"}
                </div>
                <button
                  type="button"
                  onClick={handleAttachProject}
                  disabled={threadProjectId === projectContextProject.id || isArchived}
                  className="mt-3 w-full rounded border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {threadProjectId === projectContextProject.id
                    ? t("projectContextAttached")
                    : t("attachThisProject")}
                </button>
              </div>
            ) : threadProjectId ? (
              <div className="rounded-md border border-accent/20 bg-accent/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <div className="font-medium text-foreground">{t("projectContextIsAttached")}</div>
                {projectContextName && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {projectContextName}
                  </div>
                )}
                <div className="mt-2">
                  {attachedProjectLoading
                    ? t("loadingProjects")
                    : projectPreviewDataUnavailable
                      ? t("projectContextCouldNotBeLoaded")
                      : t("projectContextAttachedNoProcessedFiles")}
                </div>
                {!attachedProjectLoading && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("checkZipProcessingStatus")}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("noProjectContextAvailable")}
                </span>
                <br />
                {t("responsesMayBeGeneralWithoutProjectContext")}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Project Summary">
            {threadProjectId && !activeProjectManifest ? (
              <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
                {t("projectContextAttachedNoProcessedFiles")}
              </div>
            ) : (
              <ProjectManifestCard manifest={activeProjectManifest} />
            )}
          </DrawerSection>

          {projectContextProjectId && (
            <DrawerSection title="Project Health">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <StatusMetric
                  label="Files"
                  value={projectFilesLoading ? "..." : projectFiles.length.toString()}
                />
                <StatusMetric
                  label="Previews"
                  value={projectPreviewsLoading ? "..." : projectPreviews.length.toString()}
                />
                <StatusMetric
                  label="Ingestion"
                  value={
                    projectContextProject?.latest_job?.status.replaceAll("_", " ") ??
                    projectContextProject?.status ??
                    t("checkZipProcessingStatus")
                  }
                />
                <StatusMetric label="Context" value={`${selectedPreviewIds.length} selected`} />
              </div>
              <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Ingestion timeline
                </div>
                {["uploaded", "manifest", "safe previews", "ready"].map((step, index) => (
                  <div key={step} className="flex items-center gap-2 py-1 text-[11px]">
                    <span
                      className={`size-1.5 rounded-full ${
                        index <= 2 && projectContextProject?.latest_job?.status === "completed"
                          ? "bg-emerald-400"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          <DrawerSection title={projectContextProjectId ? t("safePreview") : "Example file scope"}>
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
              <FileTree nodes={mockFileTree} depth={0} />
            )}
          </DrawerSection>

          {projectContextProjectId && (
            <DrawerSection title="Safe Text Previews">
              <ProjectTextPreviewPanel
                previews={projectPreviews}
                loading={projectPreviewsLoading}
                selectedPreviewIds={selectedPreviewIds}
                onTogglePreview={handleTogglePreview}
              />
            </DrawerSection>
          )}

          {projectContextProjectId && session && (
            <DrawerSection title={t("groundedPatchPreview")}>
              <ProjectPatchPreviewPanel
                projectId={projectContextProjectId}
                userId={session.user.id}
                previews={projectPreviews}
                disabled={isArchived || !projectContextProject || projectPreviewDataUnavailable}
              />
            </DrawerSection>
          )}

          <DrawerSection title="Planning Pipeline">
            <div className="space-y-3 relative ml-1.5 mt-1">
              <div className="absolute left-[-9px] top-1 bottom-1 w-px bg-border" />
              {mockExecutionSteps.map((s) => (
                <div key={s.id} className="relative flex items-center gap-3">
                  <div
                    className={`size-2 rounded-full ring-4 ring-background ${statusDot(s.status)}`}
                  />
                  <span
                    className={`text-[11px] ${s.status === "completed" ? "text-muted-foreground" : s.status === "running" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="Readiness checks">
            <div className="space-y-2">
              {mockVerification.map((v) => (
                <div key={v.id} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{v.type}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${verifPill(v.status)}`}
                  >
                    {v.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="Guardrails">
            <div className="p-3 rounded-md border border-border bg-background/40">
              <div className="text-[11px] font-semibold text-foreground mb-1">
                Pre-execution mode
              </div>
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                Nexus can analyze manifest and preview context, but cannot execute commands, install
                dependencies, modify files, or open pull requests in this phase.
              </div>
            </div>
          </DrawerSection>
        </aside>
      )}
    </div>
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
            ul: ({ node, ...props }) => (
              <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />
            ),
            h1: ({ node, ...props }) => <h1 className="mb-2 mt-4 text-lg font-bold" {...props} />,
            h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-base font-bold" {...props} />,
            h3: ({ node, ...props }) => <h3 className="mb-2 mt-3 text-sm font-bold" {...props} />,
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-accent" {...props} />
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
                h1: ({ node, ...props }) => <h1 className="mb-2 mt-4 text-lg font-bold" {...props} />,
                h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-base font-bold" {...props} />,
                h3: ({ node, ...props }) => <h3 className="mb-2 mt-3 text-sm font-bold" {...props} />,
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-accent" {...props} />
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
