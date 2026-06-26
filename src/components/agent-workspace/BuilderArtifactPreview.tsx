import { FileText, Layout, Database, ListChecks, ArrowRight } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";

export function BuilderArtifactPreview() {
  const { t } = useLocale();

  const artifacts = [
    { key: "artifactMvpBrief", icon: FileText },
    { key: "artifactScreensModules", icon: Layout },
    { key: "artifactDataModel", icon: Database },
    { key: "artifactBuildPlan", icon: ListChecks },
    { key: "artifactNextTask", icon: ArrowRight },
  ] as const;

  return (
    <div className="mx-auto my-auto max-w-lg">
      <div className="rounded-2xl border border-border bg-surface-elevated/80 p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="size-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">{t("buildPlanPreview")}</h2>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">{t("previewNotPersisted")}</p>

        <div className="space-y-2">
          {artifacts.map((a, i) => {
            const Icon = a.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
              >
                <Icon className="size-4 text-accent mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground">{t(a.key as any)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground/70">
                    {t("draftPreviewLabel")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
