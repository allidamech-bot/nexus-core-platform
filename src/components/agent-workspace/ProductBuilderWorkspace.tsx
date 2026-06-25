import { Lightbulb } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";
import { BuilderBriefPanel } from "./BuilderBriefPanel";
import { BuilderNextActionBar } from "./BuilderNextActionBar";
import { GuidedQuestionChips } from "./GuidedQuestionChips";

export function ProductBuilderWorkspace({
  onSelectPrompt,
}: {
  onSelectPrompt?: (prompt: string) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-4 md:p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Lightbulb className="size-6 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">{t("productBuilderTitle")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("productBuilderSubtitle")}</p>
      </div>

      <div className="flex w-full max-w-lg flex-col gap-4">
        <section>
          <BuilderBriefPanel />
        </section>

        <section>
          <GuidedQuestionChips onSelectPrompt={onSelectPrompt} />
        </section>

        <section>
          <BuilderNextActionBar />
        </section>
      </div>
    </div>
  );
}
