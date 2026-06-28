import type { ExecutionError } from "./provider-types";

export type AgentTaskType =
  | "coding"
  | "planning"
  | "summarization"
  | "validation_explanation"
  | "project_review"
  | "refactor"
  | "bugfix";

export type AgentLifecycleStage =
  | "user_instruction"
  | "task_classification"
  | "context_gathering"
  | "planning"
  | "proposed_changes"
  | "validation_plan"
  | "final_report";

export interface AgentSessionInput {
  projectId: string;
  userInstruction: string;
  maxContextBytes?: number;
}

export interface AgentContextBundle {
  projectId: string;
  projectName?: string;
  files: AgentFileInfo[];
  previews: AgentFilePreview[];
  totalBytes: number;
  trimmed: boolean;
}

export interface AgentFileInfo {
  path: string;
  name: string;
  extension: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
}

export interface AgentFilePreview {
  path: string;
  previewText: string;
  summary: string;
  detectedLanguage: string | null;
  truncated: boolean;
  tokenEstimate: number;
}

export interface ProposedChange {
  filePath: string;
  reason: string;
  suggestedPatch: string;
  riskLevel: "low" | "medium" | "high";
}

export type PatchChangeType = "create" | "update" | "delete" | "rename";

export type ApprovalStatus = "pending_review" | "approved" | "rejected" | "blocked";

export interface PatchProposal {
  proposal_id: string;
  target_file_path: string;
  change_summary: string;
  risk_level: "low" | "medium" | "high" | "blocked";
  change_type: PatchChangeType;
  before_preview: string;
  after_preview: string;
  unified_diff: string;
  approval_required: boolean;
  approval_status: ApprovalStatus;
  blocked_reason?: string;
  risk_reasons: string[];
  validation_suggestions: string[];
  agent_confidence: number;
}

export interface PatchProposalBundle {
  proposals: PatchProposal[];
  summary: {
    total: number;
    low: number;
    medium: number;
    high: number;
    blocked: number;
    requires_approval: number;
  };
}

export interface AgentPlan {
  summary: string;
  steps: AgentPlanStep[];
}

export interface AgentPlanStep {
  order: number;
  description: string;
  targetFiles: string[];
  estimatedComplexity: "low" | "medium" | "high";
}

export interface AgentValidationPlan {
  commands: string[];
  explanation: string;
}

export interface AgentFinalReport {
  summary: string;
  plan: AgentPlan;
  proposedChanges: ProposedChange[];
  validationPlan: AgentValidationPlan;
  risks: string[];
}

export interface AgentSessionResult {
  stage: AgentLifecycleStage;
  taskType: AgentTaskType;
  providerUsed: string;
  modelUsed: string;
  status: "success" | "error";
  error?: ExecutionError;
  context?: AgentContextBundle;
  plan?: AgentPlan;
  proposedChanges?: ProposedChange[];
  validationPlan?: AgentValidationPlan;
  finalReport?: AgentFinalReport;
  patchProposals?: PatchProposalBundle;
}

export interface AgentToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
