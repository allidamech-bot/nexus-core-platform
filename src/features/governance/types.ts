import type { Json } from "@/integrations/supabase/types";

export type PlanId = "starter" | "pro" | "business" | "enterprise";

export interface UsageLimitSet {
  plan_id: PlanId;
  max_projects: number | null;
  max_upload_mb: number | null;
  max_text_preview_files: number | null;
  max_chat_context_previews: number | null;
  max_uploads_monthly: number | null;
  max_ai_requests_monthly: number | null;
  max_active_threads: number | null;
  max_context_previews: number | null;
  max_context_payload_bytes: number | null;
  max_indexed_preview_bytes: number | null;
}

export interface UsageOverview {
  planId: PlanId;
  limits: UsageLimitSet | null;
  projects: number;
  uploadsThisMonth: number;
  uploadedZipBytesThisMonth: number;
  indexedPreviewCount: number;
  indexedPreviewBytes: number;
  aiRequestsThisMonth: number;
  estimatedTokensThisMonth: number;
  contextPayloadBytesThisMonth: number;
  selectedPreviewEventsThisMonth: number;
  threads: number;
  activeProjects: number;
  ingestionFailuresThisMonth: number;
  securityEventsThisMonth: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  planId: PlanId;
  limitKey: keyof Omit<UsageLimitSet, "plan_id">;
  limit: number | null;
  used: number;
  requested: number;
  message: string;
}

export interface UsageEventInput {
  userId: string;
  eventType: string;
  correlationId?: string;
  quantity?: number;
  sizeBytes?: number;
  tokenEstimate?: number;
  projectId?: string | null;
  threadId?: string | null;
  metadata?: Record<string, Json>;
}

export interface AuditEventInput {
  userId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  correlationId?: string;
  severity?: "info" | "warning" | "critical";
  projectId?: string | null;
  threadId?: string | null;
  payload?: Record<string, Json>;
}
