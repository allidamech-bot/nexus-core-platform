import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useMemo, useRef, useEffect } from "react";
import { Archive, Send, Loader2, MessageSquare, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AgentMode } from "@/lib/types";
import type {
  AgentPlan,
  AgentFinalReport,
  AgentValidationPlan,
  PatchProposalBundle,
} from "@/lib/agent-types";
import { toast } from "sonner";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { getProjectManifest } from "@/features/projects/projectManifest";
import {
  useProjectFilesQuery,
  useProjectQuery,
  useProjectTextPreviewsQuery,
  usePatchPreviewsQuery,
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
import { PricingUpgradeModal } from "@/components/agent-workspace/PricingUpgradeModal";
import { ProductBuilderWorkspace } from "@/components/agent-workspace/ProductBuilderWorkspace";
import { AgentArtifactsPanel } from "@/components/agent-workspace/AgentArtifactsPanel";
import { AgentResultBlock } from "@/components/agent-workspace/AgentResultBlock";
import { GovernanceStatusCompact } from "@/components/agent-workspace/GovernanceStatusCompact";
import type { AgentSessionResult } from "@/lib/agent-types";
import { classifyIntent } from "@/lib/agent-classifier";

const agentModes = [
  { id: "engineering", label: "Engineering" },
  { id: "business", label: "Business" },
  { id: "research", label: "Research" },
] as const;

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
  if (
    message.includes("ai_provider_unavailable") ||
    message.includes("No AI provider is configured")
  ) {
    return "AI provider is not configured yet. Add GEMINI_API_KEY, OPENROUTER_FREE_API_KEY, or GROQ_API_KEY, then retry.";
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

type ArtifactTab = "plan" | "changes" | "validation" | "report";

function ThreadView() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const qc = useQueryClient();
  const { t } = useLocale();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [mode, setMode] = useState<AgentMode>("engineering");
  const [input, setInput] = useState("");
  const [agentResult, setAgentResult] = useState<AgentSessionResult | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
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
  const { data: patchPreviews = [] } = usePatchPreviewsQuery(projectContextProjectId ?? null);
  const hasSafePreview = projectPreviews.length > 0;
  const hasIndexedFiles = projectFiles.length > 0;

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
  const busy = status === "submitted" || status === "streaming" || agentLoading;

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
  }, [messages, status, agentLoading]);

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
    setAgentResult(null);

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

    if (projectContextProjectId) {
      setAgentLoading(true);
      const intent = classifyIntent(text);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Unauthorized");

        const res = await fetch("/api/chat/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId: projectContextProjectId,
            userInstruction: text,
            maxContextBytes: 8000,
            intent: intent,
          }),
        });

        const apiData = (await res.json()) as AgentSessionResult;
        if (!res.ok) {
          throw new Error((apiData as { message?: string }).message || "Agent request failed");
        }
        setAgentResult(apiData);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent request failed.";
        toast.error(message);
      } finally {
        setAgentLoading(false);
      }
    } else {
      sendMessage({ text });
    }
  }

  const hasArtifacts =
    agentResult &&
    (agentResult.plan ||
      agentResult.patchProposals ||
      agentResult.validationPlan ||
      agentResult.finalReport);

  return (
    <>
      <div className="flex h-full min-w-0 flex-1 overflow-hidden bg-background">
        {/* LEFT PANEL: Project Explorer (compact) */}
        {leftPanelOpen && (
          <aside className="hidden xl:flex w-64 shrink-0 flex-col border-r border-border bg-surface/30 overflow-y-auto">
            <div className="border-b border-border px-3 py-2">
              <button
                onClick={() => setLeftPanelOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground"
                title="Collapse explorer"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <div className="flex-1 p-2">
              {projectContextProjectId ? (
                <div className="text-[11px] text-muted-foreground">
                  {projectContextName ?? "Project loaded"}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No project selected</div>
              )}
            </div>
          </aside>
        )}

        {/* CENTER: Chat (primary focus) */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
            {!projectContextProjectId && <ProductBuilderWorkspace onSelectPrompt={setInput} />}

            <div ref={scrollRef} className="space-y-4">
              {loadingMsgs && (
                <div className="font-mono text-xs text-muted-foreground">Loading session...</div>
              )}
              {!loadingMsgs && messages.length === 0 && projectContextProjectId && (
                <div className="text-center py-8">
                  <h2 className="text-lg font-semibold mb-2">Ask Nexus Core</h2>
                  <p className="text-sm text-muted-foreground">
                    Describe the changes you want to make to your project
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <MessageBlock key={m.id} message={m} />
              ))}
              {agentLoading && (
                <div className="flex items-center gap-2 text-[11px] text-accent">
                  <Loader2 className="size-3 animate-spin" />
                  Reading project context...
                </div>
              )}
              {!agentLoading && agentResult && agentNaturalResponse && (
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-accent">
                    <div className="size-1.5 rounded-full bg-accent" />
                    Nexus Agent
                  </div>
                  <AgentResultBlock
                    result={agentResult}
                    isLoading={false}
                    projectName={projectContextName}
                    hasIndexedFiles={hasIndexedFiles}
                    mode={mode}
                  />
                </div>
              )}
              {status === "submitted" && !agentLoading && !agentResult && (
                <div className="flex items-center gap-2 text-[11px] text-accent">
                  <Loader2 className="size-3 animate-spin" />
                  {t("initializingWorkspace")}
                </div>
              )}
            </div>
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
                placeholder="Ask Nexus Core..."
                disabled={isArchived}
                className="min-h-[100px] w-full resize-none rounded-xl border border-border bg-surface p-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
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

          <GovernanceStatusCompact
            hasSafePreview={hasSafePreview}
            hasIndexedFiles={hasIndexedFiles}
            isProjectIndexed={!!activeProjectManifest}
            hasPatchProposals={patchPreviews.length > 0}
            isArchived={isArchived}
          />
        </main>

        {/* RIGHT PANEL: Artifacts */}
        <aside
          className={`hidden xl:flex w-80 shrink-0 flex-col border-l border-border bg-surface/20`}
        >
          <AgentArtifactsPanel result={agentResult} isLoading={agentLoading} />
        </aside>
      </div>

      <PricingUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
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
      <AssistantMessage text={text} />
    </div>
  );
}

function AssistantMessage({ text }: { text: string }) {
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
    "Verification",
    "Handoff summary",
  ];

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

function stripCodeFence(s: string) {
  return s
    .replace(/^```[a-z]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

export type VerificationStatus = "passed" | "failed" | "warning" | "not_run" | "running";

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
