import { useState } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DiffPreviewProps {
  unifiedDiff: string;
  filePath?: string;
  className?: string;
}

export function DiffPreview({ unifiedDiff, filePath, className }: DiffPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(unifiedDiff);
      toast.success("Diff copied to clipboard");
    } catch {
      toast.error("Failed to copy diff");
    }
  };

  const lines = unifiedDiff.split("\n");

  const formatLine = (line: string, index: number) => {
    let colorClass = "text-zinc-300";
    if (line.startsWith("+") && !line.startsWith("+++")) {
      colorClass = "text-emerald-400";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      colorClass = "text-destructive";
    } else if (line.startsWith("@@")) {
      colorClass = "text-accent font-semibold";
    } else if (line.startsWith("+++") || line.startsWith("---")) {
      colorClass = "text-muted-foreground";
    }

    return (
      <div
        key={index}
        className={cn("px-2 py-0.5 text-[11px] font-mono leading-relaxed", colorClass)}
      >
        <span className="mr-2 inline-block w-8 shrink-0 select-none text-right text-zinc-600">
          {index + 1}
        </span>
        <span className="whitespace-pre-wrap break-all">{line || "\u00A0"}</span>
      </div>
    );
  };

  return (
    <div className={cn("rounded-xl border border-border bg-surface/50", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Unified Diff
          </button>
          {filePath && (
            <span className="truncate font-mono text-[10px] text-muted-foreground">{filePath}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
        >
          <Copy className="size-3" />
          Copy
        </button>
      </div>
      {isExpanded && (
        <div className="max-h-80 overflow-y-auto whitespace-pre-wrap break-all">
          {lines.map((line, i) => formatLine(line, i))}
        </div>
      )}
    </div>
  );
}
