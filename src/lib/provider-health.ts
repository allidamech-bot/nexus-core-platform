export type ProviderHealthStatus =
  | "healthy"
  | "missing_key"
  | "disabled"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "invalid_response"
  | "unsupported_provider"
  | "unknown";

export interface ProviderHealthEntry {
  providerId: string;
  status: ProviderHealthStatus;
  lastCheckedAt: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorSummary: string | null;
  consecutiveFailures: number;
  cooldownUntil: number | null;
}

export interface ProviderHealthUpdateInput {
  providerId: string;
  status: ProviderHealthStatus;
  errorSummary?: string | null;
}

const COOLDOWN_DURATIONS: Record<ProviderHealthStatus, number> = {
  healthy: 0,
  missing_key: 0,
  disabled: 0,
  rate_limited: 60_000,
  timeout: 30_000,
  provider_error: 15_000,
  invalid_response: 10_000,
  unsupported_provider: 0,
  unknown: 0,
};

const CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD: Record<ProviderHealthStatus, number> = {
  healthy: 0,
  missing_key: 0,
  disabled: 0,
  rate_limited: 1,
  timeout: 3,
  provider_error: 2,
  invalid_response: 1,
  unsupported_provider: 0,
  unknown: 0,
};

class ProviderHealthStore {
  private entries = new Map<string, ProviderHealthEntry>();

  getEntry(providerId: string): ProviderHealthEntry {
    const now = Date.now();
    const existing = this.entries.get(providerId);
    if (existing && now - existing.lastCheckedAt < 5_000) {
      return existing;
    }

    const entry: ProviderHealthEntry = {
      providerId,
      status: "unknown",
      lastCheckedAt: now,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorSummary: null,
      consecutiveFailures: 0,
      cooldownUntil: null,
    };

    this.entries.set(providerId, entry);
    return entry;
  }

  update(input: ProviderHealthUpdateInput): ProviderHealthEntry {
    const now = Date.now();
    const existing = this.entries.get(input.providerId);
    const previousFailures = existing?.consecutiveFailures ?? 0;

    let consecutiveFailures = previousFailures;
    let cooldownUntil: number | null = null;

    if (input.status === "healthy") {
      consecutiveFailures = 0;
      cooldownUntil = null;
    } else {
      consecutiveFailures = previousFailures + 1;
      const threshold = CONSECUTIVE_FAILURE_COOLDOWN_THRESHOLD[input.status] ?? 1;
      if (consecutiveFailures >= threshold) {
        cooldownUntil = now + COOLDOWN_DURATIONS[input.status];
      }
    }

    const entry: ProviderHealthEntry = {
      providerId: input.providerId,
      status: input.status,
      lastCheckedAt: now,
      lastSuccessAt: input.status === "healthy" ? now : (existing?.lastSuccessAt ?? null),
      lastErrorAt: input.status === "healthy" ? (existing?.lastErrorAt ?? null) : now,
      lastErrorSummary:
        input.status === "healthy"
          ? null
          : (input.errorSummary ?? existing?.lastErrorSummary ?? null),
      consecutiveFailures,
      cooldownUntil,
    };

    this.entries.set(input.providerId, entry);
    return entry;
  }

  isEligible(providerId: string): boolean {
    const entry = this.getEntry(providerId);
    if (entry.cooldownUntil !== null && Date.now() < entry.cooldownUntil) {
      return false;
    }
    return (
      entry.status !== "missing_key" &&
      entry.status !== "disabled" &&
      entry.status !== "unsupported_provider"
    );
  }

  getStatus(providerId: string): ProviderHealthStatus {
    return this.getEntry(providerId).status;
  }

  reset(providerId: string): void {
    const now = Date.now();
    this.entries.set(providerId, {
      providerId,
      status: "unknown",
      lastCheckedAt: now,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorSummary: null,
      consecutiveFailures: 0,
      cooldownUntil: null,
    });
  }
}

export const providerHealthStore = new ProviderHealthStore();
