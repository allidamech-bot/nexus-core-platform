import {
  Lightbulb,
  HelpCircle,
  FileText,
  Layout,
  Database,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";

const BUILDER_STEPS = [
  { icon: Lightbulb, label: "Understand idea" },
  { icon: HelpCircle, label: "Clarifying questions" },
  { icon: FileText, label: "MVP brief" },
  { icon: Layout, label: "Screens/modules" },
  { icon: Database, label: "Data model" },
  { icon: ListChecks, label: "Build plan" },
  { icon: ArrowRight, label: "Next task" },
] as const;

export function BuilderBriefPanel() {
  const { t } = useLocale();

  return (
    <div className="mx-auto my-auto max-w-lg">
      <div className="rounded-2xl border border-border bg-surface-elevated/80 p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="size-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Builder Brief</h2>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          Describe your idea in the chat. Nexus will guide you through planning before any files
          exist.
        </p>

        <div className="space-y-2">
          {BUILDER_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-background">
                  <Icon className="size-3.5 text-accent" />
                </div>
                <span className="text-foreground">{t(`builderBriefStep${i + 1}` as any)}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[11px] text-muted-foreground/70">{t("builderBriefUploadHint")}</p>
        </div>
      </div>
    </div>
  );
}
