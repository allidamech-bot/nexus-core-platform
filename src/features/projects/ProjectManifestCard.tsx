import { Boxes, Code2, FolderTree } from "lucide-react";
import type { ProjectManifest } from "./types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectManifestCard({ manifest }: { manifest: ProjectManifest | null }) {
  if (!manifest) {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
        Manifest pending. Upload processing will surface stack hints and file inventory here.
      </div>
    );
  }

  const stack = [...manifest.frameworks, ...manifest.languages].slice(0, 4);

  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-white/5 bg-white/[0.03] p-2">
          <Boxes className="mb-1 size-3 text-accent" />
          <div className="font-mono text-[11px] text-zinc-200">{manifest.file_count}</div>
          <div className="text-[10px] text-muted-foreground">files</div>
        </div>
        <div className="rounded border border-white/5 bg-white/[0.03] p-2">
          <FolderTree className="mb-1 size-3 text-accent" />
          <div className="font-mono text-[11px] text-zinc-200">{manifest.directory_count}</div>
          <div className="text-[10px] text-muted-foreground">dirs</div>
        </div>
        <div className="rounded border border-white/5 bg-white/[0.03] p-2">
          <Code2 className="mb-1 size-3 text-accent" />
          <div className="font-mono text-[11px] text-zinc-200">
            {formatBytes(manifest.total_size_bytes)}
          </div>
          <div className="text-[10px] text-muted-foreground">indexed</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Stack</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(stack.length > 0 ? stack : ["Unknown"]).map((item) => (
              <span
                key={item}
                className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        {manifest.package_managers.length > 0 && (
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Package manager: {manifest.package_managers.join(", ")}
          </div>
        )}
        {manifest.skipped_file_count > 0 && (
          <div className="text-[10px] text-warning">
            {manifest.skipped_file_count} archive entries skipped by safety policy.
          </div>
        )}
      </div>
    </div>
  );
}
