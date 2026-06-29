import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GovernanceStatusCompactProps {
  hasSafePreview: boolean;
  hasIndexedFiles: boolean;
  isProjectIndexed: boolean;
  hasPatchProposals: boolean;
  isArchived?: boolean;
  className?: string;
}

export function GovernanceStatusCompact({
  hasSafePreview,
  hasIndexedFiles,
  isProjectIndexed,
  hasPatchProposals,
  isArchived,
  className,
}: GovernanceStatusCompactProps) {
  const statusSteps = [
    {
      label: "Files Indexed",
      done: hasIndexedFiles,
      icon: CheckCircle2,
    },
    {
      label: "Safe Preview Ready",
      done: hasSafePreview,
      icon: ShieldCheck,
    },
    {
      label: "Analysis Complete",
      done: hasPatchProposals,
      icon: FileCode2,
    },
  ];

  return (
    <div
      className={cn(
        "border-t border-border bg-surface/50 px-4 py-2 flex items-center justify-between text-[11px]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {isArchived && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="size-3" />
            <span>Archived</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {statusSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-1">
                <Icon
                  className={cn("size-3", step.done ? "text-emerald-400" : "text-muted-foreground")}
                />
                <span className={step.done ? "text-zinc-300" : "text-muted-foreground"}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ShieldCheck className="size-3" />
        <span>Read-only proposals</span>
      </div>
    </div>
  );
}
