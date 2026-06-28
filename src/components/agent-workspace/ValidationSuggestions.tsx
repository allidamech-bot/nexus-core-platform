import { cn } from "@/lib/utils";

interface ValidationSuggestionsProps {
  suggestions: string[];
  className?: string;
}

export function ValidationSuggestions({ suggestions, className }: ValidationSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Validation Suggestions
      </span>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((cmd, idx) => (
          <code
            key={idx}
            className="rounded-md border border-border/60 bg-surface/40 px-2 py-1 font-mono text-[10px] text-zinc-200"
          >
            {cmd}
          </code>
        ))}
      </div>
    </div>
  );
}
