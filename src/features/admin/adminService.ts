import { supabase } from "@/integrations/supabase/client";

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
}

export async function getIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return Boolean(data);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    roles,
    plans,
    subscriptions,
    projects,
    securityEvents,
    contextSelections,
    usageEvents,
    auditEvents,
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
  ]);

  for (const result of [
    roles,
    plans,
    subscriptions,
    projects,
    securityEvents,
    contextSelections,
    usageEvents,
    auditEvents,
  ]) {
    if (result.error) throw result.error;
  }

  return {
    roles: roles.data ?? [],
    plans: plans.data ?? [],
    subscriptions: subscriptions.data ?? [],
    projects: projects.data ?? [],
    securityEvents: securityEvents.data ?? [],
    contextSelections: contextSelections.data ?? [],
    usageEvents: usageEvents.data ?? [],
    auditEvents: auditEvents.data ?? [],
  };
}
