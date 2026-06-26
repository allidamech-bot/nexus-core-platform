import { Send } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";

const GUIDED_CHIPS = [
  "guidedChip1",
  "guidedChip2",
  "guidedChip3",
  "guidedChip4",
  "guidedChip5",
] as const;

export function GuidedQuestionChips({
  onSelectPrompt,
}: {
  onSelectPrompt?: (prompt: string) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated/80 p-4 shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <Send className="size-4 text-accent" />
        <h3 className="text-sm font-bold text-foreground">{t("guidedQuestionsTitle")}</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {GUIDED_CHIPS.map((chip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const prompt = t(chip as any);
              onSelectPrompt?.(prompt);
            }}
            className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent/10"
          >
            {t(chip as any)}
          </button>
        ))}
      </div>

      <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {t("guidedHint")}
      </div>
    </div>
  );
}
