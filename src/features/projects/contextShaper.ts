import type { ProjectContextPreview, ProjectManifest, ProjectTextPreview } from "./types";

const CONTEXT_CHAR_LIMIT = 8_000;
const CONTEXT_PREVIEW_LIMIT = 6;

export function shapeProjectPreviewsForContext(
  previews: Array<ProjectTextPreview & { path?: string | null }>,
): ProjectContextPreview[] {
  const shaped: ProjectContextPreview[] = [];
  let usedChars = 0;

  for (const preview of previews.slice(0, CONTEXT_PREVIEW_LIMIT)) {
    const path = preview.path ?? "unknown";
    const remaining = CONTEXT_CHAR_LIMIT - usedChars;
    if (remaining <= 0) break;

    const previewText = preview.preview_text.slice(0, Math.min(remaining, 1_500));
    usedChars += previewText.length;

    shaped.push({
      path,
      summary: preview.summary,
      detected_language: preview.detected_language,
      preview_text: previewText,
      truncated: preview.truncated || preview.preview_text.length > previewText.length,
      token_estimate: Math.ceil(previewText.length / 4),
    });
  }

  return shaped;
}

export function manifestContextLine(manifest: ProjectManifest | null | undefined): string {
  if (!manifest) return "manifest: not generated";
  return [
    `manifest: ${manifest.file_count} files`,
    `frameworks: ${manifest.frameworks.join(", ") || "unknown"}`,
    `languages: ${manifest.languages.join(", ") || "unknown"}`,
    `package_managers: ${manifest.package_managers.join(", ") || "unknown"}`,
  ].join("; ");
}
