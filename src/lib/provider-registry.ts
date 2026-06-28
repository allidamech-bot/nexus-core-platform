import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  ProviderCapability,
  ProviderStatus,
  ProviderRegistryEntry,
  ProviderEndpointType,
} from "./provider-types";
import { createProviderAdapter } from "./provider-adapter";
import type { ProviderAdapter } from "./provider-adapter";

// WARNING: Free-tier and local model IDs can change without notice.
// Always allow model overrides via environment variables for production use.

export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-1.5-flash",
  openrouter_free: "google/gemini-2.0-flash-exp:free",
  groq: "llama-3.3-70b-versatile",
  ollama: "qwen2.5-coder:32b",
  lmstudio: "google/gemini-2.0-flash-thinking",
  cerebras: "llama-3.3-70b",
  mistral: "mistral-large-latest",
  nvidia_nim: "nvdev/nemotron-4-34b-reward",
  cloudflare_workers_ai: "@cf/meta/llama-3.1-70b-instruct",
  github_models: "o1-mini",
  huggingface: "deepseek-ai/DeepSeek-R1",
};

interface BaseProviderEntry {
  id: string;
  capabilities: ProviderCapability[];
  envVar: string;
  defaultModel: string;
  priority: number;
  freeTier: boolean;
  supportsModelEnv?: string;
  endpointType: ProviderEndpointType;
}

const PROVIDER_REGISTRY: BaseProviderEntry[] = [
  {
    id: "gemini",
    capabilities: ["coding", "planning", "summarization", "structured_output", "fast_response"],
    envVar: "GEMINI_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.gemini,
    priority: 100,
    freeTier: true,
    supportsModelEnv: "GEMINI_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "openrouter_free",
    capabilities: [
      "coding",
      "planning",
      "summarization",
      "structured_output",
      "tool_calling",
      "long_context",
      "vision",
    ],
    envVar: "OPENROUTER_FREE_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.openrouter_free,
    priority: 95,
    freeTier: true,
    supportsModelEnv: "OPENROUTER_FREE_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "groq",
    capabilities: ["coding", "summarization", "fast_response", "tool_calling"],
    envVar: "GROQ_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.groq,
    priority: 90,
    freeTier: true,
    supportsModelEnv: "GROQ_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "ollama",
    capabilities: [
      "coding",
      "planning",
      "summarization",
      "structured_output",
      "tool_calling",
      "local",
    ],
    envVar: "OLLAMA_BASE_URL",
    defaultModel: PROVIDER_DEFAULT_MODELS.ollama,
    priority: 80,
    freeTier: true,
    supportsModelEnv: "OLLAMA_MODEL",
    endpointType: "local_openai_compatible",
  },
  {
    id: "lmstudio",
    capabilities: [
      "coding",
      "planning",
      "summarization",
      "structured_output",
      "tool_calling",
      "local",
    ],
    envVar: "LMSTUDIO_BASE_URL",
    defaultModel: PROVIDER_DEFAULT_MODELS.lmstudio,
    priority: 75,
    freeTier: true,
    supportsModelEnv: "LMSTUDIO_MODEL",
    endpointType: "local_openai_compatible",
  },
  {
    id: "cerebras",
    capabilities: ["coding", "summarization", "fast_response", "structured_output"],
    envVar: "CEREBRAS_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.cerebras,
    priority: 85,
    freeTier: true,
    supportsModelEnv: "CEREBRAS_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "mistral",
    capabilities: ["coding", "planning", "summarization", "structured_output", "vision"],
    envVar: "MISTRAL_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.mistral,
    priority: 70,
    freeTier: true,
    supportsModelEnv: "MISTRAL_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "nvidia_nim",
    capabilities: ["coding", "summarization", "structured_output", "long_context"],
    envVar: "NVIDIA_NIM_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.nvidia_nim,
    priority: 60,
    freeTier: true,
    supportsModelEnv: "NVIDIA_NIM_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "cloudflare_workers_ai",
    capabilities: ["coding", "summarization", "fast_response", "structured_output", "tool_calling"],
    envVar: "CF_WORKERS_AI_TOKEN",
    defaultModel: PROVIDER_DEFAULT_MODELS.cloudflare_workers_ai,
    priority: 65,
    freeTier: true,
    supportsModelEnv: "CF_WORKERS_AI_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "github_models",
    capabilities: [
      "coding",
      "planning",
      "summarization",
      "structured_output",
      "tool_calling",
      "vision",
    ],
    envVar: "GITHUB_TOKEN",
    defaultModel: PROVIDER_DEFAULT_MODELS.github_models,
    priority: 55,
    freeTier: true,
    supportsModelEnv: "GITHUB_MODELS_MODEL",
    endpointType: "openai_compatible",
  },
  {
    id: "huggingface",
    capabilities: ["coding", "planning", "summarization", "tool_calling"],
    envVar: "HF_API_KEY",
    defaultModel: PROVIDER_DEFAULT_MODELS.huggingface,
    priority: 50,
    freeTier: true,
    supportsModelEnv: "HF_MODEL",
    endpointType: "openai_compatible",
  },
];

function getProviderStatus(envVar: string): ProviderStatus {
  if (!process.env[envVar]) return "missing_key";
  return "configured";
}

export function buildProviderAdapter(entry: BaseProviderEntry): ProviderAdapter {
  const status = getProviderStatus(entry.envVar);

  const isOllama = entry.id === "ollama";
  const isLmstudio = entry.id === "lmstudio";
  const isCfWorkers = entry.id === "cloudflare_workers_ai";

  let baseURL = "";
  if (isOllama) {
    baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
  } else if (isLmstudio) {
    baseURL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
  } else if (isCfWorkers) {
    baseURL =
      process.env.CF_WORKERS_AI_BASE_URL ||
      "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1";
  } else {
    baseURL = getOpenAIFallbackBaseURL(entry.id);
  }

  const apiKey = process.env[entry.envVar] || "";

  const modelFactory = (modelId: string) => {
    const headers: Record<string, string> = {};
    if (!isOllama && !isLmstudio) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (isCfWorkers) {
      headers["X-Auth-Key"] = apiKey;
    }

    return createOpenAICompatible({
      name: entry.id,
      baseURL,
      headers,
    })(modelId);
  };

  return createProviderAdapter(
    entry.id,
    status,
    entry.capabilities,
    entry.priority,
    entry.freeTier,
    entry.defaultModel,
    modelFactory,
  );
}

function getOpenAIFallbackBaseURL(providerId: string): string {
  switch (providerId) {
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai/";
    case "openrouter_free":
      return "https://openrouter.ai/api/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "cerebras":
      return "https://api.cerebras.ai/v1";
    case "mistral":
      return "https://api.mistral.ai/v1";
    case "nvidia_nim":
      return "https://integrate.api.nvidia.com/v1";
    case "github_models":
      return "https://models.inference.ai.azure.com";
    case "huggingface":
      return "https://api-inference.huggingface.co/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

export function getAllProviders(): ProviderAdapter[] {
  return PROVIDER_REGISTRY.map(buildProviderAdapter);
}

export function getProviderById(id: string): ProviderAdapter | undefined {
  const entry = PROVIDER_REGISTRY.find((p) => p.id === id);
  return entry ? buildProviderAdapter(entry) : undefined;
}

export function getProviderRegistry(): ProviderRegistryEntry[] {
  return PROVIDER_REGISTRY.map((entry) => ({
    ...entry,
    status: getProviderStatus(entry.envVar),
  })) as ProviderRegistryEntry[];
}
