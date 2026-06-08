import { AlertTriangle, Gauge } from "lucide-react";
import { quotaPercent, quotaState } from "./governanceService";
import type { UsageOverview } from "./types";
import { useLocale } from "@/features/i18n/localeContext";

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
}) {
  const { t, locale } = useLocale();
  const percent = quotaPercent(used, limit);
  const state = quotaState(used, limit);
  const usedStr = used.toLocaleString(locale === "ar" ? "ar-EG" : "en-US");
  const limitStr =
    limit === null || limit === undefined
      ? t("unlimited")
      : limit.toLocaleString(locale === "ar" ? "ar-EG" : "en-US");
  const valueDisplay =
    limit === null || limit === undefined ? (
      <span>
        <bdi>{usedStr}</bdi> · {t("unlimited")}
      </span>
    ) : (
      <span>{t("usageFormat", { used: usedStr, limit: limitStr })}</span>
    );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={state === "exceeded" ? "text-destructive" : "text-zinc-300"}>
          {valueDisplay}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${
            state === "exceeded"
              ? "bg-destructive"
              : state === "warning"
                ? "bg-warning"
                : "bg-accent"
          }`}
          style={{ width: `${percent ?? 24}%` }}
        />
      </div>
    </div>
  );
}

export function UsageMeters({
  overview,
  onUpgrade,
}: {
  overview: UsageOverview;
  onUpgrade?: () => void;
}) {
  const { t } = useLocale();
  const warning = [
    ["max_projects", overview.projects, overview.limits?.max_projects],
    [
      "max_ai_requests_monthly",
      overview.aiRequestsThisMonth,
      overview.limits?.max_ai_requests_monthly,
    ],
    ["max_active_threads", overview.threads, overview.limits?.max_active_threads],
  ].some(([, used, limit]) => quotaState(Number(used), limit as number | null) !== "ok");

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-accent shrink-0" />
          <div>
            <div className="text-sm font-semibold">{t("quotaGovernance")}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("plan")}:{" "}
              <bdi dir="ltr" className="uppercase">
                {overview.planId}
              </bdi>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Meter
          label={t("projects")}
          used={overview.projects}
          limit={overview.limits?.max_projects}
        />
        <Meter
          label={t("uploads")}
          used={overview.uploadsThisMonth}
          limit={overview.limits?.max_uploads_monthly}
        />
        <Meter
          label={t("aiRequests")}
          used={overview.aiRequestsThisMonth}
          limit={overview.limits?.max_ai_requests_monthly}
        />
        <Meter
          label={t("threads")}
          used={overview.threads}
          limit={overview.limits?.max_active_threads}
        />
        <Meter
          label={t("previews")}
          used={overview.indexedPreviewCount}
          limit={overview.limits?.max_text_preview_files}
        />
      </div>
      {warning && (
        <div className="mt-4 flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">{t("nearLimit")}</div>
            <div className="mt-1 text-warning/80">{t("upgradePrompt")}</div>
            {onUpgrade && (
              <button
                onClick={onUpgrade}
                className="mt-2 text-[10px] uppercase tracking-widest font-bold underline underline-offset-2 hover:text-warning/80 transition-colors"
              >
                {t("upgrade")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
