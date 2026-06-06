export type ExternalApplyStatus = "pending" | "processing" | "completed" | "failed";
export type ExecutionAdapterType = "github_pr" | "ci_webhook" | "ssh_deploy";

export interface ExternalApplyQueueItem {
  id: string;
  projectId: string;
  workingCopyId: string;
  adapterType: ExecutionAdapterType;
  status: ExternalApplyStatus;
  payload: Record<string, any>;
  resultMetadata: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditEventType = 
  | "session_created" 
  | "patch_generated" 
  | "review_approved" 
  | "export_executed" 
  | "external_apply_triggered";

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  tenantId: string | null;
  eventType: AuditEventType;
  payload: Record<string, any>;
  previousHash: string | null;
}

export interface ExecutionAdapterConfig {
  adapterType: ExecutionAdapterType;
  enabled: boolean;
}

export interface ExecutionAdapter {
  type: ExecutionAdapterType;
  execute(workingCopyId: string, payload: Record<string, any>): Promise<{ success: boolean; resultMetadata: Record<string, any>; error?: string }>;
}

export interface GitHubExecutionAdapter extends ExecutionAdapter {
  type: "github_pr";
  config: {
    owner: string;
    repo: string;
    baseBranch: string;
    token: string;
  };
}

export interface WebhookExecutionAdapter extends ExecutionAdapter {
  type: "ci_webhook";
  config: {
    webhookUrl: string;
    secret: string;
  };
}

export interface SSHExecutionAdapter extends ExecutionAdapter {
  type: "ssh_deploy";
  config: {
    host: string;
    user: string;
    privateKey: string;
    deployPath: string;
  };
}
