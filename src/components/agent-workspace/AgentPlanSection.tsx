import type { AgentPlan } from "@/lib/agent-types";
import { cn } from "@/lib/utils";

interface AgentPlanSectionProps {
  plan: AgentPlan;
  className?: string;
}

export function AgentPlanSection({ plan, className }: AgentPlanSectionProps) {
  return (
    <div
      className={cn("space-y-3 rounded-xl border border-border bg-background/40 p-4", className)}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
          Agent Plan
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{plan.summary}</p>
      {plan.steps && plan.steps.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Steps
          </span>
          <ol className="space-y-2">
            {plan.steps.map((step) => (
              <li
                key={step.order}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/30 p-3"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                  {step.order}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-foreground">{step.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {step.targetFiles && step.targetFiles.length > 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Files:{" "}
                        {step.targetFiles.map((f) => (
                          <code key={f} className="text-foreground">
                            {f}
                          </code>
                        ))}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      Complexity:{" "}
                      <span
                        className={
                          step.estimatedComplexity === "high"
                            ? "font-bold text-orange-300"
                            : step.estimatedComplexity === "medium"
                              ? "font-bold text-yellow-300"
                              : "font-bold text-emerald-300"
                        }
                      >
                        {step.estimatedComplexity}
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
