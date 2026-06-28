import { describe, expect, test } from "vitest";
import { evaluateProviderReadiness } from "@/lib/provider-readiness";
import type { ProviderRegistryEntry } from "@/lib/provider-types";

function createEntry(overrides: Partial<ProviderRegistryEntry> = {}): ProviderRegistryEntry {
  return {
    id: overrides.id ?? "test-provider",
    capabilities: overrides.capabilities ?? [],
    envVar: overrides.envVar ?? "TEST_API_KEY",
    defaultModel: overrides.defaultModel ?? "test-model",
    priority: overrides.priority ?? 50,
    freeTier: overrides.freeTier ?? true,
    status: overrides.status ?? "configured",
    endpointType: overrides.endpointType ?? "openai_compatible",
    supportsModelEnv: overrides.supportsModelEnv,
  };
}

describe("evaluateProviderReadiness", () => {
  test("returns missing_key when env var is not set", () => {
    const entry = createEntry({ status: "missing_key", envVar: "MISSING_KEY" });
    const result = evaluateProviderReadiness(entry);
    expect(result.readinessStatus).toBe("missing_key");
    expect(result.configured).toBe(false);
    expect(result.sanitizedMessage).toBe("Provider is not configured.");
  });

  test("returns missing_endpoint when no base URL", () => {
    const entry = createEntry({
      id: "unknown",
      status: "configured",
      envVar: "UNKNOWN_API_KEY",
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.readinessStatus).toBe("missing_endpoint");
    expect(result.endpointConfigured).toBe(false);
  });

  test("returns missing_model when no model is available", () => {
    const entry = createEntry({
      id: "unknown",
      status: "configured",
      envVar: "UNKNOWN_API_KEY",
      defaultModel: "",
      supportsModelEnv: undefined,
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.readinessStatus).toBe("missing_model");
    expect(result.modelConfigured).toBe(false);
  });

  test("returns unsupported for non-openai_compatible endpoint types", () => {
    const entry = createEntry({
      id: "native-provider",
      status: "configured",
      envVar: "NATIVE_API_KEY",
      endpointType: "unknown",
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.readinessStatus).toBe("unsupported");
    expect(result.supportsOpenAICompatibleChat).toBe(false);
  });

  test("returns needs_live_check for configured openai_compatible provider", () => {
    const entry = createEntry({
      id: "groq",
      status: "configured",
      envVar: "GROQ_API_KEY",
      endpointType: "openai_compatible",
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.readinessStatus).toBe("needs_live_check");
    expect(result.configured).toBe(true);
    expect(result.endpointConfigured).toBe(true);
    expect(result.modelConfigured).toBe(true);
  });

  test("developer message contains provider id and details", () => {
    const entry = createEntry({
      id: "ollama",
      status: "configured",
      envVar: "OLLAMA_BASE_URL",
      endpointType: "local_openai_compatible",
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.developerMessage).toContain("ollama");
    expect(result.developerMessage).toContain("live smoke test");
  });

  test("sanitized message is safe for normal users", () => {
    const entry = createEntry({
      id: "mistral",
      status: "configured",
      envVar: "MISTRAL_API_KEY",
      endpointType: "openai_compatible",
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.sanitizedMessage).not.toContain("MISTRAL_API_KEY");
    expect(result.sanitizedMessage).not.toContain("Set");
    expect(result.sanitizedMessage.length).toBeGreaterThan(0);
  });

  test("requiresSpecialHeaders is true for cloudflare_workers_ai", () => {
    const entry = createEntry({
      id: "cloudflare_workers_ai",
      status: "configured",
      envVar: "CF_WORKERS_AI_TOKEN",
      endpointType: "openai_compatible",
    });
    const result = evaluateProviderReadiness(entry);
    expect(result.requiresSpecialHeaders).toBe(true);
    expect(result.readinessStatus).toBe("needs_live_check");
  });
});
