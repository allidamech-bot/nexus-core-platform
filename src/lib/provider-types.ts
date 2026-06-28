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
}
