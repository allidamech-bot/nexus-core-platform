import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  AuditEventInput,
  PlanId,
  QuotaCheckResult,
  UsageEventInput,
  UsageLimitSet,
  UsageOverview,
} from "./types";

const MONTH_START = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

export function estimateTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Math.ceil(text.length / 4);
}

export function estimateByteSize(value: unknown): number {
  return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value ?? ""))
    .length;
}

export function quotaPercent(used: number, limit: number | null | undefined): number | null {
  if (!limit || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function quotaState(used: number, limit: number | null | undefined) {
  const percent = quotaPercent(used, limit);
  if (percent === null) return "unlimited";
  if (percent >= 100) return "exceeded";
  if (percent >= 80) return "warning";
  return "ok";
}

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) throw new Error("Authentication required.");
  return data.user.id;
}

export async function recordUsageEvent(input: UsageEventInput): Promise<void> {
  const { error } = await supabase.from("usage_events").insert({
    user_id: input.userId,
    event_type: input.eventType,
    quantity: input.quantity ?? 1,
    size_bytes: input.sizeBytes ?? 0,
    token_estimate: input.tokenEstimate ?? 0,
    project_id: input.projectId ?? null,
    thread_id: input.threadId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  const { error } = await supabase.from("audit_events").insert({
    user_id: input.userId ?? null,
    actor_user_id: input.actorUserId ?? input.userId ?? null,
    event_type: input.eventType,
    severity: input.severity ?? "info",
    project_id: input.projectId ?? null,
    thread_id: input.threadId ?? null,
    payload: input.payload ?? {},
  });
  if (error) throw error;
}

async function getPlanId(userId: string): Promise<PlanId> {
  const { data, error } = await supabase.rpc("get_effective_plan_id", { check_user_id: userId });
  if (error) throw error;
  return (data ?? "starter") as PlanId;
}

async function getLimits(planId: PlanId): Promise<UsageLimitSet | null> {
  const { data, error } = await supabase
    .from("plan_usage_limits")
    .select("*")
    .eq("plan_id", planId)
    .maybeSingle();
  if (error) throw error;
  return data as UsageLimitSet | null;
}

async function usageTotal(userId: string, metricName: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_usage_total", {
    check_user_id: userId,
    metric_name: metricName,
    since_at: MONTH_START(),
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getUsageOverview(userId: string): Promise<UsageOverview> {
  const planId = await getPlanId(userId);
  const limits = await getLimits(planId);

  const [
    projects,
    uploadsThisMonth,
    indexedPreviewCount,
    indexedPreviewBytes,
    aiRequestsThisMonth,
    threads,
    securityEventsThisMonth,
  ] = await Promise.all([
    usageTotal(userId, "projects"),
    usageTotal(userId, "project_upload_completed"),
    usageTotal(userId, "indexed_preview_files"),
    usageTotal(userId, "indexed_preview_bytes"),
    usageTotal(userId, "ai_request"),
    usageTotal(userId, "active_threads"),
    usageTotal(userId, "security_events"),
  ]);

  const { data: monthlyEvents, error } = await supabase
    .from("usage_events")
    .select("event_type,size_bytes,token_estimate,quantity")
    .eq("user_id", userId)
    .gte("created_at", MONTH_START());
  if (error) throw error;

  const uploadedZipBytesThisMonth = (monthlyEvents ?? [])
    .filter((event) => event.event_type === "project_upload_completed")
    .reduce((sum, event) => sum + Number(event.size_bytes ?? 0), 0);
  const estimatedTokensThisMonth = (monthlyEvents ?? [])
    .filter((event) => event.event_type === "ai_request")
    .reduce((sum, event) => sum + Number(event.token_estimate ?? 0), 0);
  const contextPayloadBytesThisMonth = (monthlyEvents ?? [])
    .filter((event) => event.event_type === "ai_context_payload")
    .reduce((sum, event) => sum + Number(event.size_bytes ?? 0), 0);
  const selectedPreviewEventsThisMonth = (monthlyEvents ?? [])
    .filter((event) => event.event_type === "context_preview_selected")
    .reduce((sum, event) => sum + Number(event.quantity ?? 0), 0);
  const ingestionFailuresThisMonth = (monthlyEvents ?? [])
    .filter((event) => event.event_type === "ingestion_failed")
    .reduce((sum, event) => sum + Number(event.quantity ?? 0), 0);

  return {
    planId,
    limits,
    projects,
    uploadsThisMonth,
    uploadedZipBytesThisMonth,
    indexedPreviewCount,
    indexedPreviewBytes,
    aiRequestsThisMonth,
    estimatedTokensThisMonth,
    contextPayloadBytesThisMonth,
    selectedPreviewEventsThisMonth,
    threads,
    activeProjects: projects,
    ingestionFailuresThisMonth,
    securityEventsThisMonth,
  };
}

const LIMIT_TO_USAGE: Record<string, keyof UsageOverview> = {
  max_projects: "projects",
  max_uploads_monthly: "uploadsThisMonth",
  max_ai_requests_monthly: "aiRequestsThisMonth",
  max_active_threads: "threads",
  max_text_preview_files: "indexedPreviewCount",
  max_indexed_preview_bytes: "indexedPreviewBytes",
};

export async function checkQuota(
  userId: string,
  limitKey: QuotaCheckResult["limitKey"],
  requested = 1,
): Promise<QuotaCheckResult> {
  const overview = await getUsageOverview(userId);
  const limit = overview.limits?.[limitKey] ?? null;
  const usageKey = LIMIT_TO_USAGE[limitKey];
  const used = usageKey ? Number(overview[usageKey] ?? 0) : 0;
  const allowed = limit === null || used + requested <= limit;

  return {
    allowed,
    planId: overview.planId,
    limitKey,
    limit,
    used,
    requested,
    message: allowed
      ? "Quota available."
      : `${overview.planId.toUpperCase()} plan limit reached for ${limitKey}.`,
  };
}

export function jsonMetadata(input: Record<string, Json>): Record<string, Json> {
  return input;
}
