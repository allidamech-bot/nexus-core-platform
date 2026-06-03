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
  const aiPatchPreviewStage = diagnostics.stages.find((stage) => stage.key === "aiPatchPreview");
  const governedPipelineReadiness = diagnostics.health.hasBlockers
    ? t("notReadyForProductionSmoke")
    : t("governedPipelineSmokePass");
  const aiProviderReadiness =
    aiPatchPreviewStage?.status === "complete" || aiPatchPreviewStage?.status === "ready"
      ? t("aiProviderConfigurationPass")
      : t("aiProviderConfigurationBlocked");
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
    <section className="rounded-2xl border border-border bg-background/40 p-3">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-3 md:gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground md:text-xs">
            <ShieldCheck className="size-4 text-accent md:size-3" />
            {t("pipelineDiagnostics")} / {t("productionReadiness")}
          </div>
          <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] md:text-[11px]">
            {t("deploymentReadiness")} / {governedPipelineReadiness} /{" "}
            {t("credentialedProductionSmokeBlocked")} / {aiProviderReadiness}
          </div>
          <div className="mt-2 break-words font-mono text-[11px] uppercase leading-relaxed tracking-wide text-muted-foreground [overflow-wrap:anywhere] md:mt-1 md:text-[10px] md:tracking-widest">
            {releaseInfo.releaseName} / {releaseInfo.releaseStatus} /{" "}
            {releaseInfo.latestStabilization} / {releaseInfo.expectedCommitLabel}
          </div>
        </div>
        <span
          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase ${
            diagnostics.health.hasBlockers
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {diagnostics.health.completeCount}/{diagnostics.health.totalStages}
        </span>
      </div>

      <div className="grid gap-3 md:gap-2">
        {diagnostics.stages.map((stage) => (
          <PipelineStageRow key={stage.key} stage={stage} />
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("releaseGate")}
        </div>
        <div className="mb-3 break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] md:mb-2 md:text-[10px]">
          {t("credentialedSmokeRequired")} {t("environmentConfigurationRequired")}{" "}
          {t("aiProviderConfigurationRequired")}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {releaseRows.map(([label, ready]) => (
            <div
              key={label}
              className="flex min-h-[36px] items-center justify-between gap-2 text-xs leading-snug md:min-h-[32px] md:text-[10px]"
            >
              <span className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere] md:truncate">
                {label}
              </span>
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

      <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3 md:mt-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("safetyInvariants")}
        </div>
        <div className="grid gap-2 md:gap-1">
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
    <div className="rounded-xl border border-border bg-muted/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground md:text-[11px]">
            <StatusIcon status={stage.status} />
            <span className="min-w-0 break-words [overflow-wrap:anywhere] md:truncate">
              {stage.label}
            </span>
          </div>
          <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] md:text-[10px]">
            {stage.description}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold ${statusTone(stage.status)}`}
        >
          {statusLabel(stage.status, t)}
        </span>
      </div>
      <div className="mt-3 break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] md:mt-2 md:text-[10px]">
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
    <div className="mt-3 space-y-1.5 md:mt-2 md:space-y-1">
      <div className={`text-[10px] font-semibold uppercase tracking-widest ${toneClass}`}>
        {title}
      </div>
      {issues.map((issue) => (
        <div
          key={issue}
          className={`break-words text-xs leading-relaxed [overflow-wrap:anywhere] md:text-[10px] ${toneClass}`}
        >
          {issue}
        </div>
      ))}
    </div>
  );
}

function Invariant({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground md:items-center md:text-[10px]">
      <CheckCircle2 className="size-3 shrink-0 text-emerald-300" />
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{text}</span>
    </div>
  );
}
