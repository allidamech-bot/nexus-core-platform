import type { ProjectFile, ProjectTextPreviewWithPath } from "./types";
import {
  buildPatchPreviewForTextReplacement,
  PatchPreviewValidationError,
  truncateDiffForDisplay,
  validatePatchPreviewTarget,
} from "./patchDiff";
import type {
  GroundedPatchChange,
  GroundedPatchFile,
  PatchPreviewWarning,
} from "./patchPreviewTypes";

export const AI_PATCH_LIMITS = {
  maxSelectedFiles: 5,
  maxPreviewBytesPerFile: 6_000,
  maxTotalPromptPreviewBytes: 20_000,
  maxChanges: 10,
  maxDiffDisplayChars: 40_000,
  maxInstructionChars: 2_000,
  maxAiOutputBytes: 80_000,
};

export interface AiPatchPreviewTarget {
  file: ProjectFile;
  preview: ProjectTextPreviewWithPath;
}

export interface AiPatchPreviewInput {
  projectId: string;
  instruction: string;
  targets: AiPatchPreviewTarget[];
}

export interface AiPatchOutputChange {
  filePath: string;
  oldText: string;
  newText: string;
  reason?: string;
}

export interface AiPatchOutput {
  summary: string;
  changes: AiPatchOutputChange[];
  warnings?: PatchPreviewWarning[];
}

export interface ValidatedAiPatchPreview {
  summary: string;
  groundedFiles: GroundedPatchFile[];
  changes: GroundedPatchChange[];
  warnings: PatchPreviewWarning[];
}

export function estimateUtf8Bytes(value: string) {
  return new TextEncoder().encode(value).length;
}

export function stripJsonEnvelope(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function parseWarnings(value: unknown): PatchPreviewWarning[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, AI_PATCH_LIMITS.maxChanges).flatMap((item) => {
    const record = asRecord(item);
    const code = boundedString(record.code, 80) || "ai_warning";
    const message = boundedString(record.message, 500);
    if (!message) return [];
    const filePath = boundedString(record.filePath, 500);
    return [{ code, message, ...(filePath ? { filePath } : {}) }];
  });
}

export function parseAiPatchOutput(raw: string): AiPatchOutput {
  if (estimateUtf8Bytes(raw) > AI_PATCH_LIMITS.maxAiOutputBytes) {
    throw new PatchPreviewValidationError(
      "AI output could not be validated.",
      "ai_output_too_large",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonEnvelope(raw));
  } catch {
    throw new PatchPreviewValidationError(
      "AI output could not be validated.",
      "ai_output_invalid_json",
    );
  }

  const record = asRecord(parsed);
  const changesValue = record.changes;
  if (!Array.isArray(changesValue) || changesValue.length === 0) {
    throw new PatchPreviewValidationError(
      "AI output could not be validated.",
      "ai_output_empty_changes",
    );
  }
  if (changesValue.length > AI_PATCH_LIMITS.maxChanges) {
    throw new PatchPreviewValidationError(
      "AI output could not be validated.",
      "ai_output_too_many_changes",
    );
  }

  const changes = changesValue.map((item) => {
    const change = asRecord(item);
    return {
      filePath: boundedString(change.filePath, 500),
      oldText: boundedString(change.oldText, AI_PATCH_LIMITS.maxPreviewBytesPerFile),
      newText: boundedString(change.newText, AI_PATCH_LIMITS.maxPreviewBytesPerFile),
      reason: boundedString(change.reason, 500),
    };
  });

  if (changes.some((change) => !change.filePath || !change.oldText || !change.newText)) {
    throw new PatchPreviewValidationError(
      "AI output could not be validated.",
      "ai_output_incomplete_change",
    );
  }

  return {
    summary: boundedString(record.summary, 1_000) || "AI-grounded patch preview.",
    changes,
    warnings: parseWarnings(record.warnings),
  };
}

export function enforceAiPatchInputLimits(
  input: Pick<AiPatchPreviewInput, "instruction" | "targets">,
) {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new PatchPreviewValidationError("Describe the change you want.", "instruction_required");
  }
  if (instruction.length > AI_PATCH_LIMITS.maxInstructionChars) {
    throw new PatchPreviewValidationError("Instruction is too long.", "instruction_too_long");
  }
  if (input.targets.length === 0) {
    throw new PatchPreviewValidationError(
      "Select at least one previewable file.",
      "no_previewable_files_selected",
    );
  }
  if (input.targets.length > AI_PATCH_LIMITS.maxSelectedFiles) {
    throw new PatchPreviewValidationError("Too many files selected.", "too_many_files_selected");
  }

  const totalPreviewBytes = input.targets.reduce(
    (sum, target) =>
      sum +
      estimateUtf8Bytes(
        target.preview.preview_text.slice(0, AI_PATCH_LIMITS.maxPreviewBytesPerFile),
      ),
    0,
  );
  if (totalPreviewBytes > AI_PATCH_LIMITS.maxTotalPromptPreviewBytes) {
    throw new PatchPreviewValidationError(
      "Preview generation is limited to indexed text.",
      "prompt_preview_limit_exceeded",
    );
  }
}

export function buildAiPatchPrompt(input: AiPatchPreviewInput) {
  enforceAiPatchInputLimits(input);

  const files = input.targets.map((target) => ({
    fileId: target.file.id,
    path: target.file.path,
    contentSha256: target.file.content_sha256,
    checksum: target.file.checksum,
    isText: target.file.is_text,
    isPreviewable: target.file.is_previewable,
    skipped: target.file.skipped,
    previewText: target.preview.preview_text.slice(0, AI_PATCH_LIMITS.maxPreviewBytesPerFile),
    previewTruncated: target.preview.truncated,
  }));

  return `You are generating a read-only grounded patch preview for Nexus Core.

Project id: ${input.projectId}
User instruction: ${input.instruction.trim()}

Rules:
- Use only the selected files below.
- Return structured JSON only. No markdown, no prose outside JSON.
- Do not create, delete, rename, or apply files.
- Only propose modify changes for selected previewable text files.
- Do not modify binary, skipped, sensitive, unavailable, or unselected files.
- Each change must include filePath, oldText, newText, and reason.
- oldText must exist exactly in the provided previewText.
- Use preview text only; do not infer unavailable content.
- The patch is preview-only and must not be described as applied.

JSON schema:
{"summary":"string","changes":[{"filePath":"string","oldText":"string","newText":"string","reason":"string"}],"warnings":[{"code":"string","message":"string","filePath":"string optional"}]}

Selected files:
${JSON.stringify(files, null, 2)}`;
}

export function validateAiPatchOutput(
  output: AiPatchOutput,
  targets: AiPatchPreviewTarget[],
): ValidatedAiPatchPreview {
  const targetByPath = new Map(targets.map((target) => [target.file.path, target]));
  const groundedByFileId = new Map<string, GroundedPatchFile>();
  const changes: GroundedPatchChange[] = [];
  const warnings: PatchPreviewWarning[] = [
    ...(output.warnings ?? []),
    {
      code: "selected_files_only",
      message: "Only selected files were used.",
    },
  ];
  let totalDiffChars = 0;

  for (const change of output.changes) {
    const target = targetByPath.get(change.filePath);
    if (!target) {
      throw new PatchPreviewValidationError(
        "AI tried to modify an unavailable file.",
        "ai_file_not_selected",
      );
    }

    const targetValidation = validatePatchPreviewTarget(target.file, target.preview);
    if (!targetValidation.allowed) {
      throw new PatchPreviewValidationError(
        "This file cannot be patched.",
        targetValidation.reason ?? "invalid_target",
      );
    }

    const built = buildPatchPreviewForTextReplacement({
      file: target.file,
      preview: target.preview,
      oldText: change.oldText,
      newText: change.newText,
    });
    const truncated = truncateDiffForDisplay(
      built.change.unifiedDiff,
      AI_PATCH_LIMITS.maxDiffDisplayChars,
    );
    totalDiffChars += truncated.diff.length;
    if (totalDiffChars > AI_PATCH_LIMITS.maxDiffDisplayChars) {
      throw new PatchPreviewValidationError(
        "Preview generation is limited to indexed text.",
        "diff_limit_exceeded",
      );
    }

    const changeWarnings = [
      ...built.change.warnings,
      ...(change.reason
        ? [{ code: "ai_change_reason", message: change.reason, filePath: change.filePath }]
        : []),
      ...(target.file.path.toLowerCase().endsWith("package.json") &&
      /"scripts"\s*:/.test(`${change.oldText}\n${change.newText}`)
        ? [
            {
              code: "package_scripts_preview_only",
              message: "AI proposed a package script change; this is preview-only.",
              filePath: change.filePath,
            },
          ]
        : []),
      ...(truncated.truncated
        ? [
            {
              code: "diff_truncated",
              message: "Preview truncated for safety.",
              filePath: change.filePath,
            },
          ]
        : []),
    ];

    groundedByFileId.set(built.groundedFile.fileId, built.groundedFile);
    changes.push({
      ...built.change,
      unifiedDiff: truncated.diff,
      warnings: changeWarnings,
    });
    warnings.push(...changeWarnings);
  }

  return {
    summary: output.summary,
    groundedFiles: Array.from(groundedByFileId.values()),
    changes,
    warnings,
  };
}
