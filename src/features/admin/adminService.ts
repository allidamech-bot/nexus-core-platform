import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { safeErrorLog, withLogContext } from "@/lib/safeLogging";

type TableName = keyof Database["public"]["Tables"];
type RpcName = keyof Database["public"]["Functions"];

export interface DbHealthItem {
  kind: "table" | "rpc";
  name: string;
  status: "available" | "missing" | "error";
  message: string | null;
}

export interface AdminDashboardData {
  roles: Array<{ user_id: string; role: string; created_at: string; updated_at: string }>;
  plans: Array<{ id: string; name: string; status: string; monthly_price_cents: number | null }>;
  subscriptions: Array<{
    user_id: string;
    plan_id: string;
    status: string;
    billing_status: string;
    updated_at: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    source_type: string;
    created_at: string;
  }>;
  securityEvents: Array<{
    id: string;
    event_type: string;
    severity: string;
    created_at: string;
  }>;
  contextSelections: Array<{
    id: string;
    action: string;
    thread_id: string;
    project_id: string;
    created_at: string;
  }>;
  usageEvents: Array<{
    id: string;
    user_id: string;
    event_type: string;
    quantity: number;
    size_bytes: number;
    token_estimate: number;
    created_at: string;
  }>;
  auditEvents: Array<{
    id: string;
    event_type: string;
    severity: string;
    created_at: string;
  }>;
  dbHealth: DbHealthItem[];
}

const REQUIRED_TABLES: TableName[] = [
  "projects",
  "project_files",
  "project_ingestion_jobs",
  "project_text_previews",
  "project_security_events",
  "admin_email_allowlist",
  "user_roles",
  "billing_plans",
  "plan_usage_limits",
  "user_subscriptions",
  "thread_context_selections",
  "usage_events",
  "audit_events",
  "usage_daily_snapshots",
];

const REQUIRED_RPCS: RpcName[] = [
  "is_admin",
  "get_effective_plan_id",
  "get_plan_limit",
  "get_usage_total",
  "is_within_usage_limit",
];

function classifyDbError(
  error: { code?: string; message?: string } | null,
): DbHealthItem["status"] {
  if (!error) return "available";
  return error.code === "42P01" || error.code === "42883" || error.code === "PGRST202"
    ? "missing"
    : "error";
}

async function checkTable(name: TableName): Promise<DbHealthItem> {
  const { error } = await supabase.from(name).select("*").limit(1);
  return {
    kind: "table",
    name,
    status: classifyDbError(error),
    message: error?.message ?? null,
  };
}

async function checkRpc(name: RpcName, userId: string | null): Promise<DbHealthItem> {
  if (!userId && name !== "is_admin") {
    return {
      kind: "rpc",
      name,
      status: "error",
      message: "Current user is required to verify this RPC.",
    };
  }

  const checkUserId = userId ?? "";
  let error: { code?: string; message?: string } | null = null;
  if (name === "is_admin") {
    ({ error } = await supabase.rpc("is_admin"));
  } else if (name === "get_effective_plan_id") {
    ({ error } = await supabase.rpc("get_effective_plan_id", { check_user_id: checkUserId }));
  } else if (name === "get_plan_limit") {
    ({ error } = await supabase.rpc("get_plan_limit", {
      check_user_id: checkUserId,
      limit_key: "max_projects",
    }));
  } else if (name === "get_usage_total") {
    ({ error } = await supabase.rpc("get_usage_total", {
      check_user_id: checkUserId,
      metric_name: "projects",
    }));
  } else if (name === "is_within_usage_limit") {
    ({ error } = await supabase.rpc("is_within_usage_limit", {
      check_user_id: checkUserId,
      limit_key: "max_projects",
      increment: 0,
    }));
  }

  return {
    kind: "rpc",
    name,
    status: classifyDbError(error),
    message: error?.message ?? null,
  };
}

async function getDbHealth(): Promise<DbHealthItem[]> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  return Promise.all([
    ...REQUIRED_TABLES.map((table) => checkTable(table)),
    ...REQUIRED_RPCS.map((rpc) => checkRpc(rpc, userId)),
  ]);
}

function dataOrEmpty<T>(
  result: { data: T[] | null; error: { message?: string } | null },
  correlationId?: string,
): T[] {
  if (result.error) {
    console.warn(
      "[admin] dashboard query unavailable",
      correlationId
        ? withLogContext({ correlationId }, safeErrorLog(result.error))
        : safeErrorLog(result.error),
    );
    return [];
  }
  return result.data ?? [];
}

export async function getIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return Boolean(data);
}

export async function getAdminDashboardData(correlationId?: string): Promise<AdminDashboardData> {
  const [
    roles,
    plans,
    subscriptions,
    projects,
    securityEvents,
    contextSelections,
    usageEvents,
    auditEvents,
    dbHealth,
  ] = await Promise.all([
    supabase.from("user_roles").select("user_id,role,created_at,updated_at").limit(100),
    supabase.from("billing_plans").select("id,name,status,monthly_price_cents").order("id"),
    supabase
      .from("user_subscriptions")
      .select("user_id,plan_id,status,billing_status,updated_at")
      .limit(100),
    supabase.from("projects").select("id,name,status,source_type,created_at").limit(100),
    supabase
      .from("project_security_events")
      .select("id,event_type,severity,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("thread_context_selections")
      .select("id,action,thread_id,project_id,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("usage_events")
      .select("id,user_id,event_type,quantity,size_bytes,token_estimate,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("audit_events")
      .select("id,event_type,severity,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    getDbHealth(),
  ]);

  return {
    roles: dataOrEmpty(roles, correlationId),
    plans: dataOrEmpty(plans, correlationId),
    subscriptions: dataOrEmpty(subscriptions, correlationId),
    projects: dataOrEmpty(projects, correlationId),
    securityEvents: dataOrEmpty(securityEvents, correlationId),
    contextSelections: dataOrEmpty(contextSelections, correlationId),
    usageEvents: dataOrEmpty(usageEvents, correlationId),
    auditEvents: dataOrEmpty(auditEvents, correlationId),
    dbHealth,
  };
}
