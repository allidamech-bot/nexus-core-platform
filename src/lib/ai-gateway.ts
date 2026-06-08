import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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
