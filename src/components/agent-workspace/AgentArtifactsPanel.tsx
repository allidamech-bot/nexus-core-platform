import type {
  AgentPlan,
  AgentSessionResult,
  PatchProposalBundle,
  AgentValidationPlan,
  AgentFinalReport,
} from "@/lib/agent-types";
import { AgentPlanSection } from "./AgentPlanSection";
import { ValidationSuggestions } from "./ValidationSuggestions";
import { AgentFinalReportSection } from "./AgentFinalReportSection";
import { RiskBadge } from "./RiskBadge";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { DiffPreview } from "./DiffPreview";
import { cn } from "@/lib/utils";
import { FileCode2, Copy } from "lucide-react";
import { useState } from "react";

interface AgentArtifactsPanelProps {
  result: AgentSessionResult | null;
  isLoading: boolean;
  className?: string;
}

type ArtifactTab = "plan" | "changes" | "validation" | "report";

export function AgentArtifactsPanel({ result, isLoading, className }: AgentArtifactsPanelProps) {
  const [activeTab, setActiveTab] = useState<ArtifactTab>("plan");

  if (!result && !isLoading) {
    return null;
  }

  const hasPlan = result?.plan && result.plan.steps.length > 0;
  const hasProposals = result?.patchProposals && result.patchProposals.proposals.length > 0;
  const hasValidation = result?.validationPlan && result.validationPlan.commands.length > 0;
  const hasReport = result?.finalReport;

  const hasAnyArtifacts = hasPlan || hasProposals || hasValidation || hasReport;

  if (!hasAnyArtifacts && !isLoading) {
    return null;
  }

  return (
    <div className={cn("flex flex-col h-full min-w-0", className)}>
      <div className="border-b border-border bg-surface/95 px-3 py-2">
        <div className="flex items-center gap-1">
          {hasPlan && (
            <TabButton active={activeTab === "plan"} onClick={() => setActiveTab("plan")}>
              Plan
            </TabButton>
          )}
          {hasProposals && (
            <TabButton active={activeTab === "changes"} onClick={() => setActiveTab("changes")}>
              Changes ({result.patchProposals?.proposals.length})
            </TabButton>
          )}
          {hasValidation && (
            <TabButton
              active={activeTab === "validation"}
              onClick={() => setActiveTab("validation")}
            >
              Validation
            </TabButton>
          )}
          {hasReport && (
            <TabButton active={activeTab === "report"} onClick={() => setActiveTab("report")}>
              Report
            </TabButton>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === "plan" && result?.plan && <AgentPlanSection plan={result.plan} />}

        {activeTab === "changes" && result?.patchProposals && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Risk Summary
              </span>
              <div className="flex items-center gap-1.5">
                {result.patchProposals.summary.low > 0 && (
                  <>
                    <RiskBadge level="low" />
                    <span className="text-[10px] text-muted-foreground">
                      {result.patchProposals.summary.low}
                    </span>
                  </>
                )}
                {result.patchProposals.summary.medium > 0 && (
                  <>
                    <RiskBadge level="medium" />
                    <span className="text-[10px] text-muted-foreground">
                      {result.patchProposals.summary.medium}
                    </span>
                  </>
                )}
                {result.patchProposals.summary.high > 0 && (
                  <>
                    <RiskBadge level="high" />
                    <span className="text-[10px] text-muted-foreground">
                      {result.patchProposals.summary.high}
                    </span>
                  </>
                )}
              </div>
            </div>
            {result.patchProposals.proposals.map((proposal) => (
              <CompactPatchCard key={proposal.proposal_id} proposal={proposal} />
            ))}
          </div>
        )}

        {activeTab === "validation" && result?.validationPlan && (
          <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Validation Commands
            </span>
            <ValidationSuggestions suggestions={result.validationPlan.commands} />
            {result.validationPlan.explanation && (
              <p className="text-xs leading-relaxed text-muted-foreground mt-2">
                {result.validationPlan.explanation}
              </p>
            )}
          </div>
        )}

        {activeTab === "report" && result?.finalReport && (
          <AgentFinalReportSection report={result.finalReport} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
        active
          ? "bg-accent/10 text-accent border border-accent/20"
          : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
      )}
    >
      {children}
    </button>
  );
}

interface CompactPatchCardProps {
  proposal: NonNullable<AgentSessionResult["patchProposals"]>["proposals"][0];
}

function CompactPatchCard({ proposal }: CompactPatchCardProps) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-foreground truncate" dir="ltr">
            {proposal.target_file_path}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground mt-1 line-clamp-2">
            {proposal.change_summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <RiskBadge level={proposal.risk_level} />
          <ApprovalStatusBadge status={proposal.approval_status} />
        </div>
      </div>

      {proposal.blocked_reason && (
        <div className="text-[10px] text-destructive bg-destructive/10 rounded px-2 py-1">
          {proposal.blocked_reason}
        </div>
      )}

      {proposal.risk_reasons.length > 0 && (
        <details className="text-[10px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {proposal.risk_reasons.length} risk factor{proposal.risk_reasons.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-1 space-y-1 pl-2">
            {proposal.risk_reasons.map((r, i) => (
              <li key={i} className="text-muted-foreground">
                • {r}
              </li>
            ))}
          </ul>
        </details>
      )}

      {proposal.unified_diff && (
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="flex items-center gap-1.5 text-[10px] text-accent hover:underline"
        >
          <Copy className="size-3" />
          {showDiff ? "Hide diff" : "View diff"}
        </button>
      )}

      {showDiff && proposal.unified_diff && (
        <div className="border border-border rounded bg-surface/30 p-2 max-h-48 overflow-y-auto">
          <pre className="font-mono text-[9px] text-zinc-300 whitespace-pre-wrap">
            {proposal.unified_diff}
          </pre>
        </div>
      )}
    </div>
  );
}
