import { supabase } from "../../integrations/supabase/client";

/**
 * Utility to export historical append-only audit logs based on tenant requests.
 * This is a stub for a SOC2-ready data retention export.
 * 
 * @param tenantId The ID of the tenant.
 * @param format The desired export format.
 * @param startDate The start date for the export range.
 * @param endDate The end date for the export range.
 * @returns A string representing the formatted export data.
 */
export async function exportTenantAuditLogs(
  tenantId: string,
  format: "csv" | "json",
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  let query = supabase
    .from("audit_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }
  if (endDate) {
    query = query.lte("created_at", endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch audit events for export:", error);
    throw new Error(`Audit log export failed: ${error.message}`);
  }

  const events = data as any[];

  if (format === "json") {
    return JSON.stringify(events, null, 2);
  }

  if (format === "csv") {
    if (events.length === 0) return "id,created_at,user_id,actor_user_id,event_type,severity,payload\n";
    
    // Simple CSV conversion stub
    const headers = ["id", "created_at", "user_id", "actor_user_id", "event_type", "severity", "payload"];
    const rows = events.map(event => {
      return headers.map(h => {
        const value = event[h];
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  throw new Error(`Unsupported export format: ${format}`);
}
