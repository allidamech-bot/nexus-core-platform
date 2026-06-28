import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, FileCode2, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { AgentSessionResult } from "@/lib/agent-types";
import { AgentPlanSection } from "@/components/agent-workspace/AgentPlanSection";
import { AgentFinalReportSection } from "@/components/agent-workspace/AgentFinalReportSection";
import { PatchProposalCard } from "@/components/agent-workspace/PatchProposalCard";
import { ValidationSuggestions } from "@/components/agent-workspace/ValidationSuggestions";
import { RiskBadge } from "@/components/agent-workspace/RiskBadge";
import { ApprovalStatusBadge } from "@/components/agent-workspace/ApprovalStatusBadge";

interface AgentWorkspacePanelProps {
  projectId: string;
  className?: string;
}

type WorkspaceState = "idle" | "loading" | "ready" | "error";

export function AgentWorkspacePanel({ projectId, className }: AgentWorkspacePanelProps) {
  const { session } = useAuth();
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<WorkspaceState>("idle");
  const [result, setResult] = useState<AgentSessionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: readiness } = useQuery({
    queryKey: ["agent-workspace-readiness"],
    queryFn: async () => {
      const res = await fetch("/api/projects/agent-workspace");
      if (!res.ok) throw new Error("Failed to check readiness");
      return res.json();
    },
    retry: false,
  });

  const runMutation = useMutation({
    mutationFn: async (userInstruction: string) => {
      const { data: sessionData } = await (
        await import("@/integrations/supabase/client")
      ).supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Unauthorized");

      const body = {
        projectId,
        userInstruction,
        maxContextBytes: 8000,
      };

      const res = await fetch("/api/projects/agent-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const apiData = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          (apiData as { message?: string }).message || "Agent workspace request failed",
        );
      }
      return apiData as unknown as AgentSessionResult;
    },
    onMutate: () => {
      setState("loading");
      setResult(null);
      setErrorMessage("");
    },
    onSuccess: (data) => {
      setResult(data);
      setState("ready");
      if (data.status === "error") {
        toast.error("Agent session completed with errors.");
      } else {
        toast.success("Nexus Core AI analysis complete.");
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Agent workspace failed.";
      setErrorMessage(message);
      setState("error");
      toast.error(message);
    },
  });

  function handleRun() {
    if (!instruction.trim()) {
      toast.error("Please enter an instruction for Nexus Core AI.");
      return;
    }
    if (runMutation.isPending) return;
    runMutation.mutate(instruction.trim());
  }

  const readinessData = readiness as
    | {
        aiStatus?: string;
        providerReadiness?: Array<{ configured: boolean; readinessStatus: string }>;
      }
    | undefined;

  const configuredProvidersCount =
    readinessData?.providerReadiness?.filter((p) => p.configured).length ?? 0;
  const hasNeedsLiveCheck =
    readinessData?.providerReadiness?.some((p) => p.readinessStatus === "needs_live_check") ??
    false;
  const isProviderNotConfigured = configuredProvidersCount === 0;
  const patchProposalsCount = result?.patchProposals?.proposals?.length ?? 0;
  const hasBlockedProposals =
    result?.patchProposals?.proposals?.some((p) => p.risk_level === "blocked") ?? false;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
            Nexus Agent Workspace
          </span>
        </div>

        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          User Instruction
        </label>
        <textarea
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            if (state !== "loading") setState("idle");
          }}
          placeholder="Describe what Nexus Core AI should analyze, plan, or propose changes for..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleRun();
            }
          }}
          className="min-h-[80px] w-full rounded-xl border border-border bg-background/70 p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={runMutation.isPending || isProviderNotConfigured}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground">Cmd/Ctrl + Enter to run</span>
          <button
            type="button"
            onClick={handleRun}
            disabled={runMutation.isPending || isProviderNotConfigured || !instruction.trim()}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-4 py-2 text-[13px] font-bold text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {runMutation.isPending ? "Running Nexus Core AI..." : "Run Nexus Core AI"}
          </button>
        </div>
      </div>

      {state === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface/50 p-8">
          <Loader2 className="size-8 animate-spin text-accent" />
          <p className="text-sm font-medium text-muted-foreground">
            Analyzing project and generating proposals...
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Analysis Failed</p>
              <p className="mt-1 text-xs leading-relaxed text-destructive/80">
                {errorMessage || "An unexpected error occurred. Please try again."}
              </p>
            </div>
          </div>
        </div>
      )}

      {isProviderNotConfigured && state === "idle" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">AI Provider Not Configured</p>
              <p className="mt-1 text-xs leading-relaxed text-destructive/80">
                Configure at least one AI provider environment variable ( GEMINI_API_KEY,
                OPENROUTER_FREE_API_KEY, or GROQ_API_KEY) to enable the Nexus Agent workspace.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isProviderNotConfigured && hasNeedsLiveCheck && state === "idle" && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-300" />
            <div>
              <p className="text-sm font-medium text-yellow-200">
                Nexus Core AI Provider Configured
              </p>
              <p className="mt-1 text-xs leading-relaxed text-yellow-100/80">
                Provider is configured and ready for live verification. You can run an analysis now.
              </p>
            </div>
          </div>
        </div>
      )}

      {state === "ready" && result && (
        <div className="space-y-4">
          {result.plan && <AgentPlanSection plan={result.plan} />}

          {patchProposalsCount === 0 && (
            <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
              <FileCode2 className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">
                No Patch Proposals Generated
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nexus Core AI analyzed the project but did not identify specific file changes to
                propose within the current context.
              </p>
            </div>
          )}

          {patchProposalsCount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Patch Proposals ({patchProposalsCount})
                </span>
                <div className="flex items-center gap-2">
                  {result.patchProposals?.summary && (
                    <>
                      <RiskBadge level="low" />
                      <span className="text-[10px] text-muted-foreground">
                        {result.patchProposals.summary.low} low
                      </span>
                      <RiskBadge level="medium" />
                      <span className="text-[10px] text-muted-foreground">
                        {result.patchProposals.summary.medium} medium
                      </span>
                      <RiskBadge level="high" />
                      <span className="text-[10px] text-muted-foreground">
                        {result.patchProposals.summary.high} high
                      </span>
                      {result.patchProposals.summary.blocked > 0 && (
                        <>
                          <RiskBadge level="blocked" />
                          <span className="text-[10px] text-muted-foreground">
                            {result.patchProposals.summary.blocked} blocked
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              {result.patchProposals?.proposals.map((proposal) => (
                <PatchProposalCard key={proposal.proposal_id} proposal={proposal} />
              ))}
            </div>
          )}

          {result.proposedChanges &&
            result.proposedChanges.length > 0 &&
            !result.patchProposals && (
              <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
                <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Proposals Ready for Review
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {result.proposedChanges.length} changes were suggested. Patch proposals are being
                  processed for review.
                </p>
              </div>
            )}

          {result.validationPlan && (
            <div className="space-y-2 rounded-xl border border-border bg-background/40 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Validation Suggestions
              </span>
              <ValidationSuggestions suggestions={result.validationPlan.commands} />
              {result.validationPlan.explanation && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {result.validationPlan.explanation}
                </p>
              )}
            </div>
          )}

          {result.finalReport && <AgentFinalReportSection report={result.finalReport} />}

          <div className="rounded-md border border-border/60 bg-surface/30 px-3 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Review Status:</span> All proposals
              are read-only and ready for human review. No changes have been applied to source
              files.
              {hasBlockedProposals && (
                <span className="ml-1 font-semibold text-destructive">
                  {" "}
                  Some proposals require governance approval before proceeding.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {state === "ready" && !result && (
        <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Provider Failure After Fallback
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            No AI provider was available to process the request. Check provider configuration and
            retry.
          </p>
        </div>
      )}
    </div>
  );
}
