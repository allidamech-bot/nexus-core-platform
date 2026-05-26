import { expect, test } from "@playwright/test";
import { verifyPatchPreviewCanApply } from "../../src/features/projects/patchApplySandbox";
import {
  createPatchSnapshotFromSandbox,
  hashPatchedText,
} from "../../src/features/projects/patchSnapshot";
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
