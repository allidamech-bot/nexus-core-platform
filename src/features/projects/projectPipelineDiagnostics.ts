import type { ProjectPatchSnapshot } from "./patchSnapshot";
import type { ProjectWorkingCopy, ProjectWorkingCopyFile } from "./projectWorkingCopyService";
import type { ProjectWritebackRequest } from "./projectWritebackRequestService";
import type { GroundedPatchPreview, ProjectTextPreviewWithPath } from "./types";

export type PipelineStageKey =
  | "uploadQuota"
  | "zipProcessing"
  | "safePreview"
  | "patchPreview"
  | "aiPatchPreview"
  | "sandboxVerification"
  | "patchSnapshot"
  | "snapshotExport"
  | "writebackRequest"
  | "writebackReview"
  | "workingCopy"
  | "workingCopyExport";

export type PipelineStageStatus =
  | "not_started"
  | "ready"
  | "blocked"
  | "warning"
  | "complete"
  | "failed";

export interface PipelineStageDiagnostic {
  key: PipelineStageKey;
  status: PipelineStageStatus;
  label: string;
  description: string;
  requiredNextAction: string;
  blockers: string[];
  warnings: string[];
  safeToContinue: boolean;
  sourceIds: Record<string, string | null>;
}

export interface PipelineReleaseGateSummary {
  canUploadProcessZip: boolean;
  safePreviewReady: boolean;
  patchPreviewReady: boolean;
  aiPatchPreviewConfigured: boolean;
  canSandboxVerificationRun: boolean;
  canSnapshotBeCreated: boolean;
  canSnapshotBeExported: boolean;
  canWritebackRequestBeCreated: boolean;
  canRequestBeReviewed: boolean;
  canWorkingCopyBeCreated: boolean;
  canWorkingCopyBeExported: boolean;
  realSourceWritebackUnavailable: true;
  sourceWritebackAvailable: false;
  blockers: string[];
  warnings: string[];
}

export interface PipelineSafetyInvariant {
  key: string;
  label: string;
  confirmed: true;
}

export interface ProjectPipelineDiagnostics {
  stages: PipelineStageDiagnostic[];
  releaseGate: PipelineReleaseGateSummary;
  safetyInvariants: PipelineSafetyInvariant[];
  health: ReturnType<typeof summarizeProjectPipelineHealth>;
}

export interface ProjectPipelineDiagnosticsInput {
  projectId?: string | null;
  safePreviews?: ProjectTextPreviewWithPath[];
  patchPreviews?: GroundedPatchPreview[];
  patchSnapshots?: ProjectPatchSnapshot[];
  writebackRequests?: ProjectWritebackRequest[];
  workingCopies?: ProjectWorkingCopy[];
  workingCopyFiles?: ProjectWorkingCopyFile[];
  uploadQuotaAvailable?: boolean | null;
  aiPatchPreviewConfigured?: boolean | null;
}

export const PIPELINE_STAGE_ORDER: PipelineStageKey[] = [
  "uploadQuota",
  "zipProcessing",
  "safePreview",
  "patchPreview",
  "aiPatchPreview",
  "sandboxVerification",
  "patchSnapshot",
  "snapshotExport",
  "writebackRequest",
  "writebackReview",
  "workingCopy",
  "workingCopyExport",
];

function stage(input: Omit<PipelineStageDiagnostic, "safeToContinue">): PipelineStageDiagnostic {
  return {
    ...input,
    safeToContinue:
      input.status === "ready" || input.status === "complete" || input.status === "warning",
  };
}

function hasReadyPatchPreview(previews: GroundedPatchPreview[]) {
  return previews.some((preview) => preview.status === "ready");
}

function hasAiPatchPreview(previews: GroundedPatchPreview[]) {
  return previews.some((preview) =>
    preview.warnings.some((warning) => warning.code.startsWith("ai_")),
  );
}

function latestSnapshot(snapshots: ProjectPatchSnapshot[]) {
  return snapshots.find((snapshot) => snapshot.status === "created") ?? snapshots[0] ?? null;
}

function latestRequest(requests: ProjectWritebackRequest[]) {
  return (
    requests.find((request) => request.status === "approved") ??
    requests.find((request) => request.status === "submitted") ??
    requests[0] ??
    null
  );
}

export function getPipelineStageStatus(stageDiagnostic: PipelineStageDiagnostic) {
  return stageDiagnostic.status;
}

export function getPipelineBlockingReasons(stages: PipelineStageDiagnostic[]) {
  return stages.flatMap((item) => item.blockers.map((blocker) => `${item.label}: ${blocker}`));
}

export function getPipelineWarnings(stages: PipelineStageDiagnostic[]) {
  return stages.flatMap((item) => item.warnings.map((warning) => `${item.label}: ${warning}`));
}

export function buildPipelineSafetyInvariants(): PipelineSafetyInvariant[] {
  return [
    {
      key: "project_files_unchanged",
      label: "Original project_files remain unchanged by patch, snapshot, and working-copy phases.",
      confirmed: true,
    },
    {
      key: "project_text_previews_unchanged",
      label:
        "Original project_text_previews remain unchanged by patch, snapshot, and working-copy phases.",
      confirmed: true,
    },
    {
      key: "object_storage_unchanged",
      label:
        "Object storage is not written during patch, snapshot, working-copy, or export phases.",
      confirmed: true,
    },
    {
      key: "source_zip_unchanged",
      label: "The source ZIP is not overwritten.",
      confirmed: true,
    },
    {
      key: "code_not_executed",
      label: "Uploaded or generated code is never executed.",
      confirmed: true,
    },
    {
      key: "package_scripts_not_run",
      label: "Package scripts and dependency installation are not run.",
      confirmed: true,
    },
    {
      key: "approval_is_governance_only",
      label: "Writeback approval does not apply changes.",
      confirmed: true,
    },
    {
      key: "working_copy_separate",
      label: "Working copies are separate versioned records derived from snapshots.",
      confirmed: true,
    },
    {
      key: "exports_bounded_sanitized",
      label: "Snapshot and working-copy exports are bounded and path-sanitized.",
      confirmed: true,
    },
  ];
}

export function buildPipelineReleaseGateSummary(
  stages: PipelineStageDiagnostic[],
): PipelineReleaseGateSummary {
  const byKey = new Map(stages.map((item) => [item.key, item]));
  const isReady = (key: PipelineStageKey) => {
    const status = byKey.get(key)?.status;
    return status === "ready" || status === "complete" || status === "warning";
  };

  return {
    canUploadProcessZip: isReady("uploadQuota"),
    safePreviewReady: isReady("safePreview"),
    patchPreviewReady: isReady("patchPreview"),
    aiPatchPreviewConfigured: isReady("aiPatchPreview"),
    canSandboxVerificationRun: isReady("sandboxVerification"),
    canSnapshotBeCreated: isReady("patchSnapshot"),
    canSnapshotBeExported: isReady("snapshotExport"),
    canWritebackRequestBeCreated: isReady("writebackRequest"),
    canRequestBeReviewed: isReady("writebackReview"),
    canWorkingCopyBeCreated: isReady("workingCopy"),
    canWorkingCopyBeExported: isReady("workingCopyExport"),
    realSourceWritebackUnavailable: true,
    sourceWritebackAvailable: false,
    blockers: getPipelineBlockingReasons(stages),
    warnings: getPipelineWarnings(stages),
  };
}

export function summarizeProjectPipelineHealth(stages: PipelineStageDiagnostic[]) {
  const completeCount = stages.filter((item) => item.status === "complete").length;
  const warningCount = stages.filter((item) => item.status === "warning").length;
  const blockedCount = stages.filter((item) => item.status === "blocked").length;
  const failedCount = stages.filter((item) => item.status === "failed").length;

  return {
    totalStages: stages.length,
    completeCount,
    warningCount,
    blockedCount,
    failedCount,
    hasBlockers: blockedCount > 0 || failedCount > 0,
    readyToContinue: blockedCount === 0 && failedCount === 0,
  };
}

export function buildProjectPipelineDiagnostics(
  input: ProjectPipelineDiagnosticsInput,
): ProjectPipelineDiagnostics {
  const safePreviews = input.safePreviews ?? [];
  const patchPreviews = input.patchPreviews ?? [];
  const patchSnapshots = input.patchSnapshots ?? [];
  const writebackRequests = input.writebackRequests ?? [];
  const workingCopies = input.workingCopies ?? [];
  const readyPatchPreview = hasReadyPatchPreview(patchPreviews);
  const snapshot = latestSnapshot(patchSnapshots);
  const request = latestRequest(writebackRequests);
  const approvedRequest = writebackRequests.find((item) => item.status === "approved") ?? null;
  const workingCopy = workingCopies[0] ?? null;
  const stages: PipelineStageDiagnostic[] = [
    stage({
      key: "uploadQuota",
      status: input.uploadQuotaAvailable === false ? "blocked" : "ready",
      label: "Upload quota",
      description: "Checks whether ZIP upload can proceed under governance limits.",
      requiredNextAction:
        input.uploadQuotaAvailable === false
          ? "Resolve the upload quota block before uploading."
          : "Upload or reuse a ZIP-backed project.",
      blockers: input.uploadQuotaAvailable === false ? ["Upload quota is blocked."] : [],
      warnings: input.uploadQuotaAvailable === null ? ["Quota status is not loaded."] : [],
      sourceIds: { projectId: input.projectId ?? null },
    }),
    stage({
      key: "zipProcessing",
      status: input.projectId ? "complete" : "not_started",
      label: "ZIP processing",
      description: "Processes the uploaded ZIP into manifest rows and safe text previews.",
      requiredNextAction: input.projectId
        ? "Review safe previews."
        : "Upload a ZIP project to start processing.",
      blockers: [],
      warnings: input.projectId ? [] : ["No project record is selected."],
      sourceIds: { projectId: input.projectId ?? null },
    }),
    stage({
      key: "safePreview",
      status: safePreviews.length > 0 ? "complete" : input.projectId ? "blocked" : "not_started",
      label: "Safe preview",
      description: "Safe preview file tree and indexed text snippets are available.",
      requiredNextAction:
        safePreviews.length > 0
          ? "Create a grounded patch preview."
          : "Process a ZIP with previewable text files.",
      blockers: safePreviews.length > 0 ? [] : ["No safe text previews are available."],
      warnings: [],
      sourceIds: { projectId: input.projectId ?? null },
    }),
    stage({
      key: "patchPreview",
      status: readyPatchPreview ? "complete" : safePreviews.length > 0 ? "ready" : "blocked",
      label: "Grounded patch preview",
      description: "Creates read-only patch proposals grounded in safe preview text.",
      requiredNextAction: readyPatchPreview
        ? "Verify the patch preview in the sandbox."
        : "Generate a grounded patch preview from safe preview text.",
      blockers: safePreviews.length > 0 ? [] : ["Safe previews are required first."],
      warnings: [],
      sourceIds: { patchPreviewId: patchPreviews[0]?.id ?? null },
    }),
    stage({
      key: "aiPatchPreview",
      status:
        hasAiPatchPreview(patchPreviews) || input.aiPatchPreviewConfigured
          ? readyPatchPreview
            ? "complete"
            : "ready"
          : safePreviews.length > 0
            ? "warning"
            : "blocked",
      label: "AI patch preview",
      description: "Generates AI-grounded patch previews from selected safe text snippets.",
      requiredNextAction:
        safePreviews.length > 0
          ? "Generate an AI patch preview when AI gateway credentials are configured."
          : "Create safe previews before AI patch preview generation.",
      blockers: safePreviews.length > 0 ? [] : ["Safe previews are required first."],
      warnings:
        input.aiPatchPreviewConfigured || hasAiPatchPreview(patchPreviews)
          ? []
          : ["AI gateway configuration is environment-dependent."],
      sourceIds: { patchPreviewId: patchPreviews[0]?.id ?? null },
    }),
    stage({
      key: "sandboxVerification",
      status: snapshot ? "complete" : readyPatchPreview ? "ready" : "blocked",
      label: "Sandbox verification",
      description: "Verifies patch changes against indexed text only without executing code.",
      requiredNextAction: snapshot
        ? "Create or export a versioned patch snapshot."
        : "Run sandbox verification on a ready patch preview.",
      blockers: readyPatchPreview ? [] : ["A ready patch preview is required."],
      warnings: [],
      sourceIds: { patchPreviewId: patchPreviews[0]?.id ?? null },
    }),
    stage({
      key: "patchSnapshot",
      status: snapshot ? "complete" : readyPatchPreview ? "ready" : "blocked",
      label: "Patch snapshot",
      description: "Stores a derived, versioned snapshot from sandbox-verified preview text.",
      requiredNextAction: snapshot
        ? "Export the snapshot or request writeback review."
        : "Create a versioned patch snapshot.",
      blockers: readyPatchPreview ? [] : ["A ready patch preview is required."],
      warnings: snapshot?.blockers.length ? ["Latest snapshot has blockers."] : [],
      sourceIds: { patchSnapshotId: snapshot?.id ?? null },
    }),
    stage({
      key: "snapshotExport",
      status: snapshot ? "complete" : readyPatchPreview ? "blocked" : "not_started",
      label: "Snapshot export",
      description: "Downloads the versioned patch snapshot as a bounded JSON review bundle.",
      requiredNextAction: snapshot
        ? "Download snapshot export if review artifacts are needed."
        : "Create a versioned patch snapshot before export.",
      blockers: snapshot ? [] : ["Create a versioned patch snapshot before export."],
      warnings: [],
      sourceIds: { patchSnapshotId: snapshot?.id ?? null },
    }),
    stage({
      key: "writebackRequest",
      status: request ? "complete" : snapshot ? "ready" : "blocked",
      label: "Writeback request",
      description: "Creates a governed request for future writeback consideration.",
      requiredNextAction: request
        ? "Submit or monitor the writeback request."
        : "Create a writeback review request from the snapshot.",
      blockers: snapshot ? [] : ["A snapshot is required before requesting review."],
      warnings: [],
      sourceIds: { requestId: request?.id ?? null, patchSnapshotId: snapshot?.id ?? null },
    }),
    stage({
      key: "writebackReview",
      status: approvedRequest
        ? "complete"
        : request?.status === "submitted"
          ? "ready"
          : request?.status === "rejected" || request?.status === "cancelled"
            ? "blocked"
            : request
              ? "warning"
              : "blocked",
      label: "Writeback review",
      description: "Admin/reviewer approval or rejection; approval does not apply changes.",
      requiredNextAction: approvedRequest
        ? "Create a separate versioned working copy."
        : request?.status === "submitted"
          ? "Reviewer/admin can approve or reject."
          : "Submit the request for review.",
      blockers: request ? [] : ["A writeback request is required."],
      warnings:
        request && request.status !== "submitted" && request.status !== "approved"
          ? [`Request is ${request.status}.`]
          : [],
      sourceIds: { requestId: request?.id ?? null },
    }),
    stage({
      key: "workingCopy",
      status: workingCopy ? "complete" : approvedRequest ? "ready" : "blocked",
      label: "Versioned working copy",
      description: "Creates a separate working copy from an approved request.",
      requiredNextAction: workingCopy
        ? "Review or export the working copy."
        : "Create a versioned working copy from the approved request.",
      blockers: approvedRequest ? [] : ["An approved request is required."],
      warnings: [],
      sourceIds: { workingCopyId: workingCopy?.id ?? null, requestId: approvedRequest?.id ?? null },
    }),
    stage({
      key: "workingCopyExport",
      status: workingCopy ? "complete" : "blocked",
      label: "Working copy export",
      description: "Downloads the versioned working copy as a safe JSON review bundle.",
      requiredNextAction: workingCopy
        ? "Download the working copy export bundle."
        : "Create a versioned working copy first.",
      blockers: workingCopy ? [] : ["A working copy is required before export."],
      warnings: [],
      sourceIds: { workingCopyId: workingCopy?.id ?? null },
    }),
  ];

  const releaseGate = buildPipelineReleaseGateSummary(stages);
  const health = summarizeProjectPipelineHealth(stages);

  return {
    stages,
    releaseGate,
    safetyInvariants: buildPipelineSafetyInvariants(),
    health,
  };
}
