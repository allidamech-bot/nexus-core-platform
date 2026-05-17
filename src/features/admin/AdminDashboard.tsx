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
  const metrics = [
    { label: "Role records", value: data.roles.length },
    { label: "Plans", value: data.plans.length },
    { label: "Subscriptions", value: data.subscriptions.length },
    { label: "Projects", value: data.projects.length },
    { label: "Security events", value: data.securityEvents.length },
    { label: "Context selections", value: data.contextSelections.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-accent">
              <ShieldCheck className="size-3.5" /> Admin foundation
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Control plane</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Secure administrative visibility for roles, billing placeholders, project ingestion,
              security events, audit history, and system health.
            </p>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
            RLS enforced
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
            title="Billing plans"
            rows={data.plans.map((plan) => [plan.name, plan.status, "Payments not connected"])}
          />
          <AdminTable
            title="Recent security events"
            rows={data.securityEvents.map((event) => [
              event.severity,
              event.event_type,
              new Date(event.created_at).toLocaleDateString(),
            ])}
            empty="No security events visible."
          />
        </div>
      </div>
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
