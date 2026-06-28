import { cn } from "@/lib/utils";

const riskConfig = {
  low: {
    label: "Low",
    className:
      "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300",
  },
  medium: {
    label: "Medium",
    className:
      "rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-yellow-300",
  },
  high: {
    label: "High",
    className:
      "rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-orange-300",
  },
  blocked: {
    label: "Blocked",
    className:
      "rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-destructive",
  },
} as const;

interface RiskBadgeProps {
  level: "low" | "medium" | "high" | "blocked";
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = riskConfig[level];
  return <span className={cn(config.className, className)}>{config.label}</span>;
}
