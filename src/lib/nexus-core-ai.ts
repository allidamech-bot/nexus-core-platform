import { generateText, type LanguageModel } from "ai";
import type {
  TaskType,
  ExecutionError,
  ExecutionErrorType,
  UnifiedGenerateInput,
  UnifiedGenerateResult,
} from "./provider-types";
import { getAllProviders } from "./provider-registry";
import type { ProviderAdapter } from "./provider-adapter";

const DEFAULT_TIMEOUT_MS = 30000;

function getEnvModel(providerId: string): string | undefined {
  const modelEnvVars: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_MODEL,
    openrouter_free: process.env.OPENROUTER_FREE_MODEL,
    groq: process.env.GROQ_MODEL,
  };
  return modelEnvVars[providerId];
}

function detectErrorType(error: unknown, providerId: string): ExecutionErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("too many requests")
  ) {
    return "rate_limited";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (!process.env[`${providerId.toUpperCase().replace(/_free/, "")}_API_KEY`]) {
    return "missing_key";
  }
  return "provider_error";
}

function createExecutionError(
  type: ExecutionErrorType,
  message: string,
  providerId?: string,
  modelId?: string,
): ExecutionError {
  return { type, message, providerId, modelId };
}

async function executeWithProvider(
  provider: ProviderAdapter,
  input: UnifiedGenerateInput,
): Promise<UnifiedGenerateResult> {
  const modelId = input.modelId || getEnvModel(provider.getId()) || provider.getDefaultModel();
  const model = provider.createModel(modelId);

  try {
    const result = await Promise.race([
      generateText({
        model: model as LanguageModel,
        system: input.system,
        prompt: input.prompt,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), DEFAULT_TIMEOUT_MS),
      ),
    ]);

    return {
      text: result.text,
      internalProvider: provider.getId(),
      internalModel: modelId,
      status: "success",
    };
  } catch (error) {
    const errorType = detectErrorType(error, provider.getId());
    return {
      text: "",
      internalProvider: provider.getId(),
      internalModel: modelId,
      status: "error",
      error: createExecutionError(
        errorType,
        error instanceof Error ? error.message : String(error),
      ),
    };
  }
}

export async function generateWithNexusCore(
  input: UnifiedGenerateInput,
): Promise<UnifiedGenerateResult> {
  const providers = getAllProviders();

  const geminiProvider = providers.find((p) => p.getId() === "gemini");
  const openrouterProvider = providers.find((p) => p.getId() === "openrouter_free");
  const groqProvider = providers.find((p) => p.getId() === "groq");

  const eligibleProviders = [geminiProvider, openrouterProvider, groqProvider].filter(
    (p): p is ProviderAdapter => p !== undefined && p.getStatus() === "configured",
  );

  if (eligibleProviders.length === 0) {
    const fallbackProviders = providers.filter((p) => p.getStatus() === "configured");
    if (fallbackProviders.length === 0) {
      return {
        text: "",
        internalProvider: "none",
        internalModel: "none",
        status: "error",
        error: createExecutionError(
          "no_available_provider",
          "No configured providers available for execution",
        ),
      };
    }

    for (const provider of fallbackProviders.sort((a, b) => b.getPriority() - a.getPriority())) {
      const result = await executeWithProvider(provider, input);
      if (result.status === "success") {
        return result;
      }
    }

    const lastProvider = fallbackProviders[fallbackProviders.length - 1];
    return {
      text: "",
      internalProvider: lastProvider.getId(),
      internalModel: lastProvider.getDefaultModel(),
      status: "error",
      error: createExecutionError("no_available_provider", "All providers failed"),
    };
  }

  for (const provider of eligibleProviders.sort((a, b) => b.getPriority() - a.getPriority())) {
    const result = await executeWithProvider(provider, input);
    if (result.status === "success") {
      return result;
    }

    const errorType = result.error?.type;
    if (errorType === "missing_key") {
      continue;
    }
    if (errorType === "rate_limited" || errorType === "timeout" || errorType === "provider_error") {
      continue;
    }
  }

  const lastProvider = eligibleProviders[eligibleProviders.length - 1];
  const modelId = getEnvModel(lastProvider.getId()) || lastProvider.getDefaultModel();
  return {
    text: "",
    internalProvider: lastProvider.getId(),
    internalModel: modelId,
    status: "error",
    error: createExecutionError("no_available_provider", "All eligible providers failed"),
  };
}

export async function generateWithFallback(
  input: UnifiedGenerateInput,
): Promise<UnifiedGenerateResult> {
  const providers = getAllProviders();
  const configuredProviders = providers.filter((p) => p.getStatus() === "configured");

  if (configuredProviders.length === 0) {
    return {
      text: "",
      internalProvider: "none",
      internalModel: "none",
      status: "error",
      error: createExecutionError("no_available_provider", "No AI providers configured"),
    };
  }

  for (const provider of configuredProviders.sort((a, b) => b.getPriority() - a.getPriority())) {
    const result = await executeWithProvider(provider, input);
    if (result.status === "success") {
      return result;
    }
  }

  const lastProvider = configuredProviders[configuredProviders.length - 1];
  const modelId = input.modelId || lastProvider.getDefaultModel();
  return {
    text: "",
    internalProvider: lastProvider.getId(),
    internalModel: modelId,
    status: "error",
    error: createExecutionError("no_available_provider", "All providers failed"),
  };
}
