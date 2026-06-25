import { Lightbulb, MessageCircle, FileText, ListTodo, Upload } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";

export function BuilderNextActionBar() {
  const { t } = useLocale();

  const actions = [
    { key: "nextActionDescribeIdea", icon: Lightbulb },
    { key: "nextActionAnswerQuestions", icon: MessageCircle },
    { key: "nextActionDraftMvp", icon: FileText },
    { key: "nextActionChooseTask", icon: ListTodo },
  ] as const;

  return (
    <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated/80 p-4 shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="size-4 text-accent" />
        <h3 className="text-sm font-bold text-foreground">{t("nextActionTitle")}</h3>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{t("nextActionDescribeIdea")}</p>

      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]"
            >
              <Icon className="size-3 text-accent" />
              <span className="text-muted-foreground">{t(a.key as any)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <Upload className="size-3" />
          <span>{t("nextActionUploadHint")}</span>
        </div>
      </div>
    </div>
  );
}
