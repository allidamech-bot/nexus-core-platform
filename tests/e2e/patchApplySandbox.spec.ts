import { expect, test } from "@playwright/test";
import { verifyPatchPreviewCanApply } from "../../src/features/projects/patchApplySandbox";
import {
  createPatchSnapshotFromSandbox,
  hashPatchedText,
  type ProjectPatchSnapshot,
  type ProjectPatchSnapshotFile,
} from "../../src/features/projects/patchSnapshot";
import {
  createSnapshotExportBundle,
  createSnapshotExportReadme,
  enforceSnapshotExportLimits,
  sanitizeExportFilePath,
} from "../../src/features/projects/patchSnapshotExport";
import { buildWritebackRequestRiskSummary } from "../../src/features/projects/writebackRisk";
import {
  buildWritebackReviewSummary,
  validateWritebackStatusTransition,
  type ProjectWritebackRequest,
} from "../../src/features/projects/projectWritebackRequestService";
import type {
  GroundedPatchPreview,
  ProjectFile,
  ProjectTextPreviewWithPath,
} from "../../src/features/projects/types";

const baseFile: ProjectFile = {
  id: "file-1",
  project_id: "project-1",
  user_id: "user-1",
  path: "src/app.ts",
  name: "app.ts",
  extension: "ts",
  size_bytes: 100,
  mime_type: "text/typescript",
  checksum: "hash-1",
  content_sha256: "hash-1",
  ingestion_job_id: "job-1",
  is_text: true,
  is_previewable: true,
  skipped: false,
  skip_reason: null,
  indexed_at: "2026-05-26T00:00:00.000Z",
  created_at: "2026-05-26T00:00:00.000Z",
};

const basePreviewText = "export const value = 'old';\n";

function textPreview(file = baseFile, previewText = basePreviewText): ProjectTextPreviewWithPath {
  return {
    id: "preview-1",
    project_id: file.project_id,
    file_id: file.id,
    user_id: file.user_id,
    preview_text: previewText,
    summary: "Preview",
    detected_language: "typescript",
    indexed_at: "2026-05-26T00:00:00.000Z",
    truncated: false,
    line_count: 1,
    token_estimate: 8,
    metadata: {},
    created_at: "2026-05-26T00:00:00.000Z",
    path: file.path,
  };
}

function patchPreview(
  input: {
    oldText?: string;
    newText?: string;
    status?: GroundedPatchPreview["status"];
    file?: ProjectFile;
  } = {},
): GroundedPatchPreview {
  const file = input.file ?? baseFile;
  const oldText = input.oldText ?? "old";
  const newText = input.newText ?? "new";
  return {
    id: "patch-1",
    projectId: file.project_id,
    title: "Sandbox patch",
    status: input.status ?? "ready",
    summary: "Read-only patch preview",
    groundedFiles: [
      {
        fileId: file.id,
        path: file.path,
        contentSha256: file.content_sha256,
        isPreviewable: file.is_previewable,
        sourcePreviewAvailable: true,
      },
    ],
    changes: [
      {
        filePath: file.path,
        changeType: "modify",
        oldText,
        newText,
        unifiedDiff: `--- a/${file.path}\n+++ b/${file.path}\n-old\n+new`,
        hunks: [],
        warnings: [],
      },
    ],
    warnings: [],
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
  };
}

test.describe("patch apply sandbox verifier", () => {
  test("verifies a valid single replacement without mutating indexed preview text", () => {
    const indexedPreview = textPreview();
    const before = indexedPreview.preview_text;
    const result = verifyPatchPreviewCanApply({
      preview: patchPreview(),
      files: [baseFile],
      textPreviews: [indexedPreview],
    });

    expect(result.status).toBe("verified");
    expect(result.summary.changedFiles).toBe(1);
    expect(result.files[0].sandboxPatchedText).toContain("'new'");
    expect(indexedPreview.preview_text).toBe(before);
  });

  test("blocks when oldText is missing", () => {
    const result = verifyPatchPreviewCanApply({
      preview: patchPreview({ oldText: "missing" }),
      files: [baseFile],
      textPreviews: [textPreview()],
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers.some((blocker) => blocker.code === "old_text_not_found")).toBeTruthy();
  });

  test("blocks ambiguous duplicate oldText", () => {
    const result = verifyPatchPreviewCanApply({
      preview: patchPreview({ oldText: "old" }),
      files: [baseFile],
      textPreviews: [textPreview(baseFile, "old\nold\n")],
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers.some((blocker) => blocker.code === "old_text_ambiguous")).toBeTruthy();
  });

  test("blocks skipped, binary, sensitive, stale, and rejected targets", () => {
    const skippedFile = { ...baseFile, skipped: true };
    const binaryFile = { ...baseFile, is_text: false };
    const sensitiveFile = { ...baseFile, path: ".env" };
    const staleFile = { ...baseFile, content_sha256: "hash-2" };

    expect(
      verifyPatchPreviewCanApply({
        preview: patchPreview({ file: skippedFile }),
        files: [skippedFile],
        textPreviews: [textPreview(skippedFile)],
      }).status,
    ).toBe("blocked");
    expect(
      verifyPatchPreviewCanApply({
        preview: patchPreview({ file: binaryFile }),
        files: [binaryFile],
        textPreviews: [textPreview(binaryFile)],
      }).status,
    ).toBe("blocked");
    expect(
      verifyPatchPreviewCanApply({
        preview: patchPreview({ file: sensitiveFile }),
        files: [sensitiveFile],
        textPreviews: [textPreview(sensitiveFile)],
      }).status,
    ).toBe("blocked");
    expect(
      verifyPatchPreviewCanApply({
        preview: patchPreview(),
        files: [staleFile],
        textPreviews: [textPreview(staleFile)],
      }).blockers.some((blocker) => blocker.code === "current_hash_mismatch"),
    ).toBeTruthy();
    expect(
      verifyPatchPreviewCanApply({
        preview: patchPreview({ status: "rejected" }),
        files: [baseFile],
        textPreviews: [textPreview()],
      }).status,
    ).toBe("blocked");
  });

  test("truncates large sandbox output for display", () => {
    const longText = `${"a".repeat(13000)}old`;
    const result = verifyPatchPreviewCanApply({
      preview: patchPreview({ oldText: "old", newText: "new" }),
      files: [baseFile],
      textPreviews: [textPreview(baseFile, longText)],
    });

    expect(result.files[0].truncated).toBeTruthy();
    expect(result.summary.displayLimited).toBeTruthy();
  });
});

test.describe("patch snapshot builder", () => {
  test("creates snapshot input from a verified sandbox without mutating source preview", async () => {
    const indexedPreview = textPreview();
    const before = indexedPreview.preview_text;
    const preview = patchPreview();
    const sandbox = verifyPatchPreviewCanApply({
      preview,
      files: [baseFile],
      textPreviews: [indexedPreview],
    });

    const built = await createPatchSnapshotFromSandbox({
      preview,
      sandbox,
      userId: baseFile.user_id,
    });

    expect(built.snapshot.status).toBe("created");
    expect(built.snapshot.changed_files_count).toBe(1);
    expect(built.files).toHaveLength(1);
    expect(built.files[0].changed).toBeTruthy();
    expect(built.files[0].patched_preview_text).toContain("'new'");
    expect(built.files[0].patched_content_sha256).toBe(
      await hashPatchedText("export const value = 'new';\n"),
    );
    expect(indexedPreview.preview_text).toBe(before);
  });

  test("blocks snapshot creation from blocked sandbox", async () => {
    const preview = patchPreview({ oldText: "missing" });
    const sandbox = verifyPatchPreviewCanApply({
      preview,
      files: [baseFile],
      textPreviews: [textPreview()],
    });

    await expect(
      createPatchSnapshotFromSandbox({ preview, sandbox, userId: baseFile.user_id }),
    ).rejects.toThrow("Cannot create snapshot from blocked sandbox.");
  });

  test("keeps unchanged files safe and truncates large snapshot previews", async () => {
    const longText = `${"a".repeat(13000)}old`;
    const file = { ...baseFile, content_sha256: null, checksum: null };
    const preview = patchPreview({ oldText: "old", newText: "new", file });
    const sandbox = verifyPatchPreviewCanApply({
      preview,
      files: [file],
      textPreviews: [textPreview(file, longText)],
    });
    const built = await createPatchSnapshotFromSandbox({
      preview,
      sandbox,
      userId: baseFile.user_id,
    });

    expect(built.files[0].truncated).toBeTruthy();
    expect(built.files[0].patched_content_sha256).toBeTruthy();
    expect(built.snapshot.metadata).toMatchObject({
      original_project_files_modified: false,
      original_text_previews_modified: false,
      source_writeback: false,
    });
  });
});

test.describe("patch snapshot export builder", () => {
  const snapshot: ProjectPatchSnapshot = {
    id: "snapshot-1",
    projectId: "project-1",
    patchPreviewId: "patch-1",
    createdBy: "user-1",
    status: "created",
    title: "Versioned patch snapshot",
    summary: "Derived snapshot",
    source: "patch_preview_sandbox",
    verificationStatus: "verified",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    metadata: {
      sandbox_summary: {
        changedFiles: 1,
        changesApplied: 1,
        changesBlocked: 0,
        displayLimited: false,
      },
    },
    createdAt: "2026-05-26T00:00:00.000Z",
  };

  const snapshotFile: ProjectPatchSnapshotFile = {
    id: "snapshot-file-1",
    snapshotId: snapshot.id,
    projectId: snapshot.projectId,
    patchPreviewId: snapshot.patchPreviewId,
    filePath: "src/app.ts",
    originalContentSha256: "hash-1",
    patchedContentSha256: "hash-2",
    originalPreviewText: "export const value = 'old';\n",
    patchedPreviewText: "export const value = 'new';\n",
    changed: true,
    previewLimited: true,
    truncated: false,
    warnings: [],
    blockers: [],
    createdAt: "2026-05-26T00:00:00.000Z",
  };

  test("sanitizes safe export paths and rejects traversal, absolute, and Windows drive paths", () => {
    expect(sanitizeExportFilePath("src\\app.ts")).toBe("src/app.ts");
    expect(() => sanitizeExportFilePath("../app.ts")).toThrow("Unsafe export path");
    expect(() => sanitizeExportFilePath("/src/app.ts")).toThrow("Absolute export paths");
    expect(() => sanitizeExportFilePath("C:\\src\\app.ts")).toThrow("Windows drive");
  });

  test("builds manifest, README, and bundle without mutating snapshot rows", () => {
    const before = JSON.stringify(snapshotFile);
    const bundle = createSnapshotExportBundle({
      snapshot,
      snapshotFiles: [snapshotFile],
      patchPreview: patchPreview(),
      exportedAt: "2026-05-26T12:00:00.000Z",
    });

    expect(bundle.readme).toContain("Original project files were not modified.");
    expect(bundle.manifest.originalProjectFilesModified).toBe(false);
    expect(bundle.manifest.exportLimitedToIndexedPreviewText).toBe(true);
    expect(bundle.files[0].exportPath).toBe("snapshot-export/patched/src/app.ts");
    expect(bundle.diffs[0].exportPath).toBe("snapshot-export/diffs/src/app.ts.patch");
    expect(JSON.stringify(snapshotFile)).toBe(before);
    expect(createSnapshotExportReadme(snapshot)).toContain("derived preview bundle");
  });

  test("enforces file count and total size limits", () => {
    expect(() =>
      enforceSnapshotExportLimits({
        files: Array.from({ length: 101 }, (_, index) => ({
          ...snapshotFile,
          filePath: `src/file-${index}.ts`,
          exportPath: `snapshot-export/patched/src/file-${index}.ts`,
          originalExportPath: `snapshot-export/original-preview/src/file-${index}.ts`,
          diffExportPath: `snapshot-export/diffs/src/file-${index}.ts.patch`,
        })),
      }),
    ).toThrow("Export file limit exceeded.");

    expect(() =>
      enforceSnapshotExportLimits({
        files: [
          {
            ...snapshotFile,
            exportPath: "snapshot-export/patched/src/app.ts",
            originalExportPath: "snapshot-export/original-preview/src/app.ts",
            diffExportPath: "snapshot-export/diffs/src/app.ts.patch",
            patchedPreviewText: "a".repeat(100_001),
          },
        ],
      }),
    ).toThrow("Export size limit exceeded.");
  });
});

test.describe("writeback request risk evaluator", () => {
  const snapshot: ProjectPatchSnapshot = {
    id: "snapshot-1",
    projectId: "project-1",
    patchPreviewId: "patch-1",
    createdBy: "user-1",
    status: "created",
    title: "Versioned patch snapshot",
    summary: "Derived snapshot",
    source: "patch_preview_sandbox",
    verificationStatus: "verified",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    metadata: {},
    createdAt: "2026-05-26T00:00:00.000Z",
  };

  function snapshotFile(path = "src/app.ts"): ProjectPatchSnapshotFile {
    return {
      id: `snapshot-file-${path}`,
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      patchPreviewId: snapshot.patchPreviewId,
      filePath: path,
      originalContentSha256: "hash-1",
      patchedContentSha256: "hash-2",
      originalPreviewText: "old",
      patchedPreviewText: "new",
      changed: true,
      previewLimited: true,
      truncated: false,
      warnings: [],
      blockers: [],
      createdAt: "2026-05-26T00:00:00.000Z",
    };
  }

  test("creates a low or medium request risk summary without mutating source rows", () => {
    const file = snapshotFile();
    const before = JSON.stringify(file);
    const risk = buildWritebackRequestRiskSummary({ snapshot, files: [file] });

    expect(risk.changedFilesCount).toBe(1);
    expect(["low", "medium"]).toContain(risk.riskLevel);
    expect(
      risk.warnings.some((warning) => warning.code === "preview_limited_snapshot"),
    ).toBeTruthy();
    expect(JSON.stringify(file)).toBe(before);
  });

  test("blocks when snapshot has blockers or no changed files", () => {
    expect(
      buildWritebackRequestRiskSummary({
        snapshot: {
          ...snapshot,
          blockers: [{ code: "blocked", message: "Blocked." }],
        },
        files: [snapshotFile()],
      }).riskLevel,
    ).toBe("blocked");

    const unchanged = { ...snapshotFile(), changed: false };
    const noChanges = buildWritebackRequestRiskSummary({ snapshot, files: [unchanged] });
    expect(noChanges.riskLevel).toBe("blocked");
    expect(noChanges.blockers.some((blocker) => blocker.code === "no_changed_files")).toBeTruthy();
  });

  test("raises package, migration, and truncated previews to high risk", () => {
    expect(
      buildWritebackRequestRiskSummary({ snapshot, files: [snapshotFile("package.json")] })
        .riskLevel,
    ).toBe("high");
    expect(
      buildWritebackRequestRiskSummary({
        snapshot,
        files: [snapshotFile("supabase/migrations/20260525190000_demo.sql")],
      }).riskLevel,
    ).toBe("high");
    expect(
      buildWritebackRequestRiskSummary({
        snapshot,
        files: [{ ...snapshotFile(), truncated: true }],
      }).riskLevel,
    ).toBe("high");
  });
});

test.describe("writeback review transition rules", () => {
  const request: ProjectWritebackRequest = {
    id: "request-1",
    projectId: "project-1",
    patchPreviewId: "patch-1",
    snapshotId: "snapshot-1",
    requestedBy: "user-1",
    reviewerId: null,
    status: "submitted",
    title: "Source writeback review",
    requesterNote: "Please review.",
    reviewerNote: null,
    reviewDecision: null,
    riskLevel: "medium",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    snapshotSummary: {},
    metadata: {},
    reviewMetadata: {},
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
    submittedAt: "2026-05-26T00:00:00.000Z",
    reviewedAt: null,
  };

  test("allows draft submit and submitted cancel for the requester", () => {
    expect(
      validateWritebackStatusTransition({
        action: "submit",
        actorRole: "requester",
        fromStatus: "draft",
      }),
    ).toBe("submitted");
    expect(
      validateWritebackStatusTransition({
        action: "cancel",
        actorRole: "requester",
        fromStatus: "submitted",
        reviewedAt: null,
      }),
    ).toBe("cancelled");
  });

  test("allows reviewer approval and rejection from submitted only", () => {
    expect(
      validateWritebackStatusTransition({
        action: "approve",
        actorRole: "reviewer",
        fromStatus: "submitted",
        blockerCount: 0,
      }),
    ).toBe("approved");
    expect(
      validateWritebackStatusTransition({
        action: "reject",
        actorRole: "reviewer",
        fromStatus: "submitted",
        reviewerNote: "Not safe yet.",
      }),
    ).toBe("rejected");
  });

  test("blocks unsafe or terminal review transitions", () => {
    expect(() =>
      validateWritebackStatusTransition({
        action: "approve",
        actorRole: "reviewer",
        fromStatus: "submitted",
        blockerCount: 1,
      }),
    ).toThrow("blockers");
    expect(() =>
      validateWritebackStatusTransition({
        action: "approve",
        actorRole: "reviewer",
        fromStatus: "rejected",
      }),
    ).toThrow("submitted");
    expect(() =>
      validateWritebackStatusTransition({
        action: "approve",
        actorRole: "reviewer",
        fromStatus: "cancelled",
      }),
    ).toThrow("submitted");
    expect(() =>
      validateWritebackStatusTransition({
        action: "submit",
        actorRole: "requester",
        fromStatus: "cancelled",
      }),
    ).toThrow("Invalid");
  });

  test("requires reviewer note for rejection and preserves no-writeback metadata", () => {
    expect(() =>
      validateWritebackStatusTransition({
        action: "reject",
        actorRole: "reviewer",
        fromStatus: "submitted",
        reviewerNote: "",
      }),
    ).toThrow("Reviewer note");

    const summary = buildWritebackReviewSummary({
      request,
      actorId: "admin-1",
      action: "approve",
      newStatus: "approved",
    });

    expect(summary.sourceWritebackPerformed).toBe(false);
    expect(summary.originalProjectFilesModified).toBe(false);
    expect(summary.originalTextPreviewsModified).toBe(false);
    expect(summary.approvalAppliesChanges).toBe(false);
  });
});
