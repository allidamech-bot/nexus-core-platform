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
}

export interface AgentToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
