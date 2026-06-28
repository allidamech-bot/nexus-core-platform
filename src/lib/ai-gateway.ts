import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getNexusCoreAiModel, autoFreeRouter } from "./auto-free-router";

export const createDynamicProvider = (apiKey: string, baseURL?: string) => {
  return createOpenAICompatible({
    name: "dynamic-provider",
    baseURL: baseURL || "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
};

export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

export function getNexusCoreModel(taskType: string, modelId?: string): LanguageModel | null {
  const result = autoFreeRouter.selectProvider(
    taskType as "coding" | "planning" | "summarization" | "chat" | "analysis",
    modelId,
  );
  return result?.model ?? null;
}

export { autoFreeRouter, getNexusCoreAiModel } from "./auto-free-router";
export type { ProviderAdapter, ProviderSelectionResult } from "./provider-adapter";
export type {
  ProviderCapability,
  ProviderStatus,
  ProviderInfo,
  TaskType,
  UnifiedGenerateInput,
  UnifiedGenerateResult,
  ExecutionError,
} from "./provider-types";

export { generateWithNexusCore, generateWithFallback } from "./nexus-core-ai";
