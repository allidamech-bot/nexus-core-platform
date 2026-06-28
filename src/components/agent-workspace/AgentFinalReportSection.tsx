import { useMemo } from "react";
import type { AgentFinalReport } from "@/lib/agent-types";
import { cn } from "@/lib/utils";
import { RiskBadge } from "@/components/agent-workspace/RiskBadge";

interface AgentFinalReportSectionProps {
  report: AgentFinalReport;
  className?: string;
}

export function AgentFinalReportSection({ report, className }: AgentFinalReportSectionProps) {
  const displaySummary = useMemo(() => {
    const text = report.summary;
    if (!text) return text;
    try {
      const trimmed = text.trim();
      if (trimmed.startsWith("```json")) {
        const jsonText = trimmed.slice(7).replace(/```$/, "").trim();
        const parsed = JSON.parse(jsonText);
        if (
          typeof parsed === "object" &&
          parsed &&
          typeof (parsed as Record<string, unknown>).summary === "string"
        ) {
          return String((parsed as Record<string, unknown>).summary);
        }
      }
      if (trimmed.startsWith("```")) {
        const firstNewline = trimmed.indexOf("\n");
        if (firstNewline !== -1) {
          const jsonText = trimmed
            .slice(firstNewline + 1)
            .replace(/```$/, "")
            .trim();
          const parsed = JSON.parse(jsonText);
          if (
            typeof parsed === "object" &&
            parsed &&
            typeof (parsed as Record<string, unknown>).summary === "string"
          ) {
            return String((parsed as Record<string, unknown>).summary);
          }
        }
      }
      const directParse = JSON.parse(trimmed);
      if (
        typeof directParse === "object" &&
        directParse &&
        typeof (directParse as Record<string, unknown>).summary === "string"
      ) {
        return String((directParse as Record<string, unknown>).summary);
      }
    } catch {
      // return raw text as fallback
    }
    return text;
  }, [report.summary]);

  return (
    <div
      className={cn("space-y-4 rounded-xl border border-border bg-background/40 p-4", className)}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
          Final Report
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{displaySummary}</p>

      {report.risks && report.risks.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Identified Risks
          </span>
          <ul className="space-y-1">
            {report.risks.map((risk, idx) => (
              <li
                key={idx}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"
              >
                <span className="mt-1 size-1 shrink-0 rounded-full bg-destructive/60" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.plan && report.plan.steps && report.plan.steps.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Plan Summary
          </span>
          <p className="text-xs leading-relaxed text-foreground">{report.plan.summary}</p>
        </div>
      )}

      {report.proposedChanges && report.proposedChanges.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Proposed Changes ({report.proposedChanges.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {report.proposedChanges.map((change, idx) => (
              <span
                key={idx}
                className="rounded-md border border-border bg-surface/40 px-2 py-1 text-[10px] font-mono text-foreground"
              >
                {change.filePath}
              </span>
            ))}
          </div>
        </div>
      )}

      {report.validationPlan &&
        report.validationPlan.commands &&
        report.validationPlan.commands.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Validation
            </span>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {report.validationPlan.explanation}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {report.validationPlan.commands.map((cmd, idx) => (
                <code
                  key={idx}
                  className="rounded-md border border-border/60 bg-surface/40 px-2 py-1 font-mono text-[10px] text-zinc-200"
                >
                  {cmd}
                </code>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
