import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { exportTenantAuditLogs } from "@/features/enterprise/compliance";
import { getRequestCorrelationId, safeErrorLog, withLogContext } from "@/lib/safeLogging";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function jsonResponse(payload: Record<string, unknown>, status: number, correlationId: string) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-correlation-id": correlationId,
    },
  });
}

export const Route = createFileRoute("/api/enterprise/audit-export")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);

        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return jsonResponse({ message: "Unauthorized" }, 401, correlationId);
          }

          const token = authHeader.replace("Bearer ", "").trim();
          if (!token) return jsonResponse({ message: "Unauthorized" }, 401, correlationId);

          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase env vars");
          }

          const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
          });

          const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
          if (claimsError || !claimsData?.claims?.sub) {
            return jsonResponse({ message: "Unauthorized" }, 401, correlationId);
          }

          const url = new URL(request.url);
          const tenantId = url.searchParams.get("tenantId");
          const format = (url.searchParams.get("format") || "json") as "json" | "csv";
          const start = url.searchParams.get("startDate");
          const end = url.searchParams.get("endDate");

          if (!tenantId) {
            return jsonResponse({ message: "tenantId is required" }, 400, correlationId);
          }

          // Verify user has access to tenant
          const { data: tenantMember, error: tenantError } = await supabase
            .from("tenant_members")
            .select("role")
            .eq("tenant_id", tenantId)
            .eq("user_id", claimsData.claims.sub)
            .maybeSingle();

          if (tenantError || !tenantMember) {
            return jsonResponse({ message: "Forbidden: Not a tenant member" }, 403, correlationId);
          }

          const startDate = start ? new Date(start) : undefined;
          const endDate = end ? new Date(end) : undefined;

          const exportData = await exportTenantAuditLogs(tenantId, format, startDate, endDate);

          const contentType = format === "csv" ? "text/csv" : "application/json";
          const ext = format === "csv" ? "csv" : "json";

          return new Response(exportData, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="audit-export-${tenantId}.${ext}"`,
              "x-correlation-id": correlationId,
            },
          });
        } catch (error) {
          console.error("[audit-export] failed", withLogContext({ correlationId }, safeErrorLog(error)));
          return jsonResponse({ message: "Audit export failed" }, 500, correlationId);
        }
      },
    },
  },
});
