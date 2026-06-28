import type { LanguageModel } from "ai";
import type { ProviderAdapter, ProviderSelectionResult } from "./provider-adapter";
import type { TaskType, ProviderCapability } from "./provider-types";
import { buildFallbackChain } from "./provider-router";

export interface AutoFreeRouter {
  selectProvider(taskType: TaskType, modelId?: string): ProviderSelectionResult | null;
  getAvailableProviders(): ProviderAdapter[];
  getFreeProviders(): ProviderAdapter[];
}

export function createAutoFreeRouter(): AutoFreeRouter {
  function selectProvider(taskType: TaskType, modelId?: string): ProviderSelectionResult | null {
    const chain = buildFallbackChain(taskType, modelId, [], false);
    const eligible = chain.filter((entry) => !entry.skipped);
    if (eligible.length === 0) return null;

    const best = eligible[0];
    return {
      provider: best.provider,
      model: best.provider.createModel(modelId),
      usedFallback: false,
      reason: best.reason,
    };
  }

  return {
    selectProvider,
    getAvailableProviders: () => {
      const chain = buildFallbackChain("chat", undefined, [], false);
      return chain.filter((e) => !e.skipped).map((e) => e.provider);
    },
    getFreeProviders: () => {
      const chain = buildFallbackChain("chat", undefined, [], false);
      return chain.filter((e) => !e.skipped && e.provider.isFreeTier()).map((e) => e.provider);
    },
  };
}

export const autoFreeRouter = createAutoFreeRouter();

export function getNexusCoreAiModel(taskType: TaskType, modelId?: string): LanguageModel | null {
  const result = autoFreeRouter.selectProvider(taskType, modelId);
  return result?.model ?? null;
}
