import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import {
  buildWorkingCopyRows,
  summarizeWorkingCopy,
  validateRequestCanExecute,
  type ProjectWorkingCopy,
  type ProjectWorkingCopyFile,
} from "../../src/features/projects/projectWorkingCopyService";
import {
  createWorkingCopyExportBundle,
  createWorkingCopyExportReadme,
  enforceWorkingCopyExportLimits,
  sanitizeWorkingCopyExportPath,
} from "../../src/features/projects/workingCopyExport";
import {
  PIPELINE_STAGE_ORDER,
  buildProjectPipelineDiagnostics,
  buildPipelineSafetyInvariants,
} from "../../src/features/projects/projectPipelineDiagnostics";
import { resolveThreadProjectContext } from "../../src/features/projects/projectThreadContext";
import { releaseInfo } from "../../src/lib/releaseInfo";
import type {
  GroundedPatchPreview,
  ProjectFile,
  ProjectTextPreviewWithPath,
  ProjectWithLatestJob,
} from "../../src/features/projects/types";
import { translations } from "../../src/features/i18n/translations";

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

const baseProject: ProjectWithLatestJob = {
  id: "project-1",
  user_id: "user-1",
  name: "Attached project",
  description: null,
  source_type: "zip",
  status: "completed",
  created_at: "2026-05-26T00:00:00.000Z",
  updated_at: "2026-05-26T00:00:00.000Z",
  latest_job: null,
};

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

test.describe("thread project context hydration", () => {
  test("uses the hydrated attached project when it is not the workspace active project", () => {
    const activeProject = { ...baseProject, id: "project-2", name: "Workspace project" };
    const attachedProject = { ...baseProject, id: "project-1", name: "Hydrated project" };
    const resolved = resolveThreadProjectContext({
      threadProjectId: "project-1",
      threadProjectName: "Thread project name",
      activeProject,
      attachedProject,
    });

    expect(resolved.state).toBe("attached");
    expect(resolved.projectId).toBe("project-1");
    expect(resolved.project).toBe(attachedProject);
    expect(resolved.projectName).toBe("Thread project name");
  });

  test("keeps attached context non-null by id even when preview data is unavailable", () => {
    const resolved = resolveThreadProjectContext({
      threadProjectId: "project-1",
      threadProjectName: "Thread project name",
      activeProject: null,
      attachedProject: null,
    });

    expect(resolved.state).toBe("attached");
    expect(resolved.projectId).toBe("project-1");
    expect(resolved.project).toBeNull();
    expect(resolved.projectName).toBe("Thread project name");
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

test.describe("approved writeback working copy builder", () => {
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

  const approvedRequest: ProjectWritebackRequest = {
    id: "request-1",
    projectId: "project-1",
    patchPreviewId: "patch-1",
    snapshotId: "snapshot-1",
    requestedBy: "user-1",
    reviewerId: "admin-1",
    status: "approved",
    title: "Source writeback review",
    requesterNote: "Please review.",
    reviewerNote: "Approved for future writeback consideration.",
    reviewDecision: "approved",
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
    reviewedAt: "2026-05-26T00:00:00.000Z",
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

  test("creates working copy rows from approved snapshot rows without source mutation", async () => {
    const files = [snapshotFile()];
    const beforeFiles = JSON.stringify(files);
    const beforeRequest = JSON.stringify(approvedRequest);
    const rows = await buildWorkingCopyRows({
      request: approvedRequest,
      snapshot,
      files,
      actorId: "user-1",
    });

    expect(rows.workingCopy.changedFilesCount).toBe(1);
    expect(rows.workingCopy.status).toBe("created");
    expect(rows.workingCopy.metadata).toMatchObject({
      originalProjectFilesModified: false,
      originalTextPreviewsModified: false,
      objectStorageModified: false,
      sourceZipOverwritten: false,
      codeExecuted: false,
      deploymentPerformed: false,
    });
    expect(rows.files).toHaveLength(1);
    expect(rows.files[0]).toMatchObject({
      file_path: "src/app.ts",
      content_sha256: "hash-2",
      content_text: "new",
      changed: true,
    });
    expect(JSON.stringify(files)).toBe(beforeFiles);
    expect(JSON.stringify(approvedRequest)).toBe(beforeRequest);
  });

  test("blocks non-approved and terminal requests from execution", () => {
    for (const status of ["draft", "submitted", "rejected", "cancelled"] as const) {
      expect(() =>
        validateRequestCanExecute({
          request: { ...approvedRequest, status },
          snapshot,
          files: [snapshotFile()],
        }),
      ).toThrow("approved");
    }
  });

  test("blocks execution when blockers or no changed files exist", () => {
    expect(() =>
      validateRequestCanExecute({
        request: { ...approvedRequest, blockers: [{ code: "blocked", message: "Blocked." }] },
        snapshot,
        files: [snapshotFile()],
      }),
    ).toThrow("blocked");
    expect(() =>
      validateRequestCanExecute({
        request: approvedRequest,
        snapshot,
        files: [{ ...snapshotFile(), changed: false }],
      }),
    ).toThrow("blocked");
    expect(() =>
      validateRequestCanExecute({
        request: approvedRequest,
        snapshot,
        files: [{ ...snapshotFile(), blockers: [{ code: "blocked", message: "Blocked." }] }],
      }),
    ).toThrow("blocked");
  });

  test("summarizes working copy execution as non-deploying and storage-safe", () => {
    const summary = summarizeWorkingCopy({
      request: approvedRequest,
      files: [snapshotFile()],
    });

    expect(summary.changedFilesCount).toBe(1);
    expect(summary.createdFromApprovedRequest).toBe(true);
    expect(summary.originalProjectFilesModified).toBe(false);
    expect(summary.originalTextPreviewsModified).toBe(false);
    expect(summary.objectStorageModified).toBe(false);
    expect(summary.sourceZipOverwritten).toBe(false);
    expect(summary.codeExecuted).toBe(false);
    expect(summary.deploymentPerformed).toBe(false);
  });

  test("generates a content hash when the snapshot did not preserve one", async () => {
    const rows = await buildWorkingCopyRows({
      request: approvedRequest,
      snapshot,
      files: [{ ...snapshotFile(), patchedContentSha256: null }],
      actorId: "user-1",
    });

    expect(rows.files[0].content_sha256).toBe(await hashPatchedText("new"));
  });
});

test.describe("working copy export builder", () => {
  const workingCopy: ProjectWorkingCopy = {
    id: "working-copy-1",
    projectId: "project-1",
    writebackRequestId: "request-1",
    patchPreviewId: "patch-1",
    patchSnapshotId: "snapshot-1",
    createdBy: "user-1",
    executedBy: "user-1",
    status: "created",
    title: "Versioned working copy",
    summary: "Derived working copy",
    source: "approved_writeback_request",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    metadata: {
      originalProjectFilesModified: false,
      originalTextPreviewsModified: false,
      objectStorageModified: false,
      sourceZipOverwritten: false,
    },
    createdAt: "2026-05-26T00:00:00.000Z",
  };

  const workingCopyFile: ProjectWorkingCopyFile = {
    id: "working-copy-file-1",
    workingCopyId: workingCopy.id,
    projectId: workingCopy.projectId,
    writebackRequestId: workingCopy.writebackRequestId,
    patchSnapshotId: workingCopy.patchSnapshotId,
    filePath: "src/app.ts",
    contentSha256: "hash-2",
    contentText: "export const value = 'new';\n",
    sizeBytes: 27,
    changed: true,
    previewLimited: true,
    truncated: false,
    warnings: [],
    blockers: [],
    createdAt: "2026-05-26T00:00:00.000Z",
  };

  test("sanitizes safe export paths and blocks unsafe paths", () => {
    expect(sanitizeWorkingCopyExportPath("src\\app.ts")).toBe("src/app.ts");
    expect(sanitizeWorkingCopyExportPath(".env.example")).toBe(".env.example");
    expect(() => sanitizeWorkingCopyExportPath("../app.ts")).toThrow("Unsafe working copy");
    expect(() => sanitizeWorkingCopyExportPath("/src/app.ts")).toThrow("Absolute working copy");
    expect(() => sanitizeWorkingCopyExportPath("C:\\src\\app.ts")).toThrow("Windows drive");
    expect(() => sanitizeWorkingCopyExportPath(".git/config")).toThrow("Unsafe working copy");
    expect(() => sanitizeWorkingCopyExportPath(".env.local")).toThrow("Sensitive files");
  });

  test("builds manifest, README, and bundle without mutating source rows", () => {
    const beforeCopy = JSON.stringify(workingCopy);
    const beforeFile = JSON.stringify(workingCopyFile);
    const bundle = createWorkingCopyExportBundle({
      workingCopy,
      workingCopyFiles: [workingCopyFile],
      request: {
        id: "request-1",
        status: "approved",
        reviewedAt: "2026-05-26T00:00:00.000Z",
        reviewerId: "admin-1",
        requesterNote: "Please review.",
        reviewerNote: "Approved.",
      },
      exportedAt: "2026-05-26T12:00:00.000Z",
    });

    expect(bundle.readme).toContain("Original project files were not modified.");
    expect(bundle.readme).toContain("Source ZIP and object storage were not overwritten.");
    expect(bundle.manifest.source).toBe("versioned working copy");
    expect(bundle.manifest.originalProjectFilesModified).toBe(false);
    expect(bundle.manifest.sourceZipOverwritten).toBe(false);
    expect(bundle.manifest.objectStorageModified).toBe(false);
    expect(bundle.files[0]).toMatchObject({
      exportPath: "working-copy/files/src/app.ts",
      contentText: "export const value = 'new';\n",
      contentSha256: "hash-2",
    });
    expect(createWorkingCopyExportReadme(workingCopy)).toContain("Versioned working copy bundle");
    expect(JSON.stringify(workingCopy)).toBe(beforeCopy);
    expect(JSON.stringify(workingCopyFile)).toBe(beforeFile);
  });

  test("enforces working copy export file and size limits", () => {
    expect(() =>
      enforceWorkingCopyExportLimits({
        files: Array.from({ length: 151 }, (_, index) => ({
          ...workingCopyFile,
          filePath: `src/file-${index}.ts`,
          exportPath: `working-copy/files/src/file-${index}.ts`,
        })),
      }),
    ).toThrow("Working copy export file limit exceeded.");

    expect(() =>
      enforceWorkingCopyExportLimits({
        files: [
          {
            ...workingCopyFile,
            exportPath: "working-copy/files/src/app.ts",
            contentText: "a".repeat(150_001),
          },
        ],
      }),
    ).toThrow("Working copy export size limit exceeded.");
  });
});

test.describe("pipeline diagnostics release gate", () => {
  const readyPreview: GroundedPatchPreview = {
    id: "patch-1",
    projectId: "project-1",
    title: "Patch",
    status: "ready",
    summary: "Ready patch",
    groundedFiles: [
      {
        fileId: "file-1",
        path: "src/app.ts",
        contentSha256: "hash-1",
        isPreviewable: true,
        sourcePreviewAvailable: true,
      },
    ],
    changes: [],
    warnings: [{ code: "ai_change_reason", message: "AI validated." }],
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
  };

  const snapshot: ProjectPatchSnapshot = {
    id: "snapshot-1",
    projectId: "project-1",
    patchPreviewId: "patch-1",
    createdBy: "user-1",
    status: "created",
    title: "Snapshot",
    summary: "Snapshot",
    source: "patch_preview_sandbox",
    verificationStatus: "verified",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    metadata: {},
    createdAt: "2026-05-26T00:00:00.000Z",
  };

  const approvedRequest: ProjectWritebackRequest = {
    id: "request-1",
    projectId: "project-1",
    patchPreviewId: "patch-1",
    snapshotId: "snapshot-1",
    requestedBy: "user-1",
    reviewerId: "admin-1",
    status: "approved",
    title: "Request",
    requesterNote: null,
    reviewerNote: "Approved.",
    reviewDecision: "approved",
    riskLevel: "low",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    snapshotSummary: {},
    metadata: {},
    reviewMetadata: {},
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
    submittedAt: "2026-05-26T00:00:00.000Z",
    reviewedAt: "2026-05-26T01:00:00.000Z",
  };

  const workingCopy: ProjectWorkingCopy = {
    id: "working-copy-1",
    projectId: "project-1",
    writebackRequestId: "request-1",
    patchPreviewId: "patch-1",
    patchSnapshotId: "snapshot-1",
    createdBy: "user-1",
    executedBy: "user-1",
    status: "created",
    title: "Versioned working copy",
    summary: "Working copy",
    source: "approved_writeback_request",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    metadata: {},
    createdAt: "2026-05-26T02:00:00.000Z",
  };

  const workingCopyFile: ProjectWorkingCopyFile = {
    id: "working-copy-file-1",
    workingCopyId: "working-copy-1",
    projectId: "project-1",
    writebackRequestId: "request-1",
    patchSnapshotId: "snapshot-1",
    filePath: "src/app.ts",
    contentSha256: "hash-2",
    contentText: "new",
    sizeBytes: 3,
    changed: true,
    previewLimited: true,
    truncated: false,
    warnings: [],
    blockers: [],
    createdAt: "2026-05-26T02:00:00.000Z",
  };

  test("keeps diagnostics stage ordering stable", () => {
    const diagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [readyPreview],
    });

    expect(diagnostics.stages.map((stage) => stage.key)).toEqual(PIPELINE_STAGE_ORDER);
  });

  test("release gate never enables source writeback", () => {
    const diagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [readyPreview],
      patchSnapshots: [snapshot],
      writebackRequests: [approvedRequest],
      workingCopies: [workingCopy],
      workingCopyFiles: [workingCopyFile],
    });

    expect(diagnostics.releaseGate.realSourceWritebackUnavailable).toBe(true);
    expect(diagnostics.releaseGate.sourceWritebackAvailable).toBe(false);
  });

  test("blocks snapshot export when a patch preview has no snapshot", () => {
    const diagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [readyPreview],
    });
    const exportStage = diagnostics.stages.find((stage) => stage.key === "snapshotExport");

    expect(exportStage?.status).toBe("blocked");
    expect(exportStage?.blockers.join(" ")).toContain("snapshot");
  });

  test("marks working copy export complete when file rows are present", () => {
    const diagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [readyPreview],
      patchSnapshots: [snapshot],
      writebackRequests: [approvedRequest],
      workingCopies: [workingCopy],
      workingCopyFiles: [workingCopyFile],
    });
    const exportStage = diagnostics.stages.find((stage) => stage.key === "workingCopyExport");

    expect(exportStage?.status).toBe("complete");
  });

  test("distinguishes AI provider readiness states without faking a pass", () => {
    const blockedDiagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [],
      aiPatchPreviewConfigured: false,
    });
    const blockedStage = blockedDiagnostics.stages.find((stage) => stage.key === "aiPatchPreview");

    expect(blockedStage?.status).toBe("blocked");
    expect(blockedStage?.blockers.join(" ")).toContain("BLOCKED_AI_PROVIDER_REQUIRED");
    expect(blockedDiagnostics.releaseGate.aiPatchPreviewConfigured).toBe(false);

    const readyDiagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [],
      aiPatchPreviewConfigured: true,
    });
    const readyStage = readyDiagnostics.stages.find((stage) => stage.key === "aiPatchPreview");

    expect(readyStage?.status).toBe("ready");
    expect(readyDiagnostics.releaseGate.aiPatchPreviewConfigured).toBe(true);

    const failedDiagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [],
      aiPatchPreviewConfigured: true,
      aiPatchPreviewGatewayError: "Check provider credentials and logs.",
    });
    const failedStage = failedDiagnostics.stages.find((stage) => stage.key === "aiPatchPreview");

    expect(failedStage?.status).toBe("failed");
    expect(failedStage?.warnings.join(" ")).toContain("AI_GATEWAY_ERROR");
    expect(failedDiagnostics.releaseGate.aiPatchPreviewConfigured).toBe(false);

    const completeDiagnostics = buildProjectPipelineDiagnostics({
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [readyPreview],
      aiPatchPreviewConfigured: false,
    });
    const completeStage = completeDiagnostics.stages.find(
      (stage) => stage.key === "aiPatchPreview",
    );

    expect(completeStage?.status).toBe("complete");
    expect(completeDiagnostics.releaseGate.aiPatchPreviewConfigured).toBe(true);
  });

  test("includes safety invariant messages and does not mutate inputs", () => {
    const input = {
      projectId: "project-1",
      safePreviews: [textPreview()],
      patchPreviews: [readyPreview],
      patchSnapshots: [snapshot],
      writebackRequests: [approvedRequest],
      workingCopies: [workingCopy],
      workingCopyFiles: [workingCopyFile],
    };
    const before = JSON.stringify(input);
    const diagnostics = buildProjectPipelineDiagnostics(input);
    const invariants = buildPipelineSafetyInvariants();

    expect(invariants.map((item) => item.label).join(" ")).toContain(
      "Original project_files remain unchanged",
    );
    expect(diagnostics.safetyInvariants.length).toBeGreaterThan(0);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("keeps production readiness labels and docs available", () => {
    const docPath = resolve(process.cwd(), "docs/phase-94-production-readiness.md");
    expect(existsSync(docPath)).toBe(true);
    const doc = readFileSync(docPath, "utf8");

    expect(translations.en.productionReadiness).toBe("Production readiness");
    expect(translations.en.credentialedSmokeRequired).toBe("Credentialed smoke required");
    expect(translations.ar.productionReadiness).toContain(
      "\u0627\u0644\u0625\u0646\u062a\u0627\u062c",
    );
    expect(doc).toContain("LOVABLE_API_KEY");
    expect(doc).toContain("ACCEPT_WITH_LIMITATIONS");
    expect(doc).toContain("b09ec61");
    expect(doc).toContain("monthly successful ZIP quota");
    expect(doc).toContain("Source ZIP overwrite");
    expect(doc).toContain("Object storage writeback");
    expect(doc).toContain("Uploaded/generated code execution");
    expect(doc).toContain("exports are JSON bundles");
  });

  test("keeps release candidate report and checklists available", () => {
    const rcPath = resolve(process.cwd(), "docs/RELEASE_CANDIDATE_RC1.md");
    const checklistPath = resolve(process.cwd(), "docs/RELEASE_CANDIDATE_CHECKLIST.md");

    expect(existsSync(rcPath)).toBe(true);
    expect(existsSync(checklistPath)).toBe(true);

    const rcDoc = readFileSync(rcPath, "utf8");
    const checklistDoc = readFileSync(checklistPath, "utf8");

    expect(rcDoc).toContain("Nexus Core RC-1");
    expect(rcDoc).toContain("4302767");
    expect(rcDoc).toContain("b09ec61");
    expect(rcDoc).toContain("Fix folder import quota RLS blocker");
    expect(rcDoc).toContain("Phase 96D");
    expect(rcDoc).toContain("ACCEPT_WITH_LIMITATIONS");
    expect(rcDoc).toContain("monthly successful ZIP upload quota");
    expect(rcDoc).toContain("What Is Intentionally Unavailable");
    expect(rcDoc).toContain("Source ZIP Overwrite");
    expect(rcDoc).toContain("Object Storage Writeback");
    expect(rcDoc).toContain("Snapshot export as a bounded JSON review bundle");
    expect(rcDoc).toContain("Required Production Smoke Checklist");

    expect(checklistDoc).toContain("Nexus Core Release Candidate Checklist");
    expect(checklistDoc).toContain("ACCEPT_WITH_LIMITATIONS");
    expect(checklistDoc).toContain("monthly successful ZIP quota");
    expect(checklistDoc).toContain("bounded JSON bundle");
    expect(checklistDoc).toContain("source ZIP");
    expect(checklistDoc).toContain("object storage writeback");
  });

  test("keeps RC stabilization copy and release labels explicit", () => {
    expect(translations.en.monthlyUploadLimitReached).toContain("not archived projects");
    expect(translations.en.monthlyZipQuotaArchiveNotice).toBe(
      "This monthly quota is based on successful ZIP processing, not archived projects.",
    );
    expect(translations.en.usedThisMonth).toBe("Used this month");
    expect(translations.en.monthlyLimit).toBe("Monthly limit");
    expect(translations.en.remainingUploads).toBe("Remaining uploads");
    expect(translations.en.quotaWindow).toBe("Quota window");
    expect(translations.en.useFreshQaAccountOrWait).toContain("fresh QA account");
    expect(translations.ar.monthlyUploadLimitReached).toContain(
      "هذا الحد الشهري يعتمد على عمليات ZIP الناجحة",
    );
    expect(releaseInfo.releaseName).toBe("Nexus Core RC-1");
    expect(releaseInfo.releaseStatus).toBe("ACCEPT_WITH_LIMITATIONS");
    expect(releaseInfo.latestStabilization).toContain("Phase 96D");
    expect(releaseInfo.latestStabilization).toContain("quota RLS unblock");
    expect(releaseInfo.expectedCommitLabel).toBe("b09ec61 or newer");
  });

  test("keeps folder import exempt from ZIP monthly quota without weakening ZIP quota", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260527120000_folder_import_quota_rls_unblock.sql",
    );
    const uploadServicePath = resolve(
      process.cwd(),
      "src/features/projects/projectUploadService.ts",
    );
    const ingestionProcessorPath = resolve(
      process.cwd(),
      "src/features/projects/server/ingestionProcessor.ts",
    );

    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain(
      'drop policy if exists "project_ingestion_jobs_insert_own_project"',
    );
    expect(migration).toContain("auth.uid() = user_id");
    expect(migration).toContain("projects.user_id = auth.uid()");
    expect(migration).toContain(
      "public.is_within_usage_limit(auth.uid(), 'max_uploads_monthly', 1)",
    );
    expect(migration).toContain("projects.source_type = 'local'");
    expect(migration).toContain(
      "coalesce(project_ingestion_jobs.metadata->>'source_type', '') in ('folder', 'local')",
    );
    expect(migration).toContain("client_folder_manifest_only");

    const uploadService = readFileSync(uploadServicePath, "utf8");
    const zipUpload = uploadService.slice(
      uploadService.indexOf("export async function uploadProjectZip"),
      uploadService.indexOf("export async function importProjectFolder"),
    );
    const folderImport = uploadService.slice(
      uploadService.indexOf("export async function importProjectFolder"),
    );

    expect(zipUpload).toContain('requireQuota(input.userId, "max_uploads_monthly")');
    expect(folderImport).toContain('requireQuota(input.userId, "max_projects")');
    expect(folderImport).not.toContain("max_uploads_monthly");
    expect(folderImport).toContain('eventType: "folder_import_completed"');
    expect(folderImport).not.toContain('eventType: "project_upload_completed"');

    const ingestionProcessor = readFileSync(ingestionProcessorPath, "utf8");
    const statusUpdateIndex = ingestionProcessor.indexOf(
      'await updateProjectStatus(supabase, projectId, "indexed_manifest")',
    );
    const usageRecordIndex = ingestionProcessor.indexOf("await recordSuccessfulZipUploadUsage");
    expect(statusUpdateIndex).toBeGreaterThan(-1);
    expect(usageRecordIndex).toBeGreaterThan(statusUpdateIndex);
    expect(ingestionProcessor).toContain('event_type: "project_upload_completed"');
  });
});
