import { FileSearch, Loader2 } from "lucide-react";
import type { ProjectTextPreviewWithPath } from "./types";

export function ProjectTextPreviewPanel({
  previews,
  loading,
}: {
  previews: ProjectTextPreviewWithPath[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading safe previews
      </div>
    );
  }

  if (previews.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
        No safe text previews indexed yet. Small allowlisted files will appear here after ingestion.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {previews.slice(0, 6).map((preview) => (
        <div key={preview.id} className="rounded-md border border-border bg-background/45 p-3">
          <div className="flex items-start gap-2">
            <FileSearch className="mt-0.5 size-3 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[11px] text-zinc-200">{preview.path}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {preview.summary}
                {preview.truncated ? " / truncated" : ""}
              </div>
            </div>
          </div>
          <pre className="mt-2 max-h-28 overflow-hidden rounded border border-white/5 bg-black/30 p-2 text-[10px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
            {preview.preview_text.slice(0, 700)}
          </pre>
        </div>
      ))}
    </div>
  );
}
