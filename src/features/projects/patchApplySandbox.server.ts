import { isSensitivePreviewPath } from "./projectFileTree";
import type { GroundedPatchChange, GroundedPatchPreview, PatchPreviewWarning } from "./types";
import type { ProjectFile, ProjectTextPreviewWithPath } from "./types";
import { runCommand } from "../execution/commandRunner.server";
import "@tanstack/react-start/server-only";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = fs;
const { join } = path;
const { tmpdir } = os;

const SANDBOX_PREVIEW_LIMIT = 12_000;
const SANDBOX_DIFF_DISPLAY_LIMIT = 40_000;

import type {
  PatchSandboxStatus,
  PatchSandboxIssue,
  PatchSandboxFileResult,
  PatchSandboxSummary,
  PatchSandboxResult,
  PatchSandboxContext,
} from "./patchSandboxTypes";

function issue(input: {
  code: string;
  message: string;
  filePath?: string;
  severity: "warning" | "blocker";
}): PatchSandboxIssue {
  return input;
}

function countOccurrences(text: string, search: string) {
  if (!search) return 0;
  let count = 0;
  let index = text.indexOf(search);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(search, index + search.length);
  }
  return count;
}

export function truncateSandboxPreview(text: string, limit = SANDBOX_PREVIEW_LIMIT) {
  if (text.length <= limit) return { text, truncated: false };
  return {
    text: `${text.slice(0, limit)}\n... sandbox preview truncated for safety ...`,
    truncated: true,
  };
}

export function detectStalePreview(input: {
  groundedHash: string | null | undefined;
  currentHash: string | null | undefined;
  filePath: string;
}): PatchSandboxIssue[] {
  if (!input.groundedHash || !input.currentHash || input.groundedHash === input.currentHash) {
    return [];
  }
  return [
    issue({
      code: "current_hash_mismatch",
      message: "Current file hash differs from patch grounding.",
      filePath: input.filePath,
      severity: "blocker",
    }),
  ];
}

export function detectPatchConflicts(input: {
  change: GroundedPatchChange;
  currentText: string;
}): PatchSandboxIssue[] {
  const occurrences = countOccurrences(input.currentText, input.change.oldText);
  if (occurrences === 0) {
    return [
      issue({
        code: "old_text_not_found",
        message: "Old text was not found in the current indexed preview.",
        filePath: input.change.filePath,
        severity: "blocker",
      }),
    ];
  }
  if (occurrences > 1) {
    return [
      issue({
        code: "old_text_ambiguous",
        message: "Old text appears multiple times.",
        filePath: input.change.filePath,
        severity: "blocker",
      }),
    ];
  }
  if (input.change.unifiedDiff.length > SANDBOX_DIFF_DISPLAY_LIMIT) {
    return [
      issue({
        code: "patch_diff_too_large",
        message: "Patch diff is too large for display.",
        filePath: input.change.filePath,
        severity: "warning",
      }),
    ];
  }
  return [];
}

export function createSandboxWarnings(input: {
  preview: ProjectTextPreviewWithPath | null;
  filePath: string;
}): PatchSandboxIssue[] {
  return [
    issue({
      code: "sandbox_preview_text_only",
      message: "Sandbox is limited to indexed preview text.",
      filePath: input.filePath,
      severity: "warning",
    }),
    ...(input.preview?.truncated
      ? [
          issue({
            code: "indexed_preview_truncated",
            message: "Current indexed preview is truncated.",
            filePath: input.filePath,
            severity: "warning",
          }),
        ]
      : []),
  ];
}

function validateCurrentTarget(input: {
  file: ProjectFile | null;
  preview: ProjectTextPreviewWithPath | null;
  filePath: string;
}): PatchSandboxIssue[] {
  if (!input.file) {
    return [
      issue({
        code: "target_file_missing",
        message: "Missing target file.",
        filePath: input.filePath,
        severity: "blocker",
      }),
    ];
  }
  if (input.file.skipped) {
    return [
      issue({
        code: "target_file_skipped",
        message: "Target file became skipped.",
        filePath: input.file.path,
        severity: "blocker",
      }),
    ];
  }
  if (!input.file.is_text) {
    return [
      issue({
        code: "binary_file",
        message: "Binary files cannot be sandboxed as text.",
        filePath: input.file.path,
        severity: "blocker",
      }),
    ];
  }
  if (!input.file.is_previewable) {
    return [
      issue({
        code: "target_not_previewable",
        message: "Target file is no longer previewable.",
        filePath: input.file.path,
        severity: "blocker",
      }),
    ];
  }
  if (isSensitivePreviewPath(input.file.path)) {
    return [
      issue({
        code: "sensitive_file",
        message: "Sensitive files cannot be sandboxed.",
        filePath: input.file.path,
        severity: "blocker",
      }),
    ];
  }
  if (!input.preview?.preview_text) {
    return [
      issue({
        code: "indexed_preview_missing",
        message: "Missing indexed preview text.",
        filePath: input.file.path,
        severity: "blocker",
      }),
    ];
  }
  return [];
}

function sortChanges(changes: GroundedPatchChange[]) {
  return changes
    .map((change, index) => ({ change, index }))
    .sort((a, b) => a.change.filePath.localeCompare(b.change.filePath) || a.index - b.index);
}

export function buildSandboxFileResult(input: {
  filePath: string;
  contentSha256: string | null;
  oldPreviewText: string;
  sandboxPatchedText: string;
  changesApplied: number;
  changesBlocked: number;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
  previewLimited: boolean;
}): PatchSandboxFileResult {
  const oldPreview = truncateSandboxPreview(input.oldPreviewText);
  const patchedPreview = truncateSandboxPreview(input.sandboxPatchedText);
  return {
    filePath: input.filePath,
    contentSha256: input.contentSha256,
    oldPreviewText: oldPreview.text,
    sandboxPatchedText: patchedPreview.text,
    changed: input.oldPreviewText !== input.sandboxPatchedText,
    changesApplied: input.changesApplied,
    changesBlocked: input.changesBlocked,
    warnings: input.warnings,
    blockers: input.blockers,
    previewLimited: input.previewLimited,
    truncated: oldPreview.truncated || patchedPreview.truncated,
  };
}

export function buildSandboxSummary(files: PatchSandboxFileResult[]): PatchSandboxSummary {
  return {
    totalFiles: files.length,
    changedFiles: files.filter((file) => file.changed).length,
    unchangedFiles: files.filter((file) => !file.changed).length,
    changesApplied: files.reduce((sum, file) => sum + file.changesApplied, 0),
    changesBlocked: files.reduce((sum, file) => sum + file.changesBlocked, 0),
    warnings: files.reduce((sum, file) => sum + file.warnings.length, 0),
    blockers: files.reduce((sum, file) => sum + file.blockers.length, 0),
    displayLimited: files.some((file) => file.truncated || file.previewLimited),
    noProjectFilesModified: true,
  };
}

export function verifyPatchPreviewCanApply(context: PatchSandboxContext): PatchSandboxResult {
  return applyPatchPreviewToIndexedTextSandbox(context);
}

export function applyPatchPreviewToIndexedTextSandbox(
  context: PatchSandboxContext,
): PatchSandboxResult {
  const { preview } = context;
  const filesById = new Map(context.files.map((file) => [file.id, file]));
  const filesByPath = new Map(context.files.map((file) => [file.path, file]));
  const previewsByFileId = new Map(context.textPreviews.map((row) => [row.file_id, row]));
  const groundedByPath = new Map(preview.groundedFiles.map((file) => [file.path, file]));
  const changesByPath = new Map<string, GroundedPatchChange[]>();
  const globalBlockers: PatchSandboxIssue[] = [];
  const globalWarnings: PatchSandboxIssue[] = [];

  if (preview.status === "rejected" || preview.status === "failed") {
    globalBlockers.push(
      issue({
        code: "patch_preview_not_ready",
        message: "Patch preview cannot be applied safely yet.",
        severity: "blocker",
      }),
    );
  }

  for (const { change } of sortChanges(preview.changes)) {
    if (change.changeType !== "modify") {
      globalBlockers.push(
        issue({
          code: "unsupported_change_type",
          message: "Create, delete, and rename changes are not supported by sandbox verification.",
          filePath: change.filePath,
          severity: "blocker",
        }),
      );
    }
    if (!groundedByPath.has(change.filePath)) {
      globalBlockers.push(
        issue({
          code: "file_not_grounded",
          message: "Target file is not in the grounded patch preview.",
          filePath: change.filePath,
          severity: "blocker",
        }),
      );
    }
    changesByPath.set(change.filePath, [...(changesByPath.get(change.filePath) ?? []), change]);
  }

  const filePaths = Array.from(
    new Set([...preview.groundedFiles.map((file) => file.path), ...changesByPath.keys()]),
  ).sort();
  const files = filePaths.map((filePath) => {
    const grounded = groundedByPath.get(filePath);
    const file =
      (grounded ? filesById.get(grounded.fileId) : null) ?? filesByPath.get(filePath) ?? null;
    const currentPreview = file ? (previewsByFileId.get(file.id) ?? null) : null;
    const targetBlockers = validateCurrentTarget({ file, preview: currentPreview, filePath });
    const staleBlockers = detectStalePreview({
      groundedHash: grounded?.contentSha256,
      currentHash: file?.content_sha256 ?? file?.checksum,
      filePath: file?.path ?? filePath,
    });
    const blockers = [...targetBlockers, ...staleBlockers];
    const warnings = createSandboxWarnings({
      preview: currentPreview,
      filePath: file?.path ?? filePath,
    });
    const changes = changesByPath.get(filePath) ?? [];
    let sandboxText = currentPreview?.preview_text ?? "";
    let changesApplied = 0;
    let changesBlocked = 0;

    if (blockers.length > 0) {
      changesBlocked += changes.length;
    } else {
      for (const change of changes) {
        const conflicts = detectPatchConflicts({ change, currentText: sandboxText });
        const conflictBlockers = conflicts.filter((item) => item.severity === "blocker");
        const conflictWarnings = conflicts.filter((item) => item.severity === "warning");
        warnings.push(...conflictWarnings);
        if (conflictBlockers.length > 0) {
          blockers.push(...conflictBlockers);
          changesBlocked += 1;
          continue;
        }
        sandboxText = sandboxText.replace(change.oldText, change.newText);
        changesApplied += 1;
      }
    }

    return buildSandboxFileResult({
      filePath: file?.path ?? filePath,
      contentSha256: file?.content_sha256 ?? file?.checksum ?? grounded?.contentSha256 ?? null,
      oldPreviewText: currentPreview?.preview_text ?? "",
      sandboxPatchedText: sandboxText,
      changesApplied,
      changesBlocked,
      warnings,
      blockers,
      previewLimited: Boolean(currentPreview?.truncated),
    });
  });

  const summary = buildSandboxSummary(files);
  const warnings = [...globalWarnings, ...files.flatMap((file) => file.warnings)];
  const blockers = [...globalBlockers, ...files.flatMap((file) => file.blockers)];
  const status: PatchSandboxStatus =
    blockers.length > 0
      ? "blocked"
      : summary.changesApplied === 0
        ? "failed"
        : summary.changesBlocked > 0
          ? "partial"
          : "verified";

  return {
    status,
    projectId: preview.projectId,
    patchPreviewId: preview.id,
    files,
    warnings,
    blockers,
    summary: {
      ...summary,
      warnings: warnings.length,
      blockers: blockers.length,
    },
  };
}

export async function queueSandboxExecution(input: {
  supabase: any;
  userId: string;
  projectId: string;
  previewId: string;
  context: PatchSandboxContext;
}) {
  const { data, error } = await input.supabase
    .from("sandbox_execution_jobs")
    .insert({
      project_id: input.projectId,
      patch_preview_id: input.previewId,
      created_by: input.userId,
      status: "queued"
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to queue sandbox execution: " + error.message);
  return data.id;
}

export async function processSandboxJob(
  supabase: any,
  jobId: string,
  context: PatchSandboxContext
): Promise<PatchSandboxResult> {
  // Mark as processing
  await supabase
    .from("sandbox_execution_jobs")
    .update({ status: "processing" })
    .eq("id", jobId);

  const result = applyPatchPreviewToIndexedTextSandbox(context);
  if (result.status !== "verified" && result.status !== "partial") {
    await supabase
      .from("sandbox_execution_jobs")
      .update({ status: "failed", result })
      .eq("id", jobId);
    return result;
  }

  const workspaceId = `nexus-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workspaceDir = join(tmpdir(), workspaceId);
  let stdoutLogs = "";
  let stderrLogs = "";

  const updateLogs = async () => {
    await supabase
      .from("sandbox_execution_jobs")
      .update({ stdout: stdoutLogs, stderr: stderrLogs })
      .eq("id", jobId);
  };

  try {
    mkdirSync(workspaceDir, { recursive: true });

    // Write ALL known text files to create a full working copy
    for (const file of context.files) {
      if (file.is_text) {
        const patchedResult = result.files.find(f => f.filePath === file.path);
        let content = patchedResult?.sandboxPatchedText;
        if (!content) {
          const previewRow = context.textPreviews.find(p => p.file_id === file.id);
          if (previewRow) {
            content = previewRow.preview_text;
          }
        }
        if (content) {
          const fullPath = join(workspaceDir, file.path);
          mkdirSync(join(fullPath, ".."), { recursive: true });
          writeFileSync(fullPath, content);
        }
      }
    }

    // Run dependency installation and build pipeline
    stdoutLogs += "> npm install\n";
    await updateLogs();
    
    const installResult = await runCommand("npm", ["install", "--no-audit", "--no-fund"], workspaceDir);
    stdoutLogs += installResult.stdout + "\n";
    stderrLogs += installResult.stderr + "\n";
    await updateLogs();

    if (installResult.exitCode !== 0) {
      result.status = "failed";
      result.blockers.push(
        issue({
          code: "install_failed",
          message: `npm install failed`,
          severity: "blocker",
        }),
      );
      result.summary.blockers += 1;
      
      await supabase
        .from("sandbox_execution_jobs")
        .update({ status: "failed", result, stdout: stdoutLogs, stderr: stderrLogs })
        .eq("id", jobId);
      return result;
    }

    stdoutLogs += "> npm run build\n";
    await updateLogs();
    
    const buildResult = await runCommand("npm", ["run", "build"], workspaceDir);
    stdoutLogs += buildResult.stdout + "\n";
    stderrLogs += buildResult.stderr + "\n";
    await updateLogs();

    if (buildResult.exitCode !== 0) {
      result.status = "failed";
      result.blockers.push(
        issue({
          code: "build_failed",
          message: `Build pipeline failed with exit code ${buildResult.exitCode}`,
          severity: "blocker",
        }),
      );
      result.summary.blockers += 1;
      
      await supabase
        .from("sandbox_execution_jobs")
        .update({ status: "failed", result, stdout: stdoutLogs, stderr: stderrLogs })
        .eq("id", jobId);
      return result;
    }

  } catch (err) {
    result.status = "failed";
    result.blockers.push(
      issue({
        code: "sandbox_execution_error",
        message: err instanceof Error ? err.message : String(err),
        severity: "blocker",
      }),
    );
    result.summary.blockers += 1;
    stderrLogs += "\n" + (err instanceof Error ? err.stack : String(err));
    
    await supabase
      .from("sandbox_execution_jobs")
      .update({ status: "failed", result, stdout: stdoutLogs, stderr: stderrLogs })
      .eq("id", jobId);
    return result;
  } finally {
    try {
      rmSync(workspaceDir, { recursive: true, force: true });
    } catch (e) {
      console.warn("Failed to cleanup tmp dir", e);
    }
  }

  await supabase
    .from("sandbox_execution_jobs")
    .update({ status: "completed", result, stdout: stdoutLogs, stderr: stderrLogs })
    .eq("id", jobId);

  return result;
}
