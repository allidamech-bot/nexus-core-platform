import type { LanguageModel } from "ai";
import type { ProviderAdapter } from "./provider-adapter";
import type {
  ProviderCapability,
  ProviderHealthStatus,
  ProviderHealthEntry,
} from "./provider-types";
import { providerHealthStore } from "./provider-health";
import { getAllProviders, getProviderById } from "./provider-registry";

export type ExecutionTraceStatus = "success" | "error" | "no_available_provider";

export interface ExecutionTrace {
  taskType: string;
  selectedProvider: string | null;
  selectedModel: string | null;
  fallbackChain: RouterFallbackEntry[];
  attemptedProviders: string[];
  skippedProviders: { providerId: string; reason: string }[];
  finalStatus: ExecutionTraceStatus;
  errorType: string | null;
  elapsedMs: number;
  errorSummary: string | null;
}

export interface RouterFallbackEntry {
  provider: ProviderAdapter;
  score: number;
  reason: string;
  skipped: boolean;
  skipReason?: string;
}

export interface ProviderScoreBreakdown {
  providerId: string;
  score: number;
  reasons: string[];
}

const SKILL_BONUS: Record<string, number> = {
  local: 5,
  structured_output: 50,
  long_context: 50,
  fast_response: 50,
  tool_calling: 50,
  vision: 30,
};

function capabilityScore(
  providerCapabilities: ProviderCapability[],
  requiredCapabilities: ProviderCapability[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const missing = requiredCapabilities.filter((cap) => !providerCapabilities.includes(cap));
  if (missing.length > 0) {
    reasons.push(`missing capabilities: ${missing.join(", ")}`);
    return { score: -1000, reasons };
  }

  for (const cap of requiredCapabilities) {
    score += 100;
    reasons.push(`has required ${cap}`);
  }

  for (const cap of providerCapabilities) {
    if (SKILL_BONUS[cap]) {
      score += SKILL_BONUS[cap]!;
      reasons.push(`bonus ${cap}`);
    }
  }

  return { score, reasons };
}

function healthScore(health: ProviderHealthEntry): { score: number; reasons: string[] } {
  const now = Date.now();

  if (health.cooldownUntil !== null && now < health.cooldownUntil) {
    return {
      score: -10000,
      reasons: [`in cooldown until ${new Date(health.cooldownUntil).toISOString()}`],
    };
  }

  switch (health.status) {
    case "healthy":
      return { score: 100, reasons: ["healthy"] };
    case "missing_key":
      return { score: -1000, reasons: ["missing key"] };
    case "disabled":
      return { score: -1000, reasons: ["disabled"] };
    case "unsupported_provider":
      return { score: -1000, reasons: ["unsupported provider"] };
    case "rate_limited": {
      const rateLimitedPenalty = health.consecutiveFailures > 1 ? -500 : -200;
      return {
        score: rateLimitedPenalty,
        reasons: [`rate limited (${health.consecutiveFailures}x)`],
      };
    }
    case "timeout": {
      const timeoutPenalty = Math.min(health.consecutiveFailures * -100, -300);
      return { score: timeoutPenalty, reasons: [`timeout (${health.consecutiveFailures}x)`] };
    }
    case "provider_error": {
      const errorPenalty = Math.min(health.consecutiveFailures * -80, -200);
      return { score: errorPenalty, reasons: [`provider error (${health.consecutiveFailures}x)`] };
    }
    case "invalid_response":
      return { score: -100, reasons: ["invalid response"] };
    default:
      return { score: 0, reasons: ["unknown status"] };
  }
}

function priorityScore(priority: number): { score: number; reasons: string[] } {
  return { score: priority / 10, reasons: [`priority ${priority}`] };
}

function localPreferenceScore(
  providerId: string,
  hasLocalPreference: boolean,
): { score: number; reasons: string[] } {
  if (!hasLocalPreference) return { score: 0, reasons: [] };
  const isLocal = providerId === "ollama" || providerId === "lmstudio";
  if (isLocal) {
    return { score: 30, reasons: ["local preference matched"] };
  }
  return { score: -50, reasons: ["local preference not matched"] };
}

function taskCapabilityBonus(
  taskType: string,
  providerCapabilities: ProviderCapability[],
): { score: number; reasons: string[] } {
  const taskToCapability: Record<string, ProviderCapability[]> = {
    coding: ["coding"],
    planning: ["planning"],
    summarization: ["summarization"],
    validation_explanation: ["structured_output"],
    project_review: ["long_context"],
    refactor: ["coding", "planning"],
    bugfix: ["coding", "fast_response"],
    structured_output: ["structured_output"],
    long_context: ["long_context"],
    fast_response: ["fast_response"],
    local_only: ["local"],
  };

  const preferred = taskToCapability[taskType] ?? [];
  let score = 0;
  const reasons: string[] = [];

  for (const cap of preferred) {
    if (providerCapabilities.includes(cap)) {
      score += 20;
      reasons.push(`task fit: ${cap}`);
    }
  }

  return { score, reasons };
}

export function scoreProvider(
  provider: ProviderAdapter,
  requiredCapabilities: ProviderCapability[],
  taskType: string,
  hasLocalPreference: boolean,
): ProviderScoreBreakdown {
  const health = providerHealthStore.getEntry(provider.getId());
  const capScore = capabilityScore(provider.getCapabilities(), requiredCapabilities);
  const healthScoreResult = healthScore(health);
  const priorityScoreResult = priorityScore(provider.getPriority());
  const localScore = localPreferenceScore(provider.getId(), hasLocalPreference);
  const taskScore = taskCapabilityBonus(taskType, provider.getCapabilities());

  const total =
    capScore.score +
    healthScoreResult.score +
    priorityScoreResult.score +
    localScore.score +
    taskScore.score;
  const reasons = [
    ...capScore.reasons,
    ...healthScoreResult.reasons,
    ...priorityScoreResult.reasons,
    ...localScore.reasons,
    ...taskScore.reasons,
  ];

  return { providerId: provider.getId(), score: total, reasons };
}

export function buildFallbackChain(
  taskType: string,
  modelId?: string,
  requiredCapabilities?: ProviderCapability[],
  hasLocalPreference = false,
): RouterFallbackEntry[] {
  const providers = getAllProviders();
  const capabilities = requiredCapabilities ?? [];

  const scored = providers
    .map((provider) => {
      const breakdown = scoreProvider(provider, capabilities, taskType, hasLocalPreference);
      const health = providerHealthStore.getEntry(provider.getId());
      const now = Date.now();
      const inCooldown = health.cooldownUntil !== null && now < health.cooldownUntil;

      return {
        provider,
        score: breakdown.score,
        reason: breakdown.reasons[0] ?? "no match",
        skipped: inCooldown || breakdown.score < 0,
        skipReason: inCooldown
          ? `in cooldown until ${new Date(health.cooldownUntil!).toISOString()}`
          : breakdown.score < 0
            ? `low score (${breakdown.score})`
            : undefined,
      };
    })
    .filter((entry) => !entry.skipped || entry.skipReason !== undefined)
    .sort((a, b) => b.score - a.score);

  return scored;
}

export interface RouterSelectionResult {
  trace: ExecutionTrace;
  selectedProvider: ProviderAdapter | null;
  selectedModel: LanguageModel | null;
}

export async function selectProviderWithTrace(
  taskType: string,
  modelId?: string,
  requiredCapabilities: ProviderCapability[] = [],
  hasLocalPreference = false,
): Promise<RouterSelectionResult> {
  const startTime = Date.now();
  const chain = buildFallbackChain(taskType, modelId, requiredCapabilities, hasLocalPreference);

  const skippedProviders = chain
    .filter((entry) => entry.skipped)
    .map((entry) => ({
      providerId: entry.provider.getId(),
      reason: entry.skipReason ?? "unknown",
    }));

  const attemptedProviders: string[] = [];
  let selectedProvider: ProviderAdapter | null = null;
  let selectedModel: LanguageModel | null = null;
  let finalStatus: ExecutionTraceStatus = "no_available_provider";
  const errorType: string | null = null;
  const errorSummary: string | null = null;

  for (const entry of chain) {
    if (entry.skipped) continue;

    attemptedProviders.push(entry.provider.getId());

    if (!providerHealthStore.isEligible(entry.provider.getId())) {
      skippedProviders.push({
        providerId: entry.provider.getId(),
        reason: "not eligible at runtime",
      });
      continue;
    }

    selectedProvider = entry.provider;
    selectedModel = selectedProvider.createModel(modelId);
    finalStatus = "success";
    break;
  }

  const trace: ExecutionTrace = {
    taskType,
    selectedProvider: selectedProvider?.getId() ?? null,
    selectedModel: modelId ?? selectedProvider?.getDefaultModel() ?? null,
    fallbackChain: chain,
    attemptedProviders,
    skippedProviders,
    finalStatus,
    errorType,
    elapsedMs: Date.now() - startTime,
    errorSummary,
  };

  return { trace, selectedProvider, selectedModel };
}

export function sanitizeTraceForDeveloper(trace: ExecutionTrace): Record<string, unknown> {
  return {
    taskType: trace.taskType,
    selectedProvider: trace.selectedProvider,
    selectedModel: trace.selectedModel,
    fallbackChain: trace.fallbackChain.map((entry) => ({
      providerId: entry.provider.getId(),
      score: entry.score,
      reason: entry.reason,
      skipped: entry.skipped,
      skipReason: entry.skipReason,
    })),
    attemptedProviders: trace.attemptedProviders,
    skippedProviders: trace.skippedProviders,
    finalStatus: trace.finalStatus,
    elapsedMs: trace.elapsedMs,
    errorSummary: trace.errorSummary,
  };
}

export function sanitizeTraceForUser(trace: ExecutionTrace): null {
  return null;
}
