import {
  Activity,
  CreditCard,
  Database,
  FileWarning,
  Gauge,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import type { AdminDashboardData } from "./adminService";
import { useLocale } from "@/features/i18n/localeContext";

const PLACEHOLDERS = [
  { icon: Users, label: "Users", detail: "Role and account operations" },
  { icon: CreditCard, label: "Subscriptions", detail: "Plan status and billing health" },
  { icon: Gauge, label: "Usage limits", detail: "Quota policy and enforcement" },
  { icon: UploadCloud, label: "Project uploads", detail: "Ingestion and storage visibility" },
  { icon: FileWarning, label: "Security events", detail: "Suspicious upload and access events" },
  { icon: Database, label: "Audit logs", detail: "Admin and context-selection history" },
  { icon: Activity, label: "System health", detail: "Runtime, queue, and provider status" },
];

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const { t } = useLocale();
  const aiRequests = data.usageEvents
    .filter((event) => event.event_type === "ai_request")
    .reduce((sum, event) => sum + event.quantity, 0);
  const tokenUsage = data.usageEvents.reduce((sum, event) => sum + event.token_estimate, 0);
  const uploadCount = data.usageEvents
    .filter((event) => event.event_type === "project_upload_completed")
    .reduce((sum, event) => sum + event.quantity, 0);
  const previewCount = data.usageEvents
    .filter((event) => event.event_type === "preview_indexed")
    .reduce((sum, event) => sum + event.quantity, 0);
  const storageBytes = data.usageEvents.reduce((sum, event) => sum + event.size_bytes, 0);
  const quotaViolations = data.auditEvents.filter((event) =>
    event.event_type.startsWith("quota_hit"),
  );
  const ingestionFailures = data.usageEvents.filter(
    (event) => event.event_type === "ingestion_failed",
  ).length;
  const planDistribution = data.subscriptions.reduce<Record<string, number>>(
    (acc, subscription) => {
      acc[subscription.plan_id] = (acc[subscription.plan_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const metrics = [
    { label: "Role records", value: data.roles.length },
    { label: "Plans", value: data.plans.length },
    { label: "Subscriptions", value: data.subscriptions.length },
    { label: t("projects"), value: data.projects.length },
    { label: t("uploads"), value: uploadCount },
    { label: t("aiRequests"), value: aiRequests },
    { label: "Tokens", value: tokenUsage },
    { label: t("previews"), value: previewCount },
    { label: "Failures", value: ingestionFailures },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-accent">
              <ShieldCheck className="size-3.5" /> {t("adminFoundation")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t("controlPlane")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Secure administrative visibility for roles, billing placeholders, project ingestion,
              security events, audit history, and system health.
            </p>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
            {t("rlsEnforced")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border bg-surface p-4">
              <div className="font-mono text-2xl font-semibold text-zinc-100">{metric.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PLACEHOLDERS.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface p-5">
              <item.icon className="mb-3 size-4 text-accent" />
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <AdminTable
            title={t("billingPlans")}
            rows={data.plans.map((plan) => [plan.name, plan.status, "Payments not connected"])}
          />
          <AdminTable
            title={t("securityEvents")}
            rows={data.securityEvents.map((event) => [
              event.severity,
              event.event_type,
              new Date(event.created_at).toLocaleDateString(),
            ])}
            empty="No security events visible."
          />
          <AdminTable
            title={t("quotaViolations")}
            rows={quotaViolations.map((event) => [
              event.severity,
              event.event_type,
              new Date(event.created_at).toLocaleDateString(),
            ])}
            empty="No quota violations recorded."
          />
          <AdminTable
            title={t("recentActivity")}
            rows={data.usageEvents
              .slice(0, 12)
              .map((event) => [
                event.event_type,
                event.quantity.toLocaleString(),
                new Date(event.created_at).toLocaleDateString(),
              ])}
            empty="No usage events recorded."
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 text-sm font-semibold">Plan distribution</div>
            <div className="space-y-3">
              {data.plans.map((plan) => {
                const count = planDistribution[plan.id] ?? 0;
                const width = data.subscriptions.length
                  ? Math.max(8, Math.round((count / data.subscriptions.length) * 100))
                  : 8;
                return (
                  <div key={plan.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{plan.name}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5">
                      <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 text-sm font-semibold">Storage and indexing health</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetricDetail
                label="Tracked storage"
                value={`${(storageBytes / 1024 / 1024).toFixed(2)} MB`}
              />
              <MetricDetail
                label="Context selections"
                value={data.contextSelections.length.toString()}
              />
              <MetricDetail label="Audit events" value={data.auditEvents.length.toString()} />
              <MetricDetail
                label="Preview health"
                value={ingestionFailures === 0 ? "Stable" : "Review"}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <OperationsPanel
            title="System health"
            rows={[
              ["Auth/RLS", "Active"],
              ["Project ingestion", "Ready"],
              ["AI gateway", "Configured by env"],
              ["Execution runtime", "Disabled"],
            ]}
          />
          <OperationsPanel
            title="Migration checklist"
            rows={[
              ["Admin roles", data.roles.length > 0 ? "Detected" : "No records"],
              ["Plans", data.plans.length >= 4 ? "Seeded" : "Review"],
              ["Usage events", data.usageEvents.length > 0 ? "Receiving" : "Empty"],
              ["Audit events", data.auditEvents.length > 0 ? "Receiving" : "Empty"],
            ]}
          />
          <OperationsPanel
            title="Operational warnings"
            rows={[
              ["Billing", "Provider not connected"],
              ["Teams", "Not enabled"],
              ["Sandbox", "Not enabled"],
              ["Bundle", "Large chunk warning"],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function OperationsPanel({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="rounded border border-border bg-background/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function AdminTable({
  title,
  rows,
  empty = "No records visible.",
}: {
  title: string;
  rows: string[][];
  empty?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-xs text-muted-foreground">{empty}</div>
        ) : (
          rows.slice(0, 8).map((row, index) => (
            <div key={index} className="grid grid-cols-3 gap-3 px-4 py-3 text-xs">
              {row.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  className={
                    cellIndex === 0 ? "font-medium text-zinc-200" : "text-muted-foreground"
                  }
                >
                  {cell}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
