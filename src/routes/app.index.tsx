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
    <div className="flex-1 flex min-w-0 flex-col items-stretch justify-center overflow-x-hidden overflow-y-auto bg-background px-3 py-4 md:items-center md:px-6">
      <div className="my-auto w-full max-w-none min-w-0 space-y-6 sm:space-y-10 md:max-w-3xl">
        <div className="w-full min-w-0 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-surface text-foreground shadow-sm sm:mb-6">
            <Terminal className="size-6" />
          </div>
          <h1 className="w-full text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl lg:text-3xl">
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
              className="min-h-[132px] w-full resize-none rounded-xl border border-border bg-surface p-4 text-base shadow-sm focus:outline-none focus:ring-1 focus:ring-accent md:min-h-[120px] md:pb-4 md:pr-32 md:text-sm"
              dir="auto"
            />
            <button
              onClick={handleSend}
              disabled={busy || !input.trim()}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-[13px] font-bold text-background transition-colors disabled:opacity-50 md:absolute md:bottom-3 md:right-3 md:mt-0 md:w-auto"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t("createAiSession") || "Send"}
            </button>
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

        <div className="text-center text-xs text-muted-foreground font-medium">
          {t("nexusHelperText")}
        </div>

        {recentThreads.length > 0 && (
          <div className="-mt-2 flex min-w-0 flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="min-h-[32px] content-center">{t("openRecentSession")}</span>
            {recentThreads.map((thread) => (
              <Link
                key={thread.id}
                to="/app/$threadId"
                params={{ threadId: thread.id }}
                className="min-h-[36px] max-w-full truncate rounded-md border border-border bg-surface/50 px-3 py-2 text-foreground hover:bg-surface sm:max-w-48 sm:py-1"
              >
                {thread.title || t("untitled")}
              </Link>
            ))}
          </div>
        )}

        {!(
          activeProject &&
          (activeProject.status === "failed" ||
            activeProject.latest_job?.status === "failed" ||
            activeProject.latest_job?.status === "rejected")
        ) && (
          <div className="mt-6 grid min-w-0 grid-cols-1 gap-3 sm:mt-8 md:grid-cols-2">
            {[
              t("examplePrompt1"),
              t("examplePrompt2"),
              t("examplePrompt3"),
              t("examplePrompt4"),
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => setInput(prompt)}
                className="min-h-[72px] rounded-xl border border-border bg-surface/50 p-4 text-start text-sm leading-relaxed text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {!activeProject && session && <ProjectActionCard />}
      </div>
    </div>
  );
}
