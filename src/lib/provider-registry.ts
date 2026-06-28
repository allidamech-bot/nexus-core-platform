import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderCapability, ProviderStatus, ProviderRegistryEntry } from "./provider-types";
import { createProviderAdapter } from "./provider-adapter";
import type { ProviderAdapter } from "./provider-adapter";

interface BaseProviderEntry {
  id: string;
  capabilities: ProviderCapability[];
  envVar: string;
  defaultModel: string;
  priority: number;
  freeTier: boolean;
}

const PROVIDER_REGISTRY: BaseProviderEntry[] = [
  {
    id: "gemini",
    capabilities: ["coding", "planning", "summarization", "structured_output", "fast_response"],
    envVar: "GEMINI_API_KEY",
    defaultModel: "gemini-1.5-flash",
    priority: 100,
    freeTier: true,
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
    defaultModel: "google/gemini-2.0-flash-exp:free",
    priority: 95,
    freeTier: true,
  },
  {
    id: "groq",
    capabilities: ["coding", "summarization", "fast_response", "tool_calling"],
    envVar: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    priority: 90,
    freeTier: true,
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
    defaultModel: "qwen2.5-coder:32b",
    priority: 80,
    freeTier: true,
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
    defaultModel: "google/gemini-2.0-flash-thinking",
    priority: 75,
    freeTier: true,
  },
  {
    id: "cerebras",
    capabilities: ["coding", "summarization", "fast_response", "structured_output"],
    envVar: "CEREBRAS_API_KEY",
    defaultModel: "llama-3.3-70b",
    priority: 85,
    freeTier: true,
  },
  {
    id: "mistral",
    capabilities: ["coding", "planning", "summarization", "structured_output", "vision"],
    envVar: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-latest",
    priority: 70,
    freeTier: true,
  },
  {
    id: "nvidia_nim",
    capabilities: ["coding", "summarization", "structured_output", "long_context"],
    envVar: "NVIDIA_NIM_API_KEY",
    defaultModel: "nvdev/nemotron-4-34b-reward",
    priority: 60,
    freeTier: true,
  },
  {
    id: "cloudflare_workers_ai",
    capabilities: ["coding", "summarization", "fast_response", "structured_output", "tool_calling"],
    envVar: "CF_WORKERS_AI_TOKEN",
    defaultModel: "@cf/meta/llama-3.1-70b-instruct",
    priority: 65,
    freeTier: true,
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
    defaultModel: "o1-mini",
    priority: 55,
    freeTier: true,
  },
  {
    id: "huggingface",
    capabilities: ["coding", "planning", "summarization", "tool_calling"],
    envVar: "HF_API_KEY",
    defaultModel: "deepseek-ai/DeepSeek-R1",
    priority: 50,
    freeTier: true,
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
    baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/api/v1";
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
    if (isOllama || isLmstudio) {
      return createOpenAICompatible({
        name: entry.id,
        baseURL,
      })(modelId);
    } else if (isCfWorkers) {
      return createOpenAICompatible({
        name: entry.id,
        baseURL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })(modelId);
    } else {
      return createOpenAICompatible({
        name: entry.id,
        baseURL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })(modelId);
    }
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
