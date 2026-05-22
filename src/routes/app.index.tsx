import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Terminal, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocale } from "@/features/i18n/localeContext";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t } = useLocale();
  const { activeProject } = useProjectWorkspace();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !session) return;
    setBusy(true);

    try {
      const title = text.slice(0, 60);
      const { data: thread, error: threadError } = await supabase
        .from("threads")
        .insert({ user_id: session.user.id, title, mode: "engineering" })
        .select()
        .single();

      if (threadError) throw threadError;

      const { error: msgError } = await supabase.from("messages").insert({
        thread_id: thread.id,
        user_id: session.user.id,
        role: "user",
        parts: [{ type: "text", text }] as never,
      });

      if (msgError) throw msgError;

      navigate({ to: "/app/$threadId", params: { threadId: thread.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background overflow-y-auto">
      <div className="w-full max-w-3xl space-y-10 my-auto">
        <div className="text-center">
          <div className="mx-auto mb-6 grid size-12 place-items-center rounded-2xl border border-border bg-surface text-foreground shadow-sm">
            <Terminal className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("tellNexusToChange")}
          </h1>
        </div>

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("tellNexusToChange")}
            className="w-full bg-surface border border-border rounded-xl p-4 pr-28 text-sm focus:outline-none focus:ring-1 focus:ring-accent min-h-[120px] resize-none shadow-sm"
            dir="auto"
          />
          <button
            onClick={handleSend}
            disabled={busy || !input.trim()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-md text-[13px] font-bold disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {t("createAiSession") || "Send"}
          </button>
        </div>

        <div className="text-center text-xs text-muted-foreground font-medium">
          {t("nexusHelperText")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
          {[t("examplePrompt1"), t("examplePrompt2"), t("examplePrompt3"), t("examplePrompt4")].map(
            (prompt, i) => (
              <button
                key={i}
                onClick={() => setInput(prompt)}
                className="text-start p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {prompt}
              </button>
            ),
          )}
        </div>

        {!activeProject && session && (
          <div className="pt-8 flex justify-center">
            <ProjectUploadDialog
              userId={session.user.id}
              trigger={
                <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                  {t("uploadOrImport")}
                </button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
