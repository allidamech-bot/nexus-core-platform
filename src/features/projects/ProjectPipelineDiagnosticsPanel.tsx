import { AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck, XCircle } from "lucide-react";
import { useMemo } from "react";
import { useLocale } from "@/features/i18n/localeContext";
import {
  buildProjectPipelineDiagnostics,
  type PipelineStageDiagnostic,
  type PipelineStageStatus,
  type ProjectPipelineDiagnosticsInput,
} from "./projectPipelineDiagnostics";
import { releaseInfo } from "@/lib/releaseInfo";

function statusTone(status: PipelineStageStatus) {
  if (status === "complete") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "ready") return "border-accent/25 bg-accent/10 text-accent";
  if (status === "warning") return "border-warning/25 bg-warning/10 text-warning";
  if (status === "blocked" || status === "failed") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

function StatusIcon({ status }: { status: PipelineStageStatus }) {
  if (status === "complete" || status === "ready") {
    return <CheckCircle2 className="size-3 text-emerald-300" />;
  }
  if (status === "warning") return <AlertTriangle className="size-3 text-warning" />;
  if (status === "blocked" || status === "failed") {
    return <XCircle className="size-3 text-destructive" />;
  }
  return <CircleDashed className="size-3 text-muted-foreground" />;
}

function statusLabel(status: PipelineStageStatus, t: ReturnType<typeof useLocale>["t"]) {
  if (status === "complete") return t("complete");
  if (status === "ready") return t("readyToContinue");
  if (status === "warning") return t("warning");
  if (status === "blocked") return t("blocked");
  if (status === "failed") return t("failed");
  return t("notEnabled");
}

export function ProjectPipelineDiagnosticsPanel(input: ProjectPipelineDiagnosticsInput) {
  const { t } = useLocale();
  const diagnostics = useMemo(() => buildProjectPipelineDiagnostics(input), [input]);
  const releaseRows = [
    [t("uploadZip"), diagnostics.releaseGate.canUploadProcessZip],
    [t("safePreview"), diagnostics.releaseGate.safePreviewReady],
    [t("groundedPatchPreview"), diagnostics.releaseGate.patchPreviewReady],
    [t("aiPatchPreview"), diagnostics.releaseGate.aiPatchPreviewConfigured],
    [t("patchSandbox"), diagnostics.releaseGate.canSandboxVerificationRun],
    [t("patchSnapshot"), diagnostics.releaseGate.canSnapshotBeCreated],
    [t("downloadSnapshotExport"), diagnostics.releaseGate.canSnapshotBeExported],
    [t("requestSourceWritebackReview"), diagnostics.releaseGate.canWritebackRequestBeCreated],
    [t("reviewRequest"), diagnostics.releaseGate.canRequestBeReviewed],
    [t("versionedWorkingCopy"), diagnostics.releaseGate.canWorkingCopyBeCreated],
    [t("downloadWorkingCopyExport"), diagnostics.releaseGate.canWorkingCopyBeExported],
    [t("sourceWritebackIsNotAvailableYet"), diagnostics.releaseGate.realSourceWritebackUnavailable],
  ] as const;

  return (
    <section className="rounded-md border border-border bg-background/40 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ShieldCheck className="size-3 text-accent" />
            {t("pipelineDiagnostics")} / {t("productionReadiness")}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("deploymentReadiness")} / {t("productionSmokeChecklist")} /{" "}
            {diagnostics.health.hasBlockers
              ? t("notReadyForProductionSmoke")
              : t("readyForProductionSmoke")}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {releaseInfo.releaseName} / {releaseInfo.releaseStatus} /{" "}
            {releaseInfo.latestStabilization} / {releaseInfo.expectedCommitLabel}
          </div>
        </div>
        <span
          className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${
            diagnostics.health.hasBlockers
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {diagnostics.health.completeCount}/{diagnostics.health.totalStages}
        </span>
      </div>

      <div className="grid gap-2">
        {diagnostics.stages.map((stage) => (
          <PipelineStageRow key={stage.key} stage={stage} />
        ))}
      </div>

      <div className="mt-3 rounded border border-border bg-muted/50 p-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("releaseGate")}
        </div>
        <div className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
          {t("credentialedSmokeRequired")} {t("environmentConfigurationRequired")}{" "}
          {t("aiProviderConfigurationRequired")}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {releaseRows.map(([label, ready]) => (
            <div key={label} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="min-w-0 truncate text-muted-foreground">{label}</span>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 uppercase ${
                  ready
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "border-warning/25 bg-warning/10 text-warning"
                }`}
              >
                {ready ? t("ready") : t("blocked")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded border border-border bg-muted/50 p-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("safetyInvariants")}
        </div>
        <div className="grid gap-1">
          <Invariant text={t("originalProjectFilesRemainUnchanged")} />
          <Invariant text={t("objectStorageRemainsUnchanged")} />
          <Invariant text={t("sourceZipRemainsUnchanged")} />
          <Invariant text={t("sourceWritebackIsNotAvailableYet")} />
        </div>
      </div>
    </section>
  );
}

function PipelineStageRow({ stage }: { stage: PipelineStageDiagnostic }) {
  const { t } = useLocale();
  return (
    <div className="rounded border border-border bg-muted/50 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <StatusIcon status={stage.status} />
            <span className="truncate">{stage.label}</span>
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {stage.description}
          </div>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${statusTone(stage.status)}`}
        >
          {statusLabel(stage.status, t)}
        </span>
      </div>
      <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{t("nextSafeAction")}:</span>{" "}
        {stage.requiredNextAction}
      </div>
      {stage.blockers.length > 0 && (
        <StageIssues title={t("blockers")} issues={stage.blockers} tone="blocker" />
      )}
      {stage.warnings.length > 0 && (
        <StageIssues title={t("warning")} issues={stage.warnings} tone="warning" />
      )}
    </div>
  );
}

function StageIssues({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: string[];
  tone: "warning" | "blocker";
}) {
  const toneClass = tone === "blocker" ? "text-destructive" : "text-warning";
  return (
    <div className="mt-2 space-y-1">
      <div className={`text-[10px] font-semibold uppercase tracking-widest ${toneClass}`}>
        {title}
      </div>
      {issues.map((issue) => (
        <div key={issue} className={`text-[10px] ${toneClass}`}>
          {issue}
        </div>
      ))}
    </div>
  );
}

function Invariant({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <CheckCircle2 className="size-3 shrink-0 text-emerald-300" />
      <span>{text}</span>
    </div>
  );
}
