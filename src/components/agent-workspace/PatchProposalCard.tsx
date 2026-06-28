import type { PatchProposal } from "@/lib/agent-types";
import { cn } from "@/lib/utils";
import { ApprovalStatusBadge } from "@/components/agent-workspace/ApprovalStatusBadge";
import { RiskBadge } from "@/components/agent-workspace/RiskBadge";
import { DiffPreview } from "@/components/agent-workspace/DiffPreview";
import { ValidationSuggestions } from "@/components/agent-workspace/ValidationSuggestions";

interface PatchProposalCardProps {
  proposal: PatchProposal;
  className?: string;
}

export function PatchProposalCard({ proposal, className }: PatchProposalCardProps) {
  return (
    <div
      className={cn("space-y-3 rounded-xl border border-border bg-background/40 p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[11px] font-bold text-foreground">
              {proposal.target_file_path}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {proposal.change_summary}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <RiskBadge level={proposal.risk_level} />
          <ApprovalStatusBadge status={proposal.approval_status} />
        </div>
      </div>

      {proposal.blocked_reason && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {proposal.blocked_reason}
        </div>
      )}

      {proposal.risk_reasons && proposal.risk_reasons.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Risk Factors
          </span>
          <ul className="space-y-0.5">
            {proposal.risk_reasons.map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive/60" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DiffPreview unifiedDiff={proposal.unified_diff} filePath={proposal.target_file_path} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Before Preview
          </span>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-surface/30 p-2 text-[10px] font-mono leading-relaxed text-zinc-300">
            {proposal.before_preview || "\u00A0"}
          </pre>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            After Preview
          </span>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-surface/30 p-2 text-[10px] font-mono leading-relaxed text-zinc-300">
            {proposal.after_preview || "\u00A0"}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Confidence:{" "}
          <span className="font-mono font-bold text-foreground">
            {Math.round((proposal.agent_confidence ?? 0) * 100)}%
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          ID: <span className="font-mono text-foreground">{proposal.proposal_id}</span>
        </span>
      </div>

      <ValidationSuggestions suggestions={proposal.validation_suggestions} />
    </div>
  );
}
