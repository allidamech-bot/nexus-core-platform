import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  importProjectFolder,
  uploadProjectZip,
  type ImportFolderInput,
  type UploadProjectInput,
} from "./projectUploadService";
import {
  archiveProject,
  listLatestIngestionJobs,
  listProjectFiles,
  listProjects,
  listProjectTextPreviews,
} from "./projectService";
import {
  createAiPatchPreview,
  createManualPatchPreview,
  createPatchSnapshot,
  downloadPatchSnapshotExport,
  getPatchPreviews,
  getPatchSnapshotFiles,
  getPatchSnapshots,
  getPreviewablePatchTargets,
  runPatchPreviewSandbox,
  type CreatePatchSnapshotResult,
  type CreateAiPatchPreviewInput,
  type CreateManualPatchPreviewInput,
} from "./projectPatchPreviewService";
import { governanceKeys } from "@/features/governance/governanceQueries";
import type {
  GroundedPatchPreview,
  ProjectFile,
  ProjectIngestionJob,
  ProjectTextPreviewWithPath,
  ProjectWithLatestJob,
} from "./types";
import type { PatchSandboxResult } from "./patchApplySandbox";
import type { ProjectPatchSnapshot, ProjectPatchSnapshotFile } from "./patchSnapshot";
import {
  cancelWritebackRequest,
  createWritebackRequestFromSnapshot,
  getWritebackRequests,
  submitWritebackRequest,
  type CreateWritebackRequestResult,
  type ProjectWritebackRequest,
} from "./projectWritebackRequestService";

export const projectKeys = {
  all: ["projects"] as const,
  files: (projectId: string) => ["projects", projectId, "files"] as const,
  previews: (projectId: string) => ["projects", projectId, "text-previews"] as const,
  patchPreviews: (projectId: string) => ["projects", projectId, "patch-previews"] as const,
  patchTargets: (projectId: string) => ["projects", projectId, "patch-targets"] as const,
  patchSnapshots: (projectId: string) => ["projects", projectId, "patch-snapshots"] as const,
  patchSnapshotFiles: (snapshotId: string) =>
    ["projects", "patch-snapshot-files", snapshotId] as const,
  writebackRequests: (projectId: string) => ["projects", projectId, "writeback-requests"] as const,
};

export function useProjectsQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: projectKeys.all,
    queryFn: async (): Promise<ProjectWithLatestJob[]> => {
      const projects = await listProjects();
      const jobs = await listLatestIngestionJobs(projects.map((project) => project.id));
      const latestJobs = new Map<string, ProjectIngestionJob>();

      for (const job of jobs) {
        if (!latestJobs.has(job.project_id)) {
          latestJobs.set(job.project_id, job);
        }
      }

      return projects.map((project) => ({
        ...project,
        latest_job: latestJobs.get(project.id) ?? null,
      }));
    },
  });
}

export function useUploadProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadProjectInput) => uploadProjectZip(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.files(result.project.id) });
      qc.invalidateQueries({ queryKey: projectKeys.previews(result.project.id) });
      qc.invalidateQueries({ queryKey: governanceKeys.all });
    },
  });
}

export function useImportFolderMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportFolderInput) => importProjectFolder(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.files(result.project.id) });
      qc.invalidateQueries({ queryKey: projectKeys.previews(result.project.id) });
      qc.invalidateQueries({ queryKey: governanceKeys.all });
    },
  });
}

export function useArchiveProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => archiveProject(projectId),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.files(project.id) });
      qc.invalidateQueries({ queryKey: projectKeys.previews(project.id) });
      qc.invalidateQueries({ queryKey: governanceKeys.all });
    },
  });
}

export function useProjectTextPreviewsQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectId
      ? projectKeys.previews(projectId)
      : ["projects", "text-previews", "disabled"],
    queryFn: async (): Promise<ProjectTextPreviewWithPath[]> => {
      if (!projectId) return [];
      return listProjectTextPreviews(projectId);
    },
  });
}

export function useProjectFilesQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectId ? projectKeys.files(projectId) : ["projects", "files", "disabled"],
    queryFn: async (): Promise<ProjectFile[]> => {
      if (!projectId) return [];
      return listProjectFiles(projectId);
    },
  });
}

export function usePatchPreviewsQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectId
      ? projectKeys.patchPreviews(projectId)
      : ["projects", "patch-previews", "disabled"],
    queryFn: async (): Promise<GroundedPatchPreview[]> => {
      if (!projectId) return [];
      return getPatchPreviews(projectId);
    },
  });
}

export function usePreviewablePatchTargetsQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectId
      ? projectKeys.patchTargets(projectId)
      : ["projects", "patch-targets", "disabled"],
    queryFn: async (): Promise<ProjectFile[]> => {
      if (!projectId) return [];
      return getPreviewablePatchTargets(projectId);
    },
  });
}

export function usePatchSnapshotsQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectId
      ? projectKeys.patchSnapshots(projectId)
      : ["projects", "patch-snapshots", "disabled"],
    queryFn: async (): Promise<ProjectPatchSnapshot[]> => {
      if (!projectId) return [];
      return getPatchSnapshots(projectId);
    },
  });
}

export function usePatchSnapshotFilesQuery(snapshotId: string | null) {
  return useQuery({
    enabled: Boolean(snapshotId),
    queryKey: snapshotId
      ? projectKeys.patchSnapshotFiles(snapshotId)
      : ["projects", "patch-snapshot-files", "disabled"],
    queryFn: async (): Promise<ProjectPatchSnapshotFile[]> => {
      if (!snapshotId) return [];
      return getPatchSnapshotFiles(snapshotId);
    },
  });
}

export function useCreatePatchPreviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualPatchPreviewInput) => createManualPatchPreview(input),
    onSuccess: (preview) => {
      qc.invalidateQueries({ queryKey: projectKeys.patchPreviews(preview.projectId) });
    },
  });
}

export function useCreateAiPatchPreviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiPatchPreviewInput) => createAiPatchPreview(input),
    onSuccess: (preview) => {
      qc.invalidateQueries({ queryKey: projectKeys.patchPreviews(preview.projectId) });
    },
  });
}

export function usePatchPreviewSandboxMutation() {
  return useMutation({
    mutationFn: (previewId: string): Promise<PatchSandboxResult> =>
      runPatchPreviewSandbox(previewId),
  });
}

export function useCreatePatchSnapshotMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (previewId: string): Promise<CreatePatchSnapshotResult> =>
      createPatchSnapshot(previewId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: projectKeys.patchSnapshots(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.patchSnapshotFiles(result.snapshot.id) });
    },
  });
}

export function useDownloadPatchSnapshotExportMutation() {
  return useMutation({
    mutationFn: (snapshotId: string): Promise<void> => downloadPatchSnapshotExport(snapshotId),
  });
}

export function useWritebackRequestsQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectId
      ? projectKeys.writebackRequests(projectId)
      : ["projects", "writeback-requests", "disabled"],
    queryFn: async (): Promise<ProjectWritebackRequest[]> => {
      if (!projectId) return [];
      return getWritebackRequests(projectId);
    },
  });
}

export function useCreateWritebackRequestMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      snapshotId: string;
      requesterNote?: string;
    }): Promise<CreateWritebackRequestResult> => createWritebackRequestFromSnapshot(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.writebackRequests(projectId) });
    },
  });
}

export function useSubmitWritebackRequestMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string): Promise<ProjectWritebackRequest> =>
      submitWritebackRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.writebackRequests(projectId) });
    },
  });
}

export function useCancelWritebackRequestMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string): Promise<ProjectWritebackRequest> =>
      cancelWritebackRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.writebackRequests(projectId) });
    },
  });
}
