import { FileSearch, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProjectTextPreviewWithPath } from "./types";
import { useLocale } from "@/features/i18n/localeContext";

export function ProjectTextPreviewPanel({
  previews,
  loading,
  selectedPreviewIds = [],
  onTogglePreview,
}: {
  previews: ProjectTextPreviewWithPath[];
  loading: boolean;
  selectedPreviewIds?: string[];
  onTogglePreview?: (preview: ProjectTextPreviewWithPath) => void;
}) {
  const [query, setQuery] = useState("");
  const { t } = useLocale();
  const filteredPreviews = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return previews;
    return previews.filter((preview) =>
      [preview.path, preview.summary, preview.detected_language ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [previews, query]);

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
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("filterPreviews")}
        className="mb-2 h-8 w-full rounded-md border border-border bg-background/60 px-2 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-muted-foreground focus:border-accent/40"
      />
      {filteredPreviews.slice(0, 8).map((preview) => {
        const selected = selectedPreviewIds.includes(preview.id);
        return (
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
              {onTogglePreview && (
                <button
                  type="button"
                  onClick={() => onTogglePreview(preview)}
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                    selected
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {selected ? t("selected") : t("select")}
                </button>
              )}
            </div>
            <pre className="mt-2 max-h-28 overflow-hidden rounded border border-white/5 bg-black/30 p-2 text-[10px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
              {preview.preview_text.slice(0, 700)}
            </pre>
          </div>
        );
      })}
      {filteredPreviews.length === 0 && (
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          {t("noPreviewMatch")}
        </div>
      )}
    </div>
  );
}
