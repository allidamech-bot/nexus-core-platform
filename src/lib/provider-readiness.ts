import type {
  ProviderReadiness,
  ProviderReadinessStatus,
  ProviderEndpointType,
  ProviderRegistryEntry,
} from "./provider-types";
import { getProviderRegistry, PROVIDER_DEFAULT_MODELS } from "./provider-registry";
import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const SMOKE_TEST_PROMPT = "Reply with OK";
const SMOKE_TEST_TIMEOUT_MS = 15_000;

function getEnvModel(providerId: string): string | undefined {
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

function getBaseURL(providerId: string): string {
  switch (providerId) {
    case "gemini":
      return (
        process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/"
      );
    case "openrouter_free":
      return process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    case "groq":
      return process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
    case "ollama":
      return process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
    case "lmstudio":
      return process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
    case "cerebras":
      return process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1";
    case "mistral":
      return process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1";
    case "nvidia_nim":
      return process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
    case "cloudflare_workers_ai":
      return (
        process.env.CF_WORKERS_AI_BASE_URL ||
        "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1"
      );
    case "github_models":
      return process.env.GITHUB_MODELS_BASE_URL || "https://models.inference.ai.azure.com";
    case "huggingface":
      return process.env.HUGGINGFACE_BASE_URL || "https://api-inference.huggingface.co/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

function getApiKey(entry: ProviderRegistryEntry): string {
  if (entry.id === "ollama" || entry.id === "lmstudio") {
    return "";
  }
  return process.env[entry.envVar] || "";
}

function requiresSpecialHeaders(providerId: string): boolean {
  return providerId === "cloudflare_workers_ai";
}

function createSmokeModel(entry: ProviderRegistryEntry): LanguageModel | null {
  const baseURL = getBaseURL(entry.id);
  const apiKey = getApiKey(entry);
  const modelId = getEnvModel(entry.id) || entry.defaultModel;

  if (!baseURL) return null;

  const headers: Record<string, string> = {};
  if (apiKey) {
    if (entry.id === "cloudflare_workers_ai") {
      headers["X-Auth-Key"] = apiKey;
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }
  }

  try {
    return createOpenAICompatible({
      name: entry.id,
      baseURL,
      headers,
    })(modelId);
  } catch {
    return null;
  }
}

export function evaluateProviderReadiness(entry: ProviderRegistryEntry): ProviderReadiness {
  const hasKey = entry.status === "configured";
  const hasEndpoint = Boolean(getBaseURL(entry.id));
  const hasModel = Boolean(getEnvModel(entry.id) || entry.defaultModel);
  const supportsOpenAICompatibleChat =
    entry.endpointType === "openai_compatible" || entry.endpointType === "local_openai_compatible";
  const specialHeaders = requiresSpecialHeaders(entry.id);

  let readinessStatus: ProviderReadinessStatus;
  let sanitizedMessage: string;
  let developerMessage: string;

  if (!hasKey) {
    readinessStatus = "missing_key";
    sanitizedMessage = "Provider is not configured.";
    developerMessage = `Missing ${entry.envVar}. Provider cannot be used.`;
  } else if (!hasEndpoint) {
    readinessStatus = "missing_endpoint";
    sanitizedMessage = "Provider endpoint is not configured.";
    developerMessage = `No base URL configured for ${entry.id}. Set the appropriate BASE_URL env var.`;
  } else if (!hasModel) {
    readinessStatus = "missing_model";
    sanitizedMessage = "Provider model is not configured.";
    developerMessage = `No model configured for ${entry.id}. Set ${entry.supportsModelEnv || "MODEL"} env var.`;
  } else if (!supportsOpenAICompatibleChat) {
    readinessStatus = "unsupported";
    sanitizedMessage = "Provider is not supported in this architecture.";
    developerMessage = `${entry.id} uses an unsupported endpoint type (${entry.endpointType}).`;
  } else if (specialHeaders) {
    readinessStatus = "needs_live_check";
    sanitizedMessage = "Provider requires additional header verification.";
    developerMessage = `${entry.id} requires special headers (X-Auth-Key). Live check recommended.`;
  } else {
    readinessStatus = "needs_live_check";
    sanitizedMessage = "Provider is configured and ready for live verification.";
    developerMessage = `${entry.id} is configured with ${hasModel ? "model" : "no model"} at ${hasEndpoint ? "endpoint" : "no endpoint"}. Live smoke test needed to confirm actual availability.`;
  }

  return {
    providerId: entry.id,
    configured: hasKey,
    endpointConfigured: hasEndpoint,
    modelConfigured: hasModel,
    supportsOpenAICompatibleChat,
    requiresSpecialHeaders: specialHeaders,
    endpointType: entry.endpointType,
    readinessStatus,
    sanitizedMessage,
    developerMessage,
  };
}

export function evaluateAllProviderReadiness(): ProviderReadiness[] {
  const registry = getProviderRegistry();
  return registry.map(evaluateProviderReadiness);
}

export async function runSmokeTest(
  providerId: string,
  developerMode = true,
): Promise<{ providerId: string; status: string; message: string; elapsedMs: number }> {
  if (!developerMode) {
    return {
      providerId,
      status: "unsupported_provider",
      message: "Smoke tests are developer-only.",
      elapsedMs: 0,
    };
  }

  const registry = getProviderRegistry();
  const entry = registry.find((r) => r.id === providerId);
  if (!entry) {
    return {
      providerId,
      status: "unsupported_provider",
      message: "Unknown provider.",
      elapsedMs: 0,
    };
  }

  const readiness = evaluateProviderReadiness(entry);
  if (readiness.readinessStatus === "missing_key") {
    return {
      providerId,
      status: "missing_key",
      message: "Missing API key.",
      elapsedMs: 0,
    };
  }

  if (readiness.readinessStatus === "unsupported") {
    return {
      providerId,
      status: "unsupported_provider",
      message: "Provider type not supported for smoke tests.",
      elapsedMs: 0,
    };
  }

  const model = createSmokeModel(entry);
  if (!model) {
    return {
      providerId,
      status: "missing_endpoint",
      message: "Could not construct model client.",
      elapsedMs: 0,
    };
  }

  const start = Date.now();
  try {
    await Promise.race([
      generateText({
        model: model as LanguageModel,
        prompt: SMOKE_TEST_PROMPT,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Smoke test timeout")), SMOKE_TEST_TIMEOUT_MS),
      ),
    ]);

    return {
      providerId,
      status: "success",
      message: "Ok",
      elapsedMs: Date.now() - start,
    };
  } catch (error) {
    const elapsed = Date.now() - start;
    const message = error instanceof Error ? error.message : "Smoke test failed";

    if (message.toLowerCase().includes("429") || message.toLowerCase().includes("rate limit")) {
      return { providerId, status: "rate_limited", message, elapsedMs: elapsed };
    }
    if (message.toLowerCase().includes("timeout")) {
      return { providerId, status: "timeout", message, elapsedMs: elapsed };
    }
    if (
      message.toLowerCase().includes("connection refused") ||
      message.toLowerCase().includes("network unreachable")
    ) {
      return { providerId, status: "provider_error", message, elapsedMs: elapsed };
    }
    if (
      message.toLowerCase().includes("invalid response") ||
      message.toLowerCase().includes("parse error")
    ) {
      return { providerId, status: "invalid_response", message, elapsedMs: elapsed };
    }
    return { providerId, status: "provider_error", message, elapsedMs: elapsed };
  }
}

export async function runSmokeTestsForAllConfigured(
  developerMode = true,
): Promise<Array<{ providerId: string; status: string; message: string; elapsedMs: number }>> {
  if (!developerMode) {
    return [];
  }

  const registry = getProviderRegistry();
  const configured = registry.filter((r) => r.status === "configured");
  const results = [];

  for (const entry of configured) {
    const result = await runSmokeTest(entry.id, true);
    results.push(result);
  }

  return results;
}
