import type { LanguageModel } from "ai";
import type { ProviderAdapter, ProviderSelectionResult } from "./provider-adapter";
import type { TaskType, ProviderCapability } from "./provider-types";
import { getAllProviders, getProviderById } from "./provider-registry";

const TASK_TYPE_CAPABILITIES: Record<TaskType, ProviderCapability[]> = {
  coding: ["coding", "fast_response"],
  planning: ["planning", "structured_output"],
  summarization: ["summarization", "long_context"],
  chat: ["fast_response"],
  analysis: ["long_context", "structured_output"],
};

export interface AutoFreeRouter {
  selectProvider(taskType: TaskType, modelId?: string): ProviderSelectionResult | null;
  getAvailableProviders(): ProviderAdapter[];
  getFreeProviders(): ProviderAdapter[];
}

export function createAutoFreeRouter(): AutoFreeRouter {
  const providers = getAllProviders();

  function selectProvider(taskType: TaskType, modelId?: string): ProviderSelectionResult | null {
    const requiredCapabilities = TASK_TYPE_CAPABILITIES[taskType] || [];

    const availableProviders = providers
      .filter((p) => p.getStatus() === "configured")
      .filter((p) => requiredCapabilities.every((cap) => p.getCapabilities().includes(cap)));

    if (availableProviders.length === 0) {
      const fallbackProviders = providers
        .filter((p) => p.getStatus() === "configured")
        .sort((a, b) => b.getPriority() - a.getPriority());

      if (fallbackProviders.length === 0) {
        return null;
      }

      const fallback = fallbackProviders[0];
      return {
        provider: fallback,
        model: fallback.createModel(modelId),
        usedFallback: true,
        reason: "No provider matched required capabilities, used highest priority fallback",
      };
    }

    const sorted = availableProviders.sort((a, b) => b.getPriority() - a.getPriority());
    const selected = sorted[0];

    return {
      provider: selected,
      model: selected.createModel(modelId),
      usedFallback: false,
    };
  }

  return {
    selectProvider,
    getAvailableProviders: () => providers.filter((p) => p.getStatus() === "configured"),
    getFreeProviders: () =>
      providers.filter((p) => p.isFreeTier() && p.getStatus() === "configured"),
  };
}

export const autoFreeRouter = createAutoFreeRouter();

export function getNexusCoreAiModel(taskType: TaskType, modelId?: string): LanguageModel | null {
  const result = autoFreeRouter.selectProvider(taskType, modelId);
  return result?.model ?? null;
}
