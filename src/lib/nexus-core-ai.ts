import { generateText, type LanguageModel } from "ai";
import type {
  TaskType,
  ExecutionError,
  ExecutionErrorType,
  UnifiedGenerateInput,
  UnifiedGenerateResult,
  ProviderHealthStatus,
} from "./provider-types";
import { getAllProviders, getProviderById, PROVIDER_DEFAULT_MODELS } from "./provider-registry";
import type { ProviderAdapter } from "./provider-adapter";
import { providerHealthStore } from "./provider-health";
import {
  buildFallbackChain,
  selectProviderWithTrace,
  sanitizeTraceForDeveloper,
  sanitizeTraceForUser,
  type ExecutionTrace,
} from "./provider-router";

const DEFAULT_TIMEOUT_MS = 30000;

function getEnvModel(providerId: string): string | undefined {
  const allDefaults = { ...PROVIDER_DEFAULT_MODELS };
  const modelEnvMap: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_MODEL,
    openrouter_free: process.env.OPENROUTER_FREE_MODEL,
    groq: process.env.GROQ_MODEL,
    ollama: process.env.OLLAMA_MODEL,
    lmstudio: process.env.LMSTUDIO_MODEL,
    cerebras: process.env.CEREBRAS_MODEL,
    mistral: process.env.MISTRAL_MODEL,
    nvidia_nim: process.env.NVIDIA_NIM_MODEL,
    cloudflare_workers_ai: process.env.CF_WORKERS_AI_MODEL,
    github_models: process.env.GITHUB_MODELS_MODEL,
    huggingface: process.env.HF_MODEL,
  };
  return modelEnvMap[providerId];
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
  if (message.includes("connection refused") || message.includes("network unreachable")) {
    return "provider_error";
  }
  if (message.includes("invalid response") || message.includes("parse error")) {
    return "invalid_response";
  }
  if (!process.env[`${providerId.toUpperCase().replace(/_free/, "")}_API_KEY`]) {
    return "missing_key";
  }
  return "provider_error";
}

function normalizeLocalError(error: unknown, providerId: string): ExecutionErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const isLocal = providerId === "ollama" || providerId === "lmstudio";
  if (!isLocal) return detectErrorType(error, providerId);

  if (message.includes("connection refused") || message.includes("connect econnrefused")) {
    return "provider_error";
  }
  if (message.includes("model not found") || message.includes("no such model")) {
    return "invalid_response";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  return detectErrorType(error, providerId);
}

function createExecutionError(
  type: ExecutionErrorType,
  message: string,
  providerId?: string,
  modelId?: string,
): ExecutionError {
  return { type, message, providerId, modelId };
}

function mapTaskType(taskType: TaskType): string {
  return taskType;
}

export async function generateWithNexusCore(
  input: UnifiedGenerateInput,
  developerMode = false,
): Promise<UnifiedGenerateResult & { trace?: ExecutionTrace }> {
  const trace = await selectProviderWithTrace(
    mapTaskType(input.taskType),
    input.modelId,
    [],
    false,
  );

  if (!trace.selectedProvider || !trace.selectedModel) {
    providerHealthStore.update({
      providerId: "none",
      status: "missing_key",
      errorSummary: "No providers available",
    });

    return {
      text: "",
      internalProvider: "none",
      internalModel: "none",
      status: "error",
      error: createExecutionError(
        "no_available_provider",
        "No configured providers available for execution",
      ),
      trace: developerMode ? trace.trace : undefined,
    };
  }

  const provider = trace.selectedProvider;
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

    providerHealthStore.update({
      providerId: provider.getId(),
      status: "healthy",
    });

    trace.trace.selectedProvider = provider.getId();
    trace.trace.selectedModel = modelId;
    trace.trace.finalStatus = "success";

    return {
      text: result.text,
      internalProvider: developerMode ? provider.getId() : "nexus-core-ai",
      internalModel: developerMode ? modelId : "auto-selected",
      status: "success",
      trace: developerMode ? trace.trace : undefined,
    };
  } catch (error) {
    const errorType = normalizeLocalError(error, provider.getId());
    const errorMessage = error instanceof Error ? error.message : String(error);

    providerHealthStore.update({
      providerId: provider.getId(),
      status: errorType as ProviderHealthStatus,
      errorSummary: errorMessage,
    });

    trace.trace.selectedProvider = provider.getId();
    trace.trace.selectedModel = modelId;
    trace.trace.finalStatus = "error";
    trace.trace.errorType = errorType;
    trace.trace.errorSummary = errorMessage;

    const fallbackResult = await fallbackExecute(provider, input, developerMode, trace.trace);
    if (fallbackResult.status === "success") {
      return fallbackResult;
    }

    return {
      text: "",
      internalProvider: developerMode ? provider.getId() : "nexus-core-ai",
      internalModel: developerMode ? modelId : "auto-selected",
      status: "error",
      error: createExecutionError(
        "no_available_provider",
        "All providers failed after fallback",
        provider.getId(),
        modelId,
      ),
      trace: developerMode ? trace.trace : undefined,
    };
  }
}

async function fallbackExecute(
  failedProvider: ProviderAdapter,
  input: UnifiedGenerateInput,
  developerMode: boolean,
  trace: ExecutionTrace,
): Promise<UnifiedGenerateResult & { trace?: ExecutionTrace }> {
  const providers = getAllProviders();
  const fallbackProviders = providers
    .filter((p) => p.getId() !== failedProvider.getId())
    .filter((p) => p.getStatus() === "configured")
    .filter((p) => providerHealthStore.isEligible(p.getId()))
    .sort((a, b) => b.getPriority() - a.getPriority());

  for (const provider of fallbackProviders) {
    trace.attemptedProviders.push(provider.getId());
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

      providerHealthStore.update({
        providerId: provider.getId(),
        status: "healthy",
      });

      trace.selectedProvider = provider.getId();
      trace.selectedModel = modelId;
      trace.finalStatus = "success";

      return {
        text: result.text,
        internalProvider: developerMode ? provider.getId() : "nexus-core-ai",
        internalModel: developerMode ? modelId : "auto-selected",
        status: "success",
        trace: developerMode ? trace : undefined,
      };
    } catch (error) {
      const errorType = normalizeLocalError(error, provider.getId());
      const errorMessage = error instanceof Error ? error.message : String(error);

      providerHealthStore.update({
        providerId: provider.getId(),
        status: errorType as ProviderHealthStatus,
        errorSummary: errorMessage,
      });

      trace.skippedProviders.push({
        providerId: provider.getId(),
        reason: `fallback failed: ${errorType}`,
      });
    }
  }

  return {
    text: "",
    internalProvider: developerMode ? failedProvider.getId() : "nexus-core-ai",
    internalModel: developerMode ? failedProvider.getDefaultModel() : "auto-selected",
    status: "error",
    error: createExecutionError("no_available_provider", "All fallback providers failed"),
    trace: developerMode ? trace : undefined,
  };
}

export async function generateWithFallback(
  input: UnifiedGenerateInput,
  developerMode = false,
): Promise<UnifiedGenerateResult & { trace?: ExecutionTrace }> {
  const trace = await selectProviderWithTrace(
    mapTaskType(input.taskType),
    input.modelId,
    [],
    false,
  );

  if (!trace.selectedProvider || !trace.selectedModel) {
    return {
      text: "",
      internalProvider: "none",
      internalModel: "none",
      status: "error",
      error: createExecutionError("no_available_provider", "No AI providers configured"),
      trace: developerMode ? trace.trace : undefined,
    };
  }

  return generateWithNexusCore(input, developerMode);
}

export function getProviderHealthDiagnostics(developerMode: boolean): Record<string, unknown> {
  const providers = getAllProviders();
  const healthEntries = providers.map((p) => {
    const entry = providerHealthStore.getEntry(p.getId());
    return {
      id: p.getId(),
      status: entry.status,
      lastCheckedAt: entry.lastCheckedAt ? new Date(entry.lastCheckedAt).toISOString() : null,
      lastSuccessAt: entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toISOString() : null,
      lastErrorAt: entry.lastErrorAt ? new Date(entry.lastErrorAt).toISOString() : null,
      lastErrorSummary: entry.lastErrorSummary,
      consecutiveFailures: entry.consecutiveFailures,
      cooldownUntil: entry.cooldownUntil ? new Date(entry.cooldownUntil).toISOString() : null,
      isEligible: providerHealthStore.isEligible(p.getId()),
    };
  });

  if (!developerMode) {
    return {
      provider: "nexus-core-ai",
      aiStatus: healthEntries.some((h) => h.isEligible) ? "available" : "unavailable",
      message: healthEntries.some((h) => h.isEligible)
        ? "Nexus Core AI is ready."
        : "AI provider configuration is required.",
    };
  }

  return {
    provider: "nexus-core-ai",
    aiStatus: healthEntries.some((h) => h.isEligible) ? "available" : "degraded",
    health: healthEntries,
  };
}
