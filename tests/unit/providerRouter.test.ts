import { describe, expect, test } from "vitest";
import { providerHealthStore } from "@/lib/provider-health";
import { scoreProvider, buildFallbackChain } from "@/lib/provider-router";
import type { ProviderAdapter } from "@/lib/provider-adapter";

function createMockAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    getId: () => overrides.id ?? "mock",
    getStatus: () => overrides.status ?? "configured",
    getCapabilities: () => overrides.capabilities ?? [],
    getPriority: () => overrides.priority ?? 50,
    isFreeTier: () => overrides.freeTier ?? true,
    getDefaultModel: () => overrides.defaultModel ?? "mock-model",
    createModel: () => ({}) as never,
    ...overrides,
  };
}

describe("providerHealthStore", () => {
  test("starts with unknown status for a new provider", () => {
    const entry = providerHealthStore.getEntry("test-provider");
    expect(entry.status).toBe("unknown");
    expect(entry.consecutiveFailures).toBe(0);
    expect(entry.cooldownUntil).toBeNull();
  });

  test("marks provider healthy on success and resets failures", () => {
    providerHealthStore.update({ providerId: "test-provider", status: "healthy" });
    const entry = providerHealthStore.getEntry("test-provider");
    expect(entry.status).toBe("healthy");
    expect(entry.consecutiveFailures).toBe(0);
    expect(entry.lastSuccessAt).not.toBeNull();
  });

  test("increments consecutive failures on error", () => {
    providerHealthStore.reset("fail-provider");
    providerHealthStore.update({
      providerId: "fail-provider",
      status: "provider_error",
      errorSummary: "boom",
    });
    const entry = providerHealthStore.getEntry("fail-provider");
    expect(entry.consecutiveFailures).toBe(1);
  });

  test("sets cooldown after repeated timeouts", () => {
    providerHealthStore.reset("timeout-provider");
    providerHealthStore.update({ providerId: "timeout-provider", status: "timeout" });
    providerHealthStore.update({ providerId: "timeout-provider", status: "timeout" });
    providerHealthStore.update({ providerId: "timeout-provider", status: "timeout" });
    const entry = providerHealthStore.getEntry("timeout-provider");
    expect(entry.consecutiveFailures).toBe(3);
    expect(entry.cooldownUntil).not.toBeNull();
  });

  test("isEligible returns false when in cooldown", () => {
    providerHealthStore.reset("cooldown-provider");
    providerHealthStore.update({
      providerId: "cooldown-provider",
      status: "rate_limited",
      errorSummary: "429",
    });
    const entry = providerHealthStore.getEntry("cooldown-provider");
    expect(entry.cooldownUntil).not.toBeNull();

    // Artificially make cooldown active
    (entry as any).cooldownUntil = Date.now() + 60_000;
    expect(providerHealthStore.isEligible("cooldown-provider")).toBe(false);
  });

  test("isEligible returns false for missing_key providers", () => {
    providerHealthStore.update({ providerId: "no-key", status: "missing_key" });
    expect(providerHealthStore.isEligible("no-key")).toBe(false);
  });
});

describe("scoreProvider", () => {
  test("scores configured provider higher than missing_key", () => {
    const configured = createMockAdapter({
      id: "configured",
      capabilities: ["coding"],
      status: "configured",
      priority: 50,
    });
    const missing = createMockAdapter({
      id: "missing",
      capabilities: ["coding"],
      status: "missing_key",
      priority: 100,
    });
    const configuredScore = scoreProvider(configured, ["coding"], "coding", false);
    const missingScore = scoreProvider(missing, ["coding"], "coding", false);
    expect(configuredScore.score).toBeGreaterThan(missingScore.score);
  });

  test("boosts score for matching capabilities", () => {
    const provider = createMockAdapter({
      id: "smart",
      capabilities: ["coding", "fast_response", "structured_output"],
      status: "configured",
      priority: 80,
    });
    const result = scoreProvider(provider, [], "coding", false);
    expect(result.score).toBeGreaterThan(50); // priority/10 + health bonus + capability bonuses
  });

  test("penalizes provider when required capability is missing", () => {
    const provider = createMockAdapter({
      id: "limited",
      capabilities: ["coding"],
      status: "configured",
      priority: 80,
    });
    const result = scoreProvider(provider, ["vision"], "coding", false);
    expect(result.score).toBeLessThan(0);
  });

  test("local preference boosts local providers", () => {
    const localProvider = createMockAdapter({
      id: "ollama",
      capabilities: ["local", "coding"],
      status: "configured",
      priority: 80,
    });
    const remoteProvider = createMockAdapter({
      id: "gemini",
      capabilities: ["coding"],
      status: "configured",
      priority: 80,
    });
    const localScore = scoreProvider(localProvider, [], "coding", true);
    const remoteScore = scoreProvider(remoteProvider, [], "coding", true);
    expect(localScore.score).toBeGreaterThan(remoteScore.score);
  });
});

describe("buildFallbackChain", () => {
  test("returns entries sorted by score", () => {
    const chain = buildFallbackChain("coding", undefined, [], false);
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i - 1].score).toBeGreaterThanOrEqual(chain[i].score);
    }
  });

  test("skips providers with negative scores", () => {
    const chain = buildFallbackChain("coding", undefined, ["vision"], false);
    const skippedWithNegativeScore = chain.filter((e) => e.skipped && e.score < 0);
    expect(skippedWithNegativeScore.length).toBeGreaterThan(0);
  });

  test("lowest-scoring provider is not selected first", () => {
    const chain = buildFallbackChain("coding", undefined, [], false);
    if (chain.length > 0) {
      expect(chain[0].score).toBeGreaterThanOrEqual(0);
    }
  });
});
