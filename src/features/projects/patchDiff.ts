import type { ProjectFile, ProjectTextPreviewWithPath } from "./types";
import type {
  GroundedPatchChange,
  GroundedPatchFile,
  GroundedPatchHunk,
  PatchPreviewWarning,
} from "./patchPreviewTypes";
import { isSensitivePreviewPath } from "./projectFileTree";

const MAX_DIFF_CHARS = 12000;

export class PatchPreviewValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "PatchPreviewValidationError";
  }
}

export interface PatchPreviewTargetValidation {
  allowed: boolean;
  reason?: string;
  warnings: PatchPreviewWarning[];
}

export function createPatchPreviewWarnings(input: {
  filePath: string;
  previewLimited?: boolean;
}): PatchPreviewWarning[] {
  return input.previewLimited
    ? [
        {
          code: "preview_limited",
          message: "Preview is limited to indexed text.",
          filePath: input.filePath,
        },
      ]
    : [];
}

export function validatePatchPreviewTarget(
  file: ProjectFile | null | undefined,
  preview?: ProjectTextPreviewWithPath | null,
): PatchPreviewTargetValidation {
  if (!file) return { allowed: false, reason: "file_not_found", warnings: [] };
  if (file.skipped) return { allowed: false, reason: "skipped_file", warnings: [] };
  if (!file.is_text) return { allowed: false, reason: "binary_file", warnings: [] };
  if (!file.is_previewable) return { allowed: false, reason: "not_previewable", warnings: [] };
  if (isSensitivePreviewPath(file.path)) {
    return { allowed: false, reason: "sensitive_file", warnings: [] };
  }
  if (!preview?.preview_text) {
    return { allowed: false, reason: "preview_unavailable", warnings: [] };
  }

  return {
    allowed: true,
    warnings: createPatchPreviewWarnings({
      filePath: file.path,
      previewLimited: true,
    }),
  };
}

function lineNumberForIndex(text: string, index: number) {
  return text.slice(0, index).split("\n").length;
}

function countLines(text: string) {
  if (!text) return 0;
  return text.split("\n").length;
}

function diffLine(value: string, prefix: string) {
  return `${prefix}${value}`;
}

export function truncateDiffForDisplay(diff: string, maxChars = MAX_DIFF_CHARS) {
  if (diff.length <= maxChars) return { diff, truncated: false };
  return {
    diff: `${diff.slice(0, maxChars)}\n... diff truncated for safety ...`,
    truncated: true,
  };
}

export function createUnifiedDiffPreview(input: {
  filePath: string;
  oldText: string;
  newText: string;
  previewText: string;
}) {
  const matchIndex = input.previewText.indexOf(input.oldText);
  if (matchIndex < 0) {
    throw new PatchPreviewValidationError(
      "Old text was not found in the available preview.",
      "old_text_not_found",
    );
  }

  const oldStart = lineNumberForIndex(input.previewText, matchIndex);
  const oldLines = input.oldText.split("\n");
  const newLines = input.newText.split("\n");
  const hunk: GroundedPatchHunk = {
    oldStart,
    oldLines: countLines(input.oldText),
    newStart: oldStart,
    newLines: countLines(input.newText),
    lines: [
      ...oldLines.map((line) => diffLine(line, "-")),
      ...newLines.map((line) => diffLine(line, "+")),
    ],
  };

  const diff = [
    `--- a/${input.filePath}`,
    `+++ b/${input.filePath}`,
    `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    ...hunk.lines,
  ].join("\n");

  return { unifiedDiff: diff, hunks: [hunk] };
}

export function buildPatchPreviewForTextReplacement(input: {
  file: ProjectFile;
  preview: ProjectTextPreviewWithPath;
  oldText: string;
  newText: string;
}): {
  groundedFile: GroundedPatchFile;
  change: GroundedPatchChange;
  warnings: PatchPreviewWarning[];
} {
  const oldText = input.oldText.trim();
  if (!oldText) {
    throw new PatchPreviewValidationError("Search text is required.", "old_text_required");
  }
  if (input.newText === input.oldText) {
    throw new PatchPreviewValidationError("Replacement text must change the preview.", "no_change");
  }

  const validation = validatePatchPreviewTarget(input.file, input.preview);
  if (!validation.allowed) {
    throw new PatchPreviewValidationError(
      "This file cannot be patched.",
      validation.reason ?? "invalid_target",
    );
  }

  const diff = createUnifiedDiffPreview({
    filePath: input.file.path,
    oldText: input.oldText,
    newText: input.newText,
    previewText: input.preview.preview_text,
  });
  const truncated = truncateDiffForDisplay(diff.unifiedDiff);
  const warnings = [
    ...validation.warnings,
    ...(truncated.truncated
      ? [
          {
            code: "diff_truncated",
            message: "Preview truncated for safety.",
            filePath: input.file.path,
          },
        ]
      : []),
  ];

  return {
    groundedFile: {
      fileId: input.file.id,
      path: input.file.path,
      contentSha256: input.file.content_sha256,
      isPreviewable: input.file.is_previewable,
      sourcePreviewAvailable: true,
    },
    change: {
      filePath: input.file.path,
      changeType: "modify",
      oldText: input.oldText,
      newText: input.newText,
      unifiedDiff: truncated.diff,
      hunks: diff.hunks,
      warnings,
    },
    warnings,
  };
}
