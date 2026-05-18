import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Upload, GitBranch, Loader2, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { agentModes, mockExecutionSteps, mockFileTree, mockVerification } from "@/lib/mock-data";
import type { AgentMode, FileNode, TaskStatus, VerificationStatus } from "@/lib/types";
import { toast } from "sonner";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectManifestCard } from "@/features/projects/ProjectManifestCard";
import { ProjectFileInventory } from "@/features/projects/ProjectFileInventory";
import { ProjectTextPreviewPanel } from "@/features/projects/ProjectTextPreviewPanel";
import { getProjectManifest } from "@/features/projects/projectManifest";
import { useProjectFilesQuery } from "@/features/projects/projectQueries";
import {
  attachProjectToThread,
  logThreadContextSelection,
} from "@/features/projects/projectService";
import type { ProjectTextPreviewWithPath } from "@/features/projects/types";
import { useUsageOverviewQuery } from "@/features/governance/governanceQueries";
import {
  estimateByteSize,
  recordAuditEvent,
  recordUsageEvent,
} from "@/features/governance/governanceService";

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
  const { session } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<AgentMode>("engineering");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    activeProject,
    activeProjectPreviews,
    activeProjectPreviewsLoading,
    selectedPreviewIds,
    setSelectedPreviewIds,
    setSelectedProjectId,
  } = useProjectWorkspace();
  const activeProjectManifest = useMemo(() => getProjectManifest(activeProject), [activeProject]);
  const { data: projectFiles = [], isLoading: projectFilesLoading } = useProjectFilesQuery(
    activeProject?.id ?? null,
  );
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

  const { messages, sendMessage, status } = useChat({
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  async function handleAttachProject() {
    if (!session || !activeProject) return;
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
    if (!session || !activeProject) return;
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
        projectId: activeProject.id,
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
        projectId: activeProject.id,
        eventType: "context_preview_selected",
        sizeBytes: estimateByteSize(preview.preview_text),
        tokenEstimate: preview.token_estimate,
        metadata: { path: preview.path },
      }).catch(() => {});
    }

    await logThreadContextSelection({
      threadId,
      projectId: activeProject.id,
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
    <div className="flex-1 flex min-w-0 h-full">
      <section className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="h-14 px-6 flex items-center justify-between border-b border-border bg-surface/30">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{thread?.title ?? "Session"}</div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Agent #{threadId.slice(0, 6)} / {mode}
              {activeProject ? ` / ${activeProject.name}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <ProjectUploadDialog
                userId={session.user.id}
                trigger={
                  <button
                    type="button"
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:bg-white/5 flex items-center gap-1.5"
                  >
                    <Upload className="size-3" /> Upload ZIP
                  </button>
                }
              />
            )}
            <button
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:bg-white/5 flex items-center gap-1.5"
              disabled
            >
              <GitBranch className="size-3" /> Connect Repo
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {loadingMsgs && (
              <div className="text-xs text-muted-foreground font-mono">Loading session...</div>
            )}
            {!loadingMsgs && messages.length === 0 && <EmptyChat />}
            {messages.map((m) => (
              <MessageBlock key={m.id} message={m} />
            ))}
            {status === "submitted" && (
              <div className="font-mono text-[11px] text-accent flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" /> Initializing workspace...
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-background px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-1.5 mb-3 overflow-x-auto">
              {agentModes.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id as AgentMode)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors ${
                      active
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "bg-white/5 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="relative">
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
                className="w-full bg-surface border border-border rounded-xl p-4 pr-28 text-sm focus:outline-none focus:ring-1 focus:ring-accent min-h-[100px] resize-none"
              />
              <button
                onClick={handleSend}
                disabled={busy || !input.trim()}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md text-[12px] font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Send
              </button>
            </div>
            <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Cmd/Ctrl + Enter to send
            </div>
          </div>
        </div>
      </section>

      <aside className="w-80 shrink-0 bg-surface/40 flex flex-col">
        <DrawerSection title="Active Project">
          {activeProject ? (
            <div className="rounded-md border border-accent/20 bg-accent/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-xs font-semibold text-zinc-200">
                  {activeProject.name}
                </div>
                <ProjectStatusBadge
                  status={activeProject.latest_job?.status ?? activeProject.status}
                />
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {activeProject.source_type} / ingestion{" "}
                {activeProject.latest_job?.status.replace("_", " ") ?? "not started"}
              </div>
              <button
                type="button"
                onClick={handleAttachProject}
                disabled={threadProjectId === activeProject.id}
                className="mt-3 w-full rounded border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {threadProjectId === activeProject.id ? "Attached to session" : "Attach to session"}
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
              No project attached. Upload a ZIP to give Nexus Core safe project metadata.
            </div>
          )}
        </DrawerSection>

        <DrawerSection title="Project Summary">
          <ProjectManifestCard manifest={activeProjectManifest} />
        </DrawerSection>

        {activeProject && (
          <DrawerSection title="Project Health">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <StatusMetric
                label="Files"
                value={projectFilesLoading ? "..." : projectFiles.length.toString()}
              />
              <StatusMetric
                label="Previews"
                value={
                  activeProjectPreviewsLoading ? "..." : activeProjectPreviews.length.toString()
                }
              />
              <StatusMetric
                label="Ingestion"
                value={activeProject.latest_job?.status.replace("_", " ") ?? activeProject.status}
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
                      index <= 2 && activeProject.latest_job?.status === "completed"
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

        <DrawerSection title={activeProject ? "File Inventory" : "Example file scope"}>
          {activeProject ? (
            <ProjectFileInventory files={projectFiles} loading={projectFilesLoading} />
          ) : (
            <FileTree nodes={mockFileTree} depth={0} />
          )}
        </DrawerSection>

        {activeProject && (
          <DrawerSection title="Safe Text Previews">
            <ProjectTextPreviewPanel
              previews={activeProjectPreviews}
              loading={activeProjectPreviewsLoading}
              selectedPreviewIds={selectedPreviewIds}
              onTogglePreview={handleTogglePreview}
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
                  className={`text-[11px] ${s.status === "completed" ? "text-zinc-400" : s.status === "running" ? "text-foreground" : "text-muted-foreground"}`}
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
                <span className="text-xs text-zinc-300">{v.type}</span>
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
            <div className="text-[11px] font-semibold text-zinc-200 mb-1">Pre-execution mode</div>
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              Nexus can analyze manifest and preview context, but cannot execute commands, install
              dependencies, modify files, or open pull requests in this phase.
            </div>
          </div>
        </DrawerSection>
      </aside>
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
        <Terminal className="size-4" />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">Start with a scoped request.</h2>
      <div className="text-sm text-muted-foreground">
        Nexus will answer with structured planning, risks, file scope, and verification guidance. It
        will not execute code or mutate your project.
      </div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto text-left">
        {[
          "Analyze this repository and propose a refactor of the auth layer.",
          "Generate a customer onboarding workflow for a B2B SaaS.",
          "Summarize the selected preview files and identify architecture risks.",
          "Draft a safe Phase 2 implementation plan from the active project manifest.",
        ].map((p) => (
          <div
            key={p}
            className="p-3 rounded-lg border border-border bg-surface text-xs text-zinc-400"
          >
            {p}
          </div>
        ))}
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
      <div className="mt-1 truncate text-xs font-semibold text-zinc-200">{value}</div>
    </div>
  );
}

function MessageBlock({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-accent">
        <div className="size-1.5 rounded-full bg-accent" />
        Nexus Core
      </div>
      <StructuredAssistant text={text} />
    </div>
  );
}

const SECTION_NAMES = [
  "Understanding",
  "Plan",
  "Risks",
  "Files to inspect or change",
  "Proposed actions",
  "Execution log",
  "Readiness log",
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
    return <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{text}</div>;
  }
  indices.forEach((it, i) => {
    const start = it.index + it.len;
    const end = i + 1 < indices.length ? indices[i + 1].index : text.length;
    sections.push({ name: it.name, body: text.slice(start, end).trim() });
  });

  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <SectionBlock key={i} name={s.name} body={s.body} />
      ))}
    </div>
  );
}

function SectionBlock({ name, body }: { name: string; body: string }) {
  const isRisk = name.toLowerCase().startsWith("risk");
  const isLog = ["execution log", "readiness log"].includes(name.toLowerCase());
  const isVerif = name.toLowerCase() === "verification";

  return (
    <section
      className={`rounded-lg border ${
        isRisk ? "border-destructive/30 bg-destructive/5" : "border-border bg-surface"
      } overflow-hidden`}
    >
      <header
        className={`px-4 py-2 border-b border-white/5 font-mono text-[10px] uppercase tracking-widest ${
          isRisk ? "text-destructive" : "text-accent"
        }`}
      >
        {name}
      </header>
      <div className="p-4">
        {isLog ? (
          <pre className="font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed bg-black/40 rounded p-3 border border-white/5">
            {stripCodeFence(body)}
          </pre>
        ) : isVerif ? (
          <VerificationFromText text={body} />
        ) : (
          <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{body}</div>
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
          <span className="text-zinc-300">{p.label}</span>
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
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5"
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
            <span className={n.type === "dir" ? "text-zinc-300" : "text-zinc-400"}>{n.name}</span>
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
      return "bg-zinc-700";
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
      return "bg-white/5 text-muted-foreground";
  }
}
