import type { LanguageModel } from "ai";
import type { ProviderInfo, ProviderStatus, ProviderCapability } from "./provider-types";

export interface ProviderAdapter {
  getId(): string;
  getStatus(): ProviderStatus;
  getCapabilities(): ProviderCapability[];
  getPriority(): number;
  isFreeTier(): boolean;
  getDefaultModel(): string;
  createModel(modelId?: string): LanguageModel;
}

export function createProviderAdapter(
  id: string,
  status: ProviderStatus,
  capabilities: ProviderCapability[],
  priority: number,
  freeTier: boolean,
  defaultModel: string,
  modelFactory: (modelId: string) => LanguageModel,
): ProviderAdapter {
  return {
    getId: () => id,
    getStatus: () => status,
    getCapabilities: () => capabilities,
    getPriority: () => priority,
    isFreeTier: () => freeTier,
    getDefaultModel: () => defaultModel,
    createModel: (modelId) => modelFactory(modelId || defaultModel),
  };
}

export interface ProviderSelectionResult {
  provider: ProviderAdapter;
  model: LanguageModel;
  usedFallback: boolean;
  reason?: string;
}

export function toProviderInfo(adapter: ProviderAdapter): ProviderInfo {
  return {
    id: adapter.getId(),
    capabilities: adapter.getCapabilities(),
    status: adapter.getStatus(),
    priority: adapter.getPriority(),
    freeTier: adapter.isFreeTier(),
    defaultModel: adapter.getDefaultModel(),
  };
}
