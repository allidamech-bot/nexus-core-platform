import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  importProjectFolder,
  uploadProjectZip,
  type ImportFolderInput,
  type UploadProjectInput,
} from "./projectUploadService";
import {
  listLatestIngestionJobs,
  listProjectFiles,
  listProjects,
  listProjectTextPreviews,
} from "./projectService";
import type {
  ProjectFile,
  ProjectIngestionJob,
  ProjectTextPreviewWithPath,
  ProjectWithLatestJob,
} from "./types";

export const projectKeys = {
  all: ["projects"] as const,
  files: (projectId: string) => ["projects", projectId, "files"] as const,
  previews: (projectId: string) => ["projects", projectId, "text-previews"] as const,
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
