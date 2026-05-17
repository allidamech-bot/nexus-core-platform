import type { Json } from "@/integrations/supabase/types";

export type ProjectSourceType = "zip" | "github" | "local" | "manual";

export type ProjectStatus =
  | "pending"
  | "validating"
  | "uploaded"
  | "processing"
  | "indexing_mocked"
  | "indexed_manifest"
  | "completed"
  | "failed"
  | "archived";

export type ProjectIngestionStatus =
  | "pending"
  | "validating"
  | "uploaded"
  | "processing"
  | "indexing_mocked"
  | "completed"
  | "failed";

export type ProjectSecuritySeverity = "info" | "warning" | "critical";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_type: ProjectSourceType;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectIngestionJob {
  id: string;
  project_id: string;
  user_id: string;
  status: ProjectIngestionStatus;
  stage: string | null;
  error_message: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  user_id: string;
  path: string;
  name: string;
  extension: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  checksum: string | null;
  created_at: string;
}

export interface ProjectSecurityEvent {
  id: string;
  user_id: string;
  project_id: string | null;
  event_type: string;
  severity: ProjectSecuritySeverity;
  payload: Json;
  created_at: string;
}

export interface ProjectWithLatestJob extends Project {
  latest_job: ProjectIngestionJob | null;
}

export interface ProjectChatMetadata {
  name: string;
  source_type: ProjectSourceType;
  status: ProjectStatus;
  ingestion_status: ProjectIngestionStatus | "none";
  manifest?: ProjectManifest | null;
}

export interface ProjectManifestDirectory {
  path: string;
  file_count: number;
}

export interface ProjectStackHint {
  kind: "language" | "framework" | "package_manager" | "config" | "entry_point";
  name: string;
  evidence: string;
}

export interface ProjectManifest {
  version: 1;
  generated_at: string;
  file_count: number;
  directory_count: number;
  total_size_bytes: number;
  skipped_file_count: number;
  skipped_reasons: Record<string, number>;
  languages: string[];
  frameworks: string[];
  package_managers: string[];
  root_config_files: string[];
  likely_entry_points: string[];
  directories: ProjectManifestDirectory[];
  stack_hints: ProjectStackHint[];
}
