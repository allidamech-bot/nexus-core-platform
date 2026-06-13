import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyPatchPreviewCanApply } from "../../src/features/projects/patchApplySandbox.server";
import {
  createPatchSnapshotFromSandbox,
  type ProjectPatchSnapshot,
  type ProjectPatchSnapshotFile,
} from "../../src/features/projects/patchSnapshot";
import { createWorkingCopyExportBundle } from "../../src/features/projects/workingCopyExport";
import {
  buildProjectPipelineDiagnostics,
  buildPipelineSafetyInvariants,
} from "../../src/features/projects/projectPipelineDiagnostics";
import {
  buildWritebackReviewSummary,
  buildWritebackRequestRiskSummary,
  validateWritebackStatusTransition,
  type ProjectWritebackRequest,
} from "../../src/features/projects/projectWritebackRequestService";
import {
  buildWorkingCopyRows,
  validateRequestCanExecute,
  type ProjectWorkingCopy,
  type ProjectWorkingCopyFile,
} from "../../src/features/projects/projectWorkingCopyService";
import type {
  GroundedPatchPreview,
  ProjectFile,
  ProjectTextPreviewWithPath,
} from "../../src/features/projects/types";

const createdAt = "2026-06-14T00:00:00.000Z";

const projectFile: ProjectFile = {
  id: "file-1",
  project_id: "project-1",
  user_id: "user-1",
  path: "src/app.ts",
  name: "app.ts",
  extension: "ts",
  size_bytes: 34,
  mime_type: "text/typescript",
  checksum: "hash-1",
  content_sha256: "hash-1",
  ingestion_job_id: "job-1",
  is_text: true,
  is_previewable: true,
  skipped: false,
  skip_reason: null,
  indexed_at: createdAt,
  created_at: createdAt,
};

const safePreview: ProjectTextPreviewWithPath = {
  id: "preview-1",
  project_id: projectFile.project_id,
  file_id: projectFile.id,
  user_id: projectFile.user_id,
  preview_text: "export const value = 'old';\n",
  summary: "Safe indexed preview",
  detected_language: "typescript",
  indexed_at: createdAt,
  truncated: false,
  line_count: 1,
  token_estimate: 8,
  metadata: { safe_preview: true },
  created_at: createdAt,
  path: projectFile.path,
};

const patchPreview: GroundedPatchPreview = {
  id: "patch-1",
  projectId: projectFile.project_id,
  title: "Governed patch preview",
  status: "ready",
  summary: "Reviewable patch preview from safe preview text.",
  groundedFiles: [
    {
      fileId: projectFile.id,
      path: projectFile.path,
      contentSha256: projectFile.content_sha256,
      isPreviewable: true,
      sourcePreviewAvailable: true,
    },
  ],
  changes: [
    {
      filePath: projectFile.path,
      changeType: "modify",
      oldText: "'old'",
      newText: "'new'",
      unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n-'old'\n+'new'",
      hunks: [],
      warnings: [{ code: "ai_change_reason", message: "Generated for review only." }],
    },
  ],
  warnings: [{ code: "ai_change_reason", message: "Generated for review only." }],
  createdAt,
  updatedAt: createdAt,
};

function approvedRequest(snapshotId: string): ProjectWritebackRequest {
  return {
    id: "request-1",
    projectId: projectFile.project_id,
    patchPreviewId: patchPreview.id,
    snapshotId,
    requestedBy: "user-1",
    reviewerId: "admin-1",
    status: "approved",
    title: "Governed writeback review",
    requesterNote: "Please review the generated handoff.",
    reviewerNote: "Approved as a handoff artifact only.",
    reviewDecision: "approved",
    requiredApprovals: 1,
    currentApprovals: 1,
    riskLevel: "medium",
    changedFilesCount: 1,
    warnings: [],
    blockers: [],
    snapshotSummary: {
      derived_snapshot_only: true,
      original_project_files_modified: false,
      source_writeback: false,
    },
    metadata: {
      governance_request_only: true,
      source_writeback_performed: false,
      original_project_files_modified: false,
      original_text_previews_modified: false,
    },
    reviewMetadata: {},
    createdAt,
    updatedAt: createdAt,
    submittedAt: createdAt,
    reviewedAt: createdAt,
  };
}

test.describe("H.1 governed workflow end-to-end validation", () => {
  test("moves from safe preview to export handoff without direct source mutation", async () => {
    const originalPreviewText = safePreview.preview_text;
    const sandbox = verifyPatchPreviewCanApply({
      preview: patchPreview,
      files: [projectFile],
      textPreviews: [safePreview],
    });

    expect(sandbox.status).toBe("verified");
    expect(sandbox.files[0]).toMatchObject({
      filePath: "src/app.ts",
      changed: true,
      oldPreviewText: originalPreviewText,
    });
    expect(safePreview.preview_text).toBe(originalPreviewText);

    const builtSnapshot = await createPatchSnapshotFromSandbox({
      preview: patchPreview,
      sandbox,
      userId: "user-1",
    });
    const snapshot: ProjectPatchSnapshot = {
      id: "snapshot-1",
      projectId: builtSnapshot.snapshot.project_id,
      patchPreviewId: builtSnapshot.snapshot.patch_preview_id,
      createdBy: builtSnapshot.snapshot.created_by,
      status: builtSnapshot.snapshot.status,
      title: builtSnapshot.snapshot.title,
      summary: builtSnapshot.snapshot.summary,
      source: builtSnapshot.snapshot.source,
      verificationStatus: builtSnapshot.snapshot.verification_status,
      changedFilesCount: builtSnapshot.snapshot.changed_files_count,
      warnings: [],
      blockers: [],
      metadata: builtSnapshot.snapshot.metadata,
      createdAt,
    };
    const snapshotFiles: ProjectPatchSnapshotFile[] = builtSnapshot.files.map((file, index) => ({
      id: `snapshot-file-${index}`,
      snapshotId: snapshot.id,
      projectId: file.project_id,
      patchPreviewId: file.patch_preview_id,
      filePath: file.file_path,
      originalContentSha256: file.original_content_sha256,
      patchedContentSha256: file.patched_content_sha256,
      originalPreviewText: file.original_preview_text,
      patchedPreviewText: file.patched_preview_text,
      changed: file.changed,
      previewLimited: file.preview_limited,
      truncated: file.truncated,
      warnings: [],
      blockers: [],
      createdAt,
    }));

    expect(snapshot.metadata).toMatchObject({
      derived_snapshot_only: true,
      original_project_files_modified: false,
      original_text_previews_modified: false,
      source_writeback: false,
    });
    expect(snapshotFiles[0].patchedPreviewText).toContain("'new'");
    expect(snapshotFiles[0].originalPreviewText).toBe(originalPreviewText);

    const request = approvedRequest(snapshot.id);
    const risk = buildWritebackRequestRiskSummary({ snapshot, files: snapshotFiles });
    expect(risk.changedFilesCount).toBe(1);
    expect(request.metadata).toMatchObject({
      governance_request_only: true,
      source_writeback_performed: false,
    });

    const reviewSummary = buildWritebackReviewSummary({
      request: { ...request, status: "submitted" },
      actorId: "admin-1",
      action: "approve",
      newStatus: "approved",
    });
    expect(reviewSummary).toMatchObject({
      approvalAppliesChanges: false,
      sourceWritebackPerformed: false,
      originalProjectFilesModified: false,
      originalTextPreviewsModified: false,
    });

    const workingCopyRows = await buildWorkingCopyRows({
      request,
      snapshot,
      files: snapshotFiles,
      actorId: "admin-1",
    });
    expect(workingCopyRows.workingCopy.metadata).toMatchObject({
      createdFromApprovedRequest: true,
      originalProjectFilesModified: false,
      originalTextPreviewsModified: false,
      objectStorageModified: false,
      sourceZipOverwritten: false,
      codeExecuted: false,
      deploymentPerformed: false,
    });
    expect(workingCopyRows.files[0]).toMatchObject({
      file_path: "src/app.ts",
      content_text: snapshotFiles[0].patchedPreviewText,
      changed: true,
    });

    const workingCopy: ProjectWorkingCopy = {
      id: "working-copy-1",
      projectId: request.projectId,
      writebackRequestId: request.id,
      patchPreviewId: request.patchPreviewId,
      patchSnapshotId: request.snapshotId,
      createdBy: request.requestedBy,
      executedBy: "admin-1",
      status: "created",
      title: workingCopyRows.workingCopy.title,
      summary: workingCopyRows.workingCopy.summary,
      source: "approved_writeback_request",
      changedFilesCount: workingCopyRows.workingCopy.changedFilesCount,
      warnings: [],
      blockers: [],
      metadata: workingCopyRows.workingCopy.metadata,
      createdAt,
    };
    const workingCopyFile: ProjectWorkingCopyFile = {
      id: "working-copy-file-1",
      workingCopyId: workingCopy.id,
      projectId: workingCopy.projectId,
      writebackRequestId: request.id,
      patchSnapshotId: snapshot.id,
      filePath: workingCopyRows.files[0].file_path,
      contentSha256: workingCopyRows.files[0].content_sha256,
      contentText: workingCopyRows.files[0].content_text,
      sizeBytes: new TextEncoder().encode(workingCopyRows.files[0].content_text).length,
      changed: workingCopyRows.files[0].changed,
      previewLimited: true,
      truncated: false,
      warnings: [],
      blockers: [],
      createdAt,
    };
    const exportBundle = createWorkingCopyExportBundle({
      workingCopy,
      workingCopyFiles: [workingCopyFile],
      request: {
        id: request.id,
        status: request.status,
        reviewedAt: request.reviewedAt,
        reviewerId: request.reviewerId,
        requesterNote: request.requesterNote,
        reviewerNote: request.reviewerNote,
      },
      exportedAt: "2026-06-14T01:00:00.000Z",
    });

    expect(exportBundle.manifest).toMatchObject({
      source: "versioned working copy",
      originalProjectFilesModified: false,
      sourceZipOverwritten: false,
      objectStorageModified: false,
      productionWritebackIncluded: false,
      exportLimitedToWorkingCopyText: true,
    });
    expect(exportBundle.readme).toContain("Production/source writeback is not available yet");

    const diagnostics = buildProjectPipelineDiagnostics({
      projectId: projectFile.project_id,
      safePreviews: [safePreview],
      patchPreviews: [patchPreview],
      patchSnapshots: [snapshot],
      writebackRequests: [request],
      workingCopies: [workingCopy],
      workingCopyFiles: [workingCopyFile],
    });
    expect(diagnostics.releaseGate.sourceWritebackAvailable).toBe(false);
    expect(diagnostics.releaseGate.realSourceWritebackUnavailable).toBe(true);
    expect(diagnostics.releaseGate.canWorkingCopyBeExported).toBe(true);
    expect(buildPipelineSafetyInvariants().map((item) => item.key)).toContain(
      "direct_source_writeback_disabled",
    );
  });

  test("blocks review and execution before required evidence and authorization gates", () => {
    const diagnosticsWithoutEvidence = buildProjectPipelineDiagnostics({
      projectId: projectFile.project_id,
      safePreviews: [],
      patchPreviews: [],
      patchSnapshots: [],
      writebackRequests: [],
      workingCopies: [],
      workingCopyFiles: [],
    });
    const writebackRequestStage = diagnosticsWithoutEvidence.stages.find(
      (stage) => stage.key === "writebackRequest",
    );
    expect(writebackRequestStage?.status).toBe("blocked");
    expect(writebackRequestStage?.blockers.join(" ")).toContain("snapshot");

    expect(() =>
      validateWritebackStatusTransition({
        action: "approve",
        actorRole: "requester",
        fromStatus: "submitted",
      }),
    ).toThrow("Invalid");

    expect(() =>
      validateRequestCanExecute({
        request: {
          ...approvedRequest("snapshot-1"),
          status: "submitted",
          reviewDecision: null,
          reviewedAt: null,
          reviewerId: null,
        },
        snapshot: null,
        files: [],
      }),
    ).toThrow("approved");
  });

  test("keeps direct source writeback APIs unreachable from the governed AI session flow", () => {
    const executeRoute = readFileSync(
      resolve(process.cwd(), "src/routes/api/projects.writeback-execute.ts"),
      "utf8",
    );
    const githubService = readFileSync(
      resolve(process.cwd(), "src/features/github/githubService.ts"),
      "utf8",
    );
    const chatRoute = readFileSync(resolve(process.cwd(), "src/routes/api/chat.ts"), "utf8");

    expect(chatRoute).toContain("file mutation");
    expect(chatRoute).toContain("patch application");
    expect(chatRoute).not.toContain("createPullRequestWithChanges");
    expect(executeRoute).toContain("buildWorkingCopyRows");
    expect(executeRoute).toContain("project_working_copies");
    expect(executeRoute).toContain("project_working_copy_files");
    expect(executeRoute).toContain("createPullRequestWithChanges");
    expect(executeRoute).not.toContain('ref: "refs/heads/main"');
    expect(executeRoute).not.toContain("contents/");
    expect(githubService).toContain("Create PR");
    expect(githubService).toContain("refs/heads/${branchName}");
    expect(githubService).toContain("base: baseBranch");
    expect(githubService).not.toContain("PATCH");
    expect(githubService).not.toContain("PUT");
    expect(githubService).not.toContain("/contents/");
  });

  test("documents required governance audit and usage records for major actions", () => {
    const files = [
      "src/features/projects/server/ingestionProcessor.ts",
      "src/routes/api/chat.ts",
      "src/routes/api/projects.ai-patch-preview.ts",
      "src/features/projects/projectWritebackRequestService.ts",
      "src/routes/api/projects.writeback-review.ts",
      "src/routes/api/projects.writeback-execute.ts",
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));
    const source = files.join("\n");

    for (const eventType of [
      "chat_request_started",
      "project_upload_completed",
      "ai_request",
      "writeback_request_created",
      "writeback_working_copy_created",
    ]) {
      expect(source).toContain(eventType);
    }
    expect(source).toContain("writeback_request_${");
    expect(source).toContain('"approved"');
    expect(source).toContain('"rejected"');
    expect(source).toContain('"submitted"');
    expect(source).toContain("usage_events");
    expect(source).toContain("audit_events");
    expect(source).toContain("source_writeback_performed: false");
    expect(source).toContain("original_project_files_modified: false");
  });
});
