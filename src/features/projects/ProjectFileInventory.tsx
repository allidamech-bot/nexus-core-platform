import { FileText, Loader2 } from "lucide-react";
import type { ProjectFile } from "./types";

function formatSize(size: number | null) {
  if (size === null) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectFileInventory({
  files,
  loading,
}: {
  files: ProjectFile[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading inventory
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background/40 p-3 text-sm leading-relaxed text-muted-foreground">
        No file inventory has been generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-1 font-mono text-xs">
      {files.slice(0, 80).map((file) => (
        <div
          key={file.id}
          className="flex min-h-[36px] items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted"
        >
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{file.path}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatSize(file.size_bytes)}
          </span>
        </div>
      ))}
      {files.length > 80 && (
        <div className="px-2 pt-1 text-[10px] text-muted-foreground">
          Showing 80 of {files.length} indexed files.
        </div>
      )}
    </div>
  );
}
