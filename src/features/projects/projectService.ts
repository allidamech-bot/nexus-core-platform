import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  Project,
  ProjectFile,
  ProjectIngestionJob,
  ProjectIngestionStatus,
  ProjectSecurityEvent,
  ProjectStatus,
  ProjectTextPreviewWithPath,
} from "./types";

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function listLatestIngestionJobs(
  projectIds: string[],
): Promise<ProjectIngestionJob[]> {
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("project_ingestion_jobs")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectIngestionJob[];
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("path", { ascending: true })
    .limit(250);

  if (error) throw error;
  return (data ?? []) as ProjectFile[];
}

export async function listProjectTextPreviews(
  projectId: string,
): Promise<ProjectTextPreviewWithPath[]> {
  const { data: previews, error: previewError } = await supabase
    .from("project_text_previews")
    .select("*")
    .eq("project_id", projectId)
    .order("indexed_at", { ascending: false })
    .limit(24);

  if (previewError) throw previewError;
  if (!previews?.length) return [];

  const fileIds = previews.map((preview) => preview.file_id);
  const { data: files, error: fileError } = await supabase
    .from("project_files")
    .select("id,path")
    .in("id", fileIds);

  if (fileError) throw fileError;
  const pathsByFileId = new Map((files ?? []).map((file) => [file.id, file.path]));

  return previews.map((preview) => ({
    ...preview,
    path: pathsByFileId.get(preview.file_id) ?? "unknown",
  })) as ProjectTextPreviewWithPath[];
}

export async function createProject(input: {
  userId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  sourceType?: Project["source_type"];
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: input.userId,
      name: input.name,
      description: input.description?.trim() || null,
      source_type: input.sourceType ?? "zip",
      status: input.status ?? "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) throw error;
}

export async function archiveProject(projectId: string): Promise<Project> {
  const archivedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("projects")
    .update({ status: "archived", updated_at: archivedAt })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw error;
  if (!data || data.status !== "archived") {
    throw new Error("Project archive could not be confirmed.");
  }
  return data as Project;
}

export async function createIngestionJob(input: {
  projectId: string;
  userId: string;
  status?: ProjectIngestionStatus;
  stage?: string;
  metadata?: Record<string, Json>;
}): Promise<ProjectIngestionJob> {
  const { data, error } = await supabase
    .from("project_ingestion_jobs")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      status: input.status ?? "pending",
      stage: input.stage ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectIngestionJob;
}

export async function updateIngestionJob(
  jobId: string,
  patch: {
    status?: ProjectIngestionStatus;
    stage?: string | null;
    error_message?: string | null;
    metadata?: Record<string, Json>;
  },
): Promise<void> {
  const { error } = await supabase
    .from("project_ingestion_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) throw error;
}

export async function createProjectFile(input: {
  projectId: string;
  userId: string;
  path: string;
  name: string;
  extension: string | null;
  sizeBytes: number;
  mimeType: string | null;
  checksum: string | null;
}): Promise<ProjectFile> {
  const { data, error } = await supabase
    .from("project_files")
    .upsert(
      {
        project_id: input.projectId,
        user_id: input.userId,
        path: input.path,
        name: input.name,
        extension: input.extension,
        size_bytes: input.sizeBytes,
        mime_type: input.mimeType,
        checksum: input.checksum,
      },
      { onConflict: "project_id,path" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as ProjectFile;
}

export async function logProjectSecurityEvent(input: {
  userId: string;
  projectId?: string | null;
  eventType: string;
  severity: ProjectSecurityEvent["severity"];
  payload?: Record<string, Json>;
}): Promise<void> {
  const { error } = await supabase.from("project_security_events").insert({
    user_id: input.userId,
    project_id: input.projectId ?? null,
    event_type: input.eventType,
    severity: input.severity,
    payload: input.payload ?? {},
  });

  if (error) throw error;
}

export async function attachProjectToThread(input: {
  threadId: string;
  projectId: string;
  projectName: string;
}): Promise<void> {
  const { error } = await supabase
    .from("threads")
    .update({
      project_id: input.projectId,
      project_name: input.projectName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.threadId);

  if (error) throw error;
}

export async function logThreadContextSelection(input: {
  threadId: string;
  projectId: string;
  userId: string;
  action: "attached_project" | "selected_preview" | "cleared_preview";
  previewId?: string | null;
  fileId?: string | null;
  metadata?: Record<string, Json>;
}): Promise<void> {
  const { error } = await supabase.from("thread_context_selections").insert({
    thread_id: input.threadId,
    project_id: input.projectId,
    user_id: input.userId,
    action: input.action,
    preview_id: input.previewId ?? null,
    file_id: input.fileId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}
