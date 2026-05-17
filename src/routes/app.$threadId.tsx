import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Upload, GitBranch, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { agentModes, mockExecutionSteps, mockFileTree, mockVerification } from "@/lib/mock-data";
import type { AgentMode, FileNode, TaskStatus, VerificationStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$threadId")({
  component: ThreadView,
});

interface MessageRow {
  id: string;
  role: string;
  parts: unknown;
  created_at: string;
}

function ThreadView() {
  const { threadId } = Route.useParams();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<AgentMode>("engineering");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: thread } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
<<<<<<< HEAD
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .eq("id", threadId)
        .single();
=======
      const { data, error } = await supabase.from("threads").select("*").eq("id", threadId).single();
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
      if (error) throw error;
      return data;
    },
  });

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
        body: () => ({ mode }),
<<<<<<< HEAD
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
=======
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
      }),
    [mode],
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
    onError: (err) => toast.error(err.message ?? "Stream failed"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !session) return;
    setInput("");

    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    };
    await supabase.from("messages").insert({
      thread_id: threadId,
      user_id: session.user.id,
      role: "user",
      parts: userMsg.parts as never,
    });

    if ((messages?.length ?? 0) === 0) {
      const title = text.slice(0, 60);
      await supabase
        .from("threads")
        .update({ title, mode, updated_at: new Date().toISOString() })
        .eq("id", threadId);
      qc.invalidateQueries({ queryKey: ["threads"] });
    } else {
<<<<<<< HEAD
      await supabase
        .from("threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
=======
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
<<<<<<< HEAD
              Agent #{threadId.slice(0, 6)} / {mode}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:bg-white/5 flex items-center gap-1.5"
              disabled
            >
              <Upload className="size-3" /> Upload ZIP
            </button>
            <button
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:bg-white/5 flex items-center gap-1.5"
              disabled
            >
=======
              Agent #{threadId.slice(0, 6)} · {mode}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:bg-white/5 flex items-center gap-1.5" disabled>
              <Upload className="size-3" /> Upload ZIP
            </button>
            <button className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:bg-white/5 flex items-center gap-1.5" disabled>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
              <GitBranch className="size-3" /> Connect Repo
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {loadingMsgs && (
<<<<<<< HEAD
              <div className="text-xs text-muted-foreground font-mono">Loading session...</div>
=======
              <div className="text-xs text-muted-foreground font-mono">Loading session…</div>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
            )}
            {!loadingMsgs && messages.length === 0 && <EmptyChat />}
            {messages.map((m) => (
              <MessageBlock key={m.id} message={m} />
            ))}
            {status === "submitted" && (
              <div className="font-mono text-[11px] text-accent flex items-center gap-2">
<<<<<<< HEAD
                <Loader2 className="size-3 animate-spin" /> Initializing workspace...
=======
                <Loader2 className="size-3 animate-spin" /> Initializing workspace…
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
<<<<<<< HEAD
                placeholder="Ask Nexus Core to analyze, plan, fix, build, or verify..."
=======
                placeholder="Ask Nexus Core to analyze, plan, fix, build, or verify…"
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
                className="w-full bg-surface border border-border rounded-xl p-4 pr-28 text-sm focus:outline-none focus:ring-1 focus:ring-accent min-h-[100px] resize-none"
              />
              <button
                onClick={handleSend}
                disabled={busy || !input.trim()}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md text-[12px] font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Run
              </button>
            </div>
            <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
<<<<<<< HEAD
              Cmd/Ctrl + Enter to execute
=======
              ⌘ + Enter to execute
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
            </div>
          </div>
        </div>
      </section>

      <aside className="w-80 shrink-0 bg-surface/40 flex flex-col">
        <DrawerSection title="Files Changed">
          <FileTree nodes={mockFileTree} depth={0} />
        </DrawerSection>

        <DrawerSection title="Task Pipeline">
          <div className="space-y-3 relative ml-1.5 mt-1">
            <div className="absolute left-[-9px] top-1 bottom-1 w-px bg-border" />
            {mockExecutionSteps.map((s) => (
              <div key={s.id} className="relative flex items-center gap-3">
<<<<<<< HEAD
                <div
                  className={`size-2 rounded-full ring-4 ring-background ${statusDot(s.status)}`}
                />
                <span
                  className={`text-[11px] ${s.status === "completed" ? "text-zinc-400" : s.status === "running" ? "text-foreground" : "text-muted-foreground"}`}
                >
=======
                <div className={`size-2 rounded-full ring-4 ring-background ${statusDot(s.status)}`} />
                <span className={`text-[11px] ${s.status === "completed" ? "text-zinc-400" : s.status === "running" ? "text-foreground" : "text-muted-foreground"}`}>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title="Verification">
          <div className="space-y-2">
            {mockVerification.map((v) => (
              <div key={v.id} className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">{v.type}</span>
<<<<<<< HEAD
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${verifPill(v.status)}`}
                >
=======
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${verifPill(v.status)}`}>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
                  {v.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title="Approval Gates">
          <div className="p-3 rounded-md border border-warning/30 bg-warning/5">
            <div className="text-[11px] font-semibold text-warning mb-1">1 pending</div>
            <div className="text-[11px] text-zinc-400">Delete legacy session middleware</div>
            <div className="flex gap-1.5 mt-2">
<<<<<<< HEAD
              <button className="flex-1 text-[10px] font-semibold rounded bg-foreground text-background py-1">
                Approve
              </button>
              <button className="flex-1 text-[10px] font-semibold rounded border border-border py-1">
                Reject
              </button>
=======
              <button className="flex-1 text-[10px] font-semibold rounded bg-foreground text-background py-1">Approve</button>
              <button className="flex-1 text-[10px] font-semibold rounded border border-border py-1">Reject</button>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
      <div className="text-sm text-muted-foreground">
<<<<<<< HEAD
        Ask Nexus Core anything - it will respond with a structured plan, execution log, and
        verification.
=======
        Ask Nexus Core anything — it will respond with a structured plan,
        execution log, and verification.
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
      </div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto text-left">
        {[
          "Analyze this repository and propose a refactor of the auth layer.",
          "Generate a customer onboarding workflow for a B2B SaaS.",
          "Find startup issues in my Node service and fix them safely.",
          "Produce a Q3 sales report from the attached CSV.",
        ].map((p) => (
<<<<<<< HEAD
          <div
            key={p}
            className="p-3 rounded-lg border border-border bg-surface text-xs text-zinc-400"
          >
=======
          <div key={p} className="p-3 rounded-lg border border-border bg-surface text-xs text-zinc-400">
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBlock({ message }: { message: UIMessage }) {
<<<<<<< HEAD
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
=======
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852

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
  "Verification",
  "Final result",
];

function StructuredAssistant({ text }: { text: string }) {
<<<<<<< HEAD
  if (!text) return <div className="text-xs text-muted-foreground font-mono">Thinking...</div>;
=======
  if (!text) return <div className="text-xs text-muted-foreground font-mono">Thinking…</div>;
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852

  const sections: { name: string; body: string }[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  const indices: { name: string; index: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
<<<<<<< HEAD
    const sectionName = m[1]?.trim();
    if (sectionName && SECTION_NAMES.some((n) => n.toLowerCase() === sectionName.toLowerCase())) {
      indices.push({ name: sectionName, index: m.index, len: m[0].length });
=======
    if (SECTION_NAMES.some((n) => n.toLowerCase() === m[1].trim().toLowerCase())) {
      indices.push({ name: m[1].trim(), index: m.index, len: m[0].length });
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
  const isLog = name.toLowerCase() === "execution log";
  const isVerif = name.toLowerCase() === "verification";

  return (
    <section
      className={`rounded-lg border ${
<<<<<<< HEAD
        isRisk ? "border-destructive/30 bg-destructive/5" : "border-border bg-surface"
      } overflow-hidden`}
    >
      <header
        className={`px-4 py-2 border-b border-white/5 font-mono text-[10px] uppercase tracking-widest ${
          isRisk ? "text-destructive" : "text-accent"
        }`}
      >
=======
        isRisk
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-surface"
      } overflow-hidden`}
    >
      <header className={`px-4 py-2 border-b border-white/5 font-mono text-[10px] uppercase tracking-widest ${
        isRisk ? "text-destructive" : "text-accent"
      }`}>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
<<<<<<< HEAD
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
=======
  return s.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
}

function VerificationFromText({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map((l) => {
    const m = l.match(/(Typecheck|Lint(?:er|ing)?|Build|Tests?|Security(?: Scan)?|Performance)[^A-Z]*?(PASSED|FAILED|WARNING|NOT RUN|RUNNING)/i);
    if (!m) return { label: l.replace(/^[-*•\s]+/, ""), status: "not_run" as VerificationStatus };
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
<<<<<<< HEAD
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${verifPill(p.status)}`}
          >
=======
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${verifPill(p.status)}`}>
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
<<<<<<< HEAD
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
=======
              <span className="text-muted-foreground">▸</span>
            ) : (
              <span className={n.status === "added" ? "text-emerald-400" : n.status === "modified" ? "text-accent" : "text-muted-foreground"}>
                {n.status === "added" ? "+" : n.status === "modified" ? "~" : "·"}
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
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
<<<<<<< HEAD
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
=======
    case "completed": return "bg-emerald-500";
    case "running":
    case "verifying": return "bg-accent animate-pulse";
    case "failed": return "bg-destructive";
    case "awaiting_approval": return "bg-warning";
    default: return "bg-zinc-700";
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
  }
}

function verifPill(s: VerificationStatus): string {
  switch (s) {
<<<<<<< HEAD
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
=======
    case "passed": return "bg-emerald-500/10 text-emerald-400";
    case "failed": return "bg-destructive/10 text-destructive";
    case "warning": return "bg-warning/10 text-warning";
    case "running": return "bg-accent/10 text-accent";
    default: return "bg-white/5 text-muted-foreground";
>>>>>>> 2539edef339e3da35f548a966b4e08073deb6852
  }
}
