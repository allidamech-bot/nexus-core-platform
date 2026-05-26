import {
  Activity,
  CheckCircle2,
  CreditCard,
  Database,
  FileWarning,
  Gauge,
  Loader2,
  ShieldCheck,
  UploadCloud,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AdminDashboardData } from "./adminService";
import { useLocale } from "@/features/i18n/localeContext";
import {
  useApproveWritebackRequestMutation,
  useRejectWritebackRequestMutation,
  useWritebackRequestDetailQuery,
  useWritebackRequestsForReviewQuery,
} from "@/features/projects/projectQueries";
import type { ProjectWritebackRequest } from "@/features/projects/projectWritebackRequestService";

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const { t, locale } = useLocale();
  const [selectedWritebackRequestId, setSelectedWritebackRequestId] = useState<string | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const { data: writebackRequests = [], isLoading: loadingWritebackRequests } =
    useWritebackRequestsForReviewQuery();
  const selectedWritebackRequest = selectedWritebackRequestId ?? writebackRequests[0]?.id ?? null;
  const { data: writebackDetail } = useWritebackRequestDetailQuery(selectedWritebackRequest);
  const approveWriteback = useApproveWritebackRequestMutation();
  const rejectWriteback = useRejectWritebackRequestMutation();
  const numLocale = locale === "ar" ? "ar-EG" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale);

  const PLACEHOLDERS = [
    { icon: Users, label: t("placeholderUsers"), detail: t("placeholderUsersDetail") },
    { icon: CreditCard, label: t("placeholderSubs"), detail: t("placeholderSubsDetail") },
    { icon: Gauge, label: t("placeholderUsageLimits"), detail: t("placeholderUsageLimitsDetail") },
    { icon: UploadCloud, label: t("placeholderUploads"), detail: t("placeholderUploadsDetail") },
    { icon: FileWarning, label: t("placeholderSecurity"), detail: t("placeholderSecurityDetail") },
    { icon: Database, label: t("placeholderAudit"), detail: t("placeholderAuditDetail") },
    { icon: Activity, label: t("placeholderSystem"), detail: t("placeholderSystemDetail") },
  ];

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
  const dbHealth = data.dbHealth ?? [];
  const missingDbItems = dbHealth.filter((item) => item.status !== "available");

  const metrics = [
    { label: t("roleRecords"), value: data.roles.length },
    { label: t("plans"), value: data.plans.length },
    { label: t("subscriptions"), value: data.subscriptions.length },
    { label: t("projects"), value: data.projects.length },
    { label: t("uploads"), value: uploadCount },
    { label: t("aiRequests"), value: aiRequests },
    { label: t("tokens"), value: tokenUsage },
    { label: t("previews"), value: previewCount },
    { label: t("failures"), value: ingestionFailures },
  ];

  async function handleApproveRequest(request: ProjectWritebackRequest) {
    try {
      await approveWriteback.mutateAsync({
        requestId: request.id,
        reviewerNote,
      });
      setReviewerNote("");
      toast.success(t("requestApproved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestCannotBeApproved"));
    }
  }

  async function handleRejectRequest(request: ProjectWritebackRequest) {
    if (!reviewerNote.trim()) {
      toast.error(t("reviewerNoteRequiredForRejection"));
      return;
    }
    try {
      await rejectWriteback.mutateAsync({
        requestId: request.id,
        reviewerNote,
      });
      setReviewerNote("");
      toast.success(t("requestRejected"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("writebackRequestBlocked"));
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-8 py-10">
        <div className="mb-10 flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-accent">
              <ShieldCheck className="size-3.5 shrink-0" /> {t("adminFoundation")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-snug">{t("controlPlane")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("controlPlaneSubtitle")}
            </p>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400 shrink-0">
            {t("rlsEnforced")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border bg-surface p-4">
              <div className="font-mono text-2xl font-semibold text-zinc-100" dir="ltr">
                {fmt(metric.value)}
              </div>
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
            rows={data.plans.map((plan) => [plan.name, plan.status, t("paymentsNotConnected")])}
            empty={t("noRecords")}
          />
          <AdminTable
            title={t("securityEvents")}
            rows={data.securityEvents.map((event) => [
              event.severity,
              event.event_type,
              new Date(event.created_at).toLocaleDateString(numLocale),
            ])}
            empty={t("noSecurityEvents")}
          />
          <AdminTable
            title={t("quotaViolations")}
            rows={quotaViolations.map((event) => [
              event.severity,
              event.event_type,
              new Date(event.created_at).toLocaleDateString(numLocale),
            ])}
            empty={t("noQuotaViolations")}
          />
          <AdminTable
            title={t("recentActivity")}
            rows={data.usageEvents
              .slice(0, 12)
              .map((event) => [
                event.event_type,
                fmt(event.quantity),
                new Date(event.created_at).toLocaleDateString(numLocale),
              ])}
            empty={t("noUsageEvents")}
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 text-sm font-semibold">{t("planDistribution")}</div>
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
                      <span className="text-muted-foreground" dir="ltr">
                        {fmt(count)}
                      </span>
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
            <div className="mb-4 text-sm font-semibold">{t("storageIndexing")}</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetricDetail
                label={t("trackedStorage")}
                value={`${(storageBytes / 1024 / 1024).toFixed(2)} MB`}
              />
              <MetricDetail
                label={t("contextSelections")}
                value={fmt(data.contextSelections.length)}
              />
              <MetricDetail label={t("auditEvents")} value={fmt(data.auditEvents.length)} />
              <MetricDetail
                label={t("previewHealth")}
                value={ingestionFailures === 0 ? t("stable") : t("review")}
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <section className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{t("writebackReviewWorkflow")}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("writebackReviewWorkflowDescription")}
                  </p>
                </div>
                <span className="rounded border border-warning/30 bg-warning/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-warning">
                  {t("reviewDecision")}
                </span>
              </div>
            </div>

            {loadingWritebackRequests ? (
              <div className="grid min-h-32 place-items-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : writebackRequests.length === 0 ? (
              <div className="px-5 py-5 text-xs text-muted-foreground">
                {t("noSubmittedRequests")}
              </div>
            ) : (
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <div className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">
                  {writebackRequests.map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedWritebackRequestId(request.id)}
                      className={`block w-full px-5 py-4 text-left hover:bg-white/5 ${
                        selectedWritebackRequest === request.id ? "bg-accent/5" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-zinc-200">
                            {request.title || t("reviewRequest")}
                          </div>
                          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                            {request.projectId.slice(0, 8)} / {request.snapshotId.slice(0, 8)}
                          </div>
                        </div>
                        <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] uppercase text-zinc-300">
                          {request.riskLevel}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                        <MetricDetail
                          label={t("changedFiles")}
                          value={fmt(request.changedFilesCount)}
                        />
                        <MetricDetail label={t("blockers")} value={fmt(request.blockers.length)} />
                        <MetricDetail label={t("requestStatus")} value={request.status} />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {writebackDetail ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-semibold">{t("reviewRequest")}</div>
                        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {t("approvalDoesNotApplyChanges")}{" "}
                          {t("approvedForFutureWritebackConsideration")}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MetricDetail
                          label={t("projects")}
                          value={
                            writebackDetail.project?.name ??
                            writebackDetail.request.projectId.slice(0, 8)
                          }
                        />
                        <MetricDetail
                          label={t("riskLevel")}
                          value={writebackDetail.request.riskLevel}
                        />
                        <MetricDetail
                          label={t("reviewer")}
                          value={writebackDetail.request.reviewerId?.slice(0, 8) ?? "-"}
                        />
                        <MetricDetail
                          label={t("reviewedAt")}
                          value={
                            writebackDetail.request.reviewedAt
                              ? new Date(writebackDetail.request.reviewedAt).toLocaleString(
                                  numLocale,
                                )
                              : "-"
                          }
                        />
                      </div>
                      {writebackDetail.request.requesterNote && (
                        <ReviewText
                          label={t("requesterNote")}
                          text={writebackDetail.request.requesterNote}
                        />
                      )}
                      {writebackDetail.request.blockers.length > 0 && (
                        <ReviewIssueList
                          title={t("requestHasBlockers")}
                          issues={writebackDetail.request.blockers}
                          tone="blocker"
                        />
                      )}
                      {writebackDetail.request.warnings.length > 0 && (
                        <ReviewIssueList
                          title={t("conflicts")}
                          issues={writebackDetail.request.warnings}
                          tone="warning"
                        />
                      )}
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {t("changedFiles")}
                        </div>
                        {writebackDetail.changedFiles.length === 0 ? (
                          <div className="rounded border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                            {t("noChangedFiles")}
                          </div>
                        ) : (
                          writebackDetail.changedFiles.slice(0, 8).map((file) => (
                            <div
                              key={file.id}
                              className="rounded border border-border bg-background/40 p-3"
                            >
                              <div
                                className="truncate font-mono text-[10px] text-zinc-300"
                                dir="ltr"
                              >
                                {file.filePath}
                              </div>
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {file.truncated
                                  ? t("previewTruncatedForSafety")
                                  : t("snapshotLimitedToIndexedText")}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <textarea
                        value={reviewerNote}
                        onChange={(event) => setReviewerNote(event.target.value)}
                        placeholder={t("reviewerNote")}
                        className="min-h-20 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-muted-foreground focus:border-accent/40"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(writebackDetail.request)}
                          disabled={
                            approveWriteback.isPending ||
                            rejectWriteback.isPending ||
                            writebackDetail.request.blockers.length > 0
                          }
                          className="flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {approveWriteback.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3" />
                          )}
                          {t("approveRequest")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(writebackDetail.request)}
                          disabled={approveWriteback.isPending || rejectWriteback.isPending}
                          className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11px] font-semibold text-destructive hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rejectWriteback.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <XCircle className="size-3" />
                          )}
                          {t("rejectRequest")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{t("noSubmittedRequests")}</div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <OperationsPanel
            title={t("systemHealth")}
            rows={[
              [t("authRls"), t("active")],
              [t("projectIngestion"), t("ready")],
              [t("aiGateway"), t("configuredByEnv")],
              [t("executionRuntime"), t("disabled")],
            ]}
          />
          <OperationsPanel
            title={t("migrationChecklist")}
            rows={dbHealth.map((item) => [
              `${item.kind}: ${item.name}`,
              item.status === "available" ? t("ready") : item.status,
            ])}
          />
          <OperationsPanel
            title={t("operationalWarnings")}
            rows={[
              [
                t("systemHealth"),
                missingDbItems.length === 0 ? t("ready") : `${fmt(missingDbItems.length)} missing`,
              ],
              [t("billing"), t("providerNotConnected")],
              [t("teams"), t("notEnabled")],
              [t("sandbox"), t("notEnabled")],
              [t("bundle"), t("largeChunkWarning")],
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

function ReviewText({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="rounded border border-border bg-background/40 p-3 text-xs leading-relaxed text-zinc-300">
        {text}
      </div>
    </div>
  );
}

function ReviewIssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { code: string; message: string; filePath?: string }[];
  tone: "warning" | "blocker";
}) {
  const toneClass = tone === "blocker" ? "text-destructive" : "text-warning";
  return (
    <div className="space-y-1 rounded border border-border bg-background/40 p-3">
      <div className={`text-[10px] font-semibold uppercase tracking-widest ${toneClass}`}>
        {title}
      </div>
      {issues.map((issue, index) => (
        <div
          key={`${issue.code}-${issue.filePath ?? ""}-${index}`}
          className={`text-xs ${toneClass}`}
        >
          {issue.filePath ? `${issue.filePath}: ` : ""}
          {issue.message}
        </div>
      ))}
    </div>
  );
}

function AdminTable({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) {
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
