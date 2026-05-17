export type AgentMode = "engineering" | "business" | "research" | "workflow" | "debugging";

export type VerificationStatus = "passed" | "failed" | "warning" | "not_run" | "running";

export interface VerificationResult {
  id: string;
  type: string;
  status: VerificationStatus;
  detail?: string;
}

export type TaskStatus =
  | "pending"
  | "planning"
  | "awaiting_approval"
  | "running"
  | "verifying"
  | "completed"
  | "failed";

export interface ExecutionStep {
  id: string;
  title: string;
  status: TaskStatus;
  log?: string;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "dir";
  status?: "added" | "modified" | "deleted";
  children?: FileNode[];
}

export interface ThreadRow {
  id: string;
  user_id: string;
  title: string;
  mode: string;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
  updated_at: string;
}
