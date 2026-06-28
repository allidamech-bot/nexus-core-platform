export type ProviderCapability =
  | "coding"
  | "planning"
  | "summarization"
  | "fast_response"
  | "structured_output"
  | "tool_calling"
  | "long_context"
  | "vision"
  | "local";

export type ProviderStatus = "configured" | "missing_key" | "disabled" | "error" | "rate_limited";

export type ProviderHealthStatus =
  | "healthy"
  | "missing_key"
  | "disabled"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "invalid_response"
  | "unsupported_provider"
  | "unknown";

export type TaskType = "coding" | "planning" | "summarization" | "chat" | "analysis";

export interface ProviderInfo {
  id: string;
  capabilities: ProviderCapability[];
  status: ProviderStatus;
  priority: number;
  freeTier: boolean;
  defaultModel?: string;
}

export interface ProviderRegistryEntry {
  id: string;
  capabilities: ProviderCapability[];
  envVar: string;
  defaultModel: string;
  priority: number;
  freeTier: boolean;
  status: ProviderStatus;
  endpointType: ProviderEndpointType;
  supportsModelEnv?: string;
}

export type ProviderEndpointType =
  | "openai_compatible"
  | "native"
  | "local_openai_compatible"
  | "unknown";

export type ProviderReadinessStatus =
  | "ready"
  | "missing_key"
  | "missing_endpoint"
  | "missing_model"
  | "unsupported"
  | "needs_live_check"
  | "failed_live_check"
  | "unknown";

export interface ProviderReadiness {
  providerId: string;
  configured: boolean;
  endpointConfigured: boolean;
  modelConfigured: boolean;
  supportsOpenAICompatibleChat: boolean;
  requiresSpecialHeaders: boolean;
  endpointType: ProviderEndpointType;
  readinessStatus: ProviderReadinessStatus;
  sanitizedMessage: string;
  developerMessage: string;
}

export interface ProviderHealthEntry {
  providerId: string;
  status: ProviderHealthStatus;
  lastCheckedAt: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorSummary: string | null;
  consecutiveFailures: number;
  cooldownUntil: number | null;
}

export type ExecutionErrorType =
  | "missing_key"
  | "rate_limited"
  | "provider_error"
  | "timeout"
  | "invalid_response"
  | "no_available_provider";

export interface ExecutionError {
  type: ExecutionErrorType;
  message: string;
  providerId?: string;
  modelId?: string;
}

export interface UnifiedGenerateInput {
  taskType: TaskType;
  prompt: string;
  system?: string;
  modelId?: string;
}

export interface UnifiedGenerateResult {
  text: string;
  internalProvider: string;
  internalModel: string;
  status: "success" | "error";
  error?: ExecutionError;
}
