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
        <div className="w-full min-w-0 pt-2 text-left md:text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-accent/20 bg-accent/10 text-accent shadow-sm md:mx-auto md:mb-6">
            <Terminal className="size-6" />
          </div>
          <h1 className="w-full text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {!activeProject
              ? "ابدأ بربط مشروعك مع Nexus"
              : activeProject.status === "failed" ||
                  activeProject.latest_job?.status === "failed" ||
                  activeProject.latest_job?.status === "rejected"
                ? "المشروع الحالي فشل في المعالجة"
                : activeProject.status === "indexed_manifest" ||
                    activeProject.status === "completed"
                  ? "ماذا تريد أن يفعل Nexus في مشروعك؟"
                  : "المشروع موجود لكن السياق غير جاهز بالكامل"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:mx-auto md:text-base">
            {t("nexusHelperText")}
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
          <div className="rounded-2xl border border-border bg-surface-elevated/80 p-3 shadow-xl md:p-4">
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
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("openRecentSession")}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {recentThreads.map((thread) => (
                <Link
                  key={thread.id}
                  to="/app/$threadId"
                  params={{ threadId: thread.id }}
                  className="min-h-[44px] max-w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-elevated sm:max-w-56"
                >
                  <span className="block truncate">{thread.title || t("untitled")}</span>
                </Link>
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
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
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
