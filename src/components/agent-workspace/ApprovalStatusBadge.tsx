import { cn } from "@/lib/utils";

const statusConfig = {
  approved: {
    label: "Approved",
    className:
      "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300",
  },
  pending_review: {
    label: "Pending Review",
    className:
      "rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-yellow-300",
  },
  rejected: {
    label: "Rejected",
    className:
      "rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-destructive",
  },
  blocked: {
    label: "Blocked",
    className:
      "rounded-lg border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-destructive",
  },
} as const;

interface ApprovalStatusBadgeProps {
  status: "approved" | "pending_review" | "rejected" | "blocked";
  className?: string;
}

export function ApprovalStatusBadge({ status, className }: ApprovalStatusBadgeProps) {
  const config = statusConfig[status];
  return <span className={cn(config.className, className)}>{config.label}</span>;
}
