import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Terminal, Send, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocale } from "@/features/i18n/localeContext";
import { ProjectActionCard } from "@/components/agent-workspace/ProjectActionCard";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { checkQuota } from "@/features/governance/governanceService";
import { governanceKeys } from "@/features/governance/governanceQueries";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

type ComposerStatus = "idle" | "creating" | "quota" | "error" | "auth";

function friendlyCreateSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (lower.includes("max_active_threads") || lower.includes("quota") || lower.includes("limit")) {
    return "sessionQuotaReached" as const;
  }

  if (lower.includes("auth") || lower.includes("jwt") || lower.includes("unauthorized")) {
    return "sessionAuthRequired" as const;
  }

  return "sessionCreateFailed" as const;
}

function isMissingThreadLifecycleColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return lower.includes("status") || lower.includes("archived_at");
}

function AppIndex() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t } = useLocale();
  const { activeProject } = useProjectWorkspace();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ComposerStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const { data: recentThreads = [] } = useQuery({
    enabled: Boolean(session?.user.id),
    queryKey: ["threads", "recent", session?.user.id],
    queryFn: async () => {
      if (!session?.user.id) return [];
      const { data, error } = await supabase
        .from("threads")
        .select("id,title,updated_at")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error && isMissingThreadLifecycleColumns(error)) {
        const fallback = await supabase
          .from("threads")
          .select("id,title,updated_at")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false })
          .limit(5);
        if (fallback.error) throw fallback.error;
        return fallback.data ?? [];
      }
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  function setComposerStatus(nextStatus: ComposerStatus, message: string) {
    setStatus(nextStatus);
    setStatusMessage(message);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;

    if (!session) {
      const message = t("sessionAuthRequired");
      setComposerStatus("auth", message);
      toast.error(message);
      return;
    }

    setBusy(true);
    setComposerStatus("creating", t("creatingSession"));

    try {
      const quota = await checkQuota(session.user.id, "max_active_threads", 1);
      if (!quota.allowed) {
        const message = `${t("sessionQuotaReached")} ${t("archiveExistingSessionToStartNewTask")}`;
        setComposerStatus("quota", message);
        toast.error(message);
        return;
      }

      const title = text.slice(0, 60);
      const { data: thread, error: threadError } = await supabase
        .from("threads")
        .insert({ user_id: session.user.id, title, mode: "engineering" })
        .select()
        .single();

      if (threadError) {
        const messageKey = friendlyCreateSessionError(threadError);
        throw new Error(t(messageKey));
      }

      const { error: msgError } = await supabase.from("messages").insert({
        thread_id: thread.id,
        user_id: session.user.id,
        role: "user",
        parts: [{ type: "text", text }] as never,
      });

      if (msgError) {
        throw new Error(t("sessionMessageSaveFailed"));
      }

      setComposerStatus("idle", "");
      qc.invalidateQueries({ queryKey: ["threads", "recent", session.user.id] });
      qc.invalidateQueries({ queryKey: governanceKeys.usage(session.user.id) });
      navigate({ to: "/app/$threadId", params: { threadId: thread.id } });
    } catch (err) {
      const friendlyMessages = [
        t("sessionQuotaReached"),
        t("sessionCreateFailed"),
        t("sessionMessageSaveFailed"),
        t("sessionAuthRequired"),
      ];
      const rawMessage = err instanceof Error ? err.message : "";
      const message = friendlyMessages.includes(rawMessage)
        ? rawMessage
        : t(friendlyCreateSessionError(err));
      const nextStatus = message === t("sessionQuotaReached") ? "quota" : "error";
      setComposerStatus(nextStatus, message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-background px-3 pb-[calc(80px+env(safe-area-inset-bottom))] pt-6 md:items-center md:px-6 md:pb-6 md:pt-4">
      <div className="w-full max-w-none min-w-0 space-y-5 md:my-auto md:max-w-3xl md:space-y-8">
        <div className="flex w-full min-w-0 flex-col items-start pt-0 text-left md:items-center md:pt-2 md:text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent shadow-sm">
            🔒 SECURE GOVERNED PIPELINE
          </div>
          <h1
            dir="auto"
            className="w-full max-w-full break-words text-[1.45rem] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl md:leading-tight lg:text-4xl"
          >
            Welcome to Nexus Core Secure Workspace
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:mx-auto md:text-base">
            Autonomous AI patching under strict corporate governance. Your source code remains 100% immutable.
          </p>
        </div>

        {activeProject &&
          (activeProject.status === "failed" ||
            activeProject.latest_job?.status === "failed" ||
            activeProject.latest_job?.status === "rejected") && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive mb-4">
                لا يمكن بدء جلسة جديدة. يرجى حذف المشروع أو رفع نسخة جديدة.
              </p>
              <ProjectActionCard />
            </div>
          )}
        {!(
          activeProject &&
          (activeProject.status === "failed" ||
            activeProject.latest_job?.status === "failed" ||
            activeProject.latest_job?.status === "rejected")
        ) && (
          <div className="hidden md:block rounded-2xl border border-border bg-surface-elevated/80 p-3 shadow-xl md:p-4">
            <div className="relative min-w-0">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (status !== "creating") setComposerStatus("idle", "");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("tellNexusToChange")}
                className="min-h-[120px] w-full resize-none rounded-xl border border-border bg-background/70 p-4 text-base leading-relaxed shadow-sm placeholder:text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-accent md:pb-4 md:pr-32 md:text-sm"
                dir="auto"
              />
              <button
                onClick={handleSend}
                disabled={busy || !input.trim()}
                className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90 disabled:opacity-50 md:absolute md:bottom-3 md:right-3 md:mt-0 md:min-h-[44px] md:w-auto md:rounded-lg"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {t("createAiSession") || "Send"}
              </button>
            </div>
            <div className="mt-3 text-center text-[12px] font-medium text-muted-foreground">
              Cmd/Ctrl + Enter to send / {t("nexusHelperText")}
            </div>
          </div>
        )}

        {/* Theme-Aware Visual Stepper */}
        {!(
          activeProject &&
          (activeProject.status === "failed" ||
            activeProject.latest_job?.status === "failed" ||
            activeProject.latest_job?.status === "rejected")
        ) && (
          <div className="hidden md:flex mt-6 flex-col gap-4 rounded-2xl border border-border bg-surface-elevated/50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            {[
              { num: 1, label: "AI Chat", active: true },
              { num: 2, label: "Safe Preview", active: false },
              { num: 3, label: "Patch Review", active: false },
              { num: 4, label: "Secure Export", active: false },
            ].map((step, idx, arr) => (
              <div key={idx} className="flex flex-1 items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-6 place-items-center rounded-full text-xs font-bold transition-colors ${
                      step.active
                        ? "bg-accent text-accent-foreground glow-accent"
                        : "bg-surface border border-border text-muted-foreground"
                    }`}
                  >
                    {step.num}
                  </span>
                  <span
                    className={`text-sm font-semibold tracking-tight transition-colors ${
                      step.active ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className="hidden h-px flex-1 bg-border sm:block mx-3"></div>
                )}
              </div>
            ))}
          </div>
        )}

        {status !== "idle" && (
          <div
            role={status === "creating" ? "status" : "alert"}
            className={`-mt-6 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
              status === "creating"
                ? "border-border bg-surface/60 text-muted-foreground"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {status === "creating" ? (
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
            ) : (
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p>{statusMessage}</p>
              {(status === "quota" || status === "error") && recentThreads.length > 0 && (
                <Link
                  to="/app/$threadId"
                  params={{ threadId: recentThreads[0].id }}
                  className="inline-flex text-foreground underline underline-offset-4"
                >
                  {t("openExistingSession")}
                </Link>
              )}
            </div>
          </div>
        )}

        {recentThreads.length > 0 && (
          <div className="rounded-3xl border border-border bg-surface-elevated p-5 md:p-6 shadow-sm">
            <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("openRecentSession")}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {recentThreads.map((thread) => (
                <div
                  key={thread.id}
                  className="flex flex-col gap-3 min-h-[88px] max-w-full rounded-2xl border border-border bg-background p-4 shadow-sm transition-colors hover:border-accent/50"
                >
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {thread.title || t("untitled")}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t("activeSession") || "Active"} • {new Date(thread.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Link
                    to="/app/$threadId"
                    params={{ threadId: thread.id }}
                    className="flex min-h-[44px] items-center justify-center rounded-xl bg-accent/10 px-4 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/20 active:bg-accent/30"
                  >
                    {t("viewPatch") || "View Patch"}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {!(
          activeProject &&
          (activeProject.status === "failed" ||
            activeProject.latest_job?.status === "failed" ||
            activeProject.latest_job?.status === "rejected")
        ) && (
          <div className="hidden md:grid mt-5 min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
            {[
              t("examplePrompt1"),
              t("examplePrompt2"),
              t("examplePrompt3"),
              t("examplePrompt4"),
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => setInput(prompt)}
                className="group min-h-[88px] rounded-2xl border border-border bg-surface p-4 text-start text-sm leading-relaxed text-foreground shadow-sm transition-colors hover:bg-surface-elevated"
              >
                <span className="mb-2 inline-grid size-7 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Send className="size-3.5" />
                </span>
                <span className="block font-medium">{prompt}</span>
              </button>
            ))}
          </div>
        )}

        {!activeProject && session && <ProjectActionCard />}
      </div>
    </div>
  );
}
