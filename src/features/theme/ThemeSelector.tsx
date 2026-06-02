import { Check, Palette } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";
import { NEXUS_THEMES, type NexusTheme, useTheme } from "./themeContext";

const THEME_LABELS: Record<NexusTheme, { en: string; ar: string }> = {
  "matte-black": {
    en: "Matte Black",
    ar: "\u0623\u0633\u0648\u062f \u0645\u0637\u0641\u064a",
  },
  "deep-black": {
    en: "Deep Black",
    ar: "\u0623\u0633\u0648\u062f \u062f\u0627\u0643\u0646",
  },
  "light-beige": {
    en: "Light Beige",
    ar: "\u0641\u0627\u062a\u062d \u0628\u064a\u062c",
  },
};

export function themeLabel(theme: NexusTheme, locale: "en" | "ar") {
  return THEME_LABELS[theme][locale];
}

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { locale, t } = useLocale();

  return (
    <div className={compact ? "min-w-0" : "w-full"}>
      {!compact && (
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Palette className="size-3.5 text-accent" />
          {t("appearance")}
        </div>
      )}
      <div
        className={
          compact
            ? "flex min-w-0 items-center gap-1 rounded-md border border-border bg-surface/70 p-1"
            : "grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
        }
        role="radiogroup"
        aria-label={t("theme")}
      >
        {NEXUS_THEMES.map((option) => {
          const selected = theme === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option)}
              className={
                compact
                  ? `flex min-h-[36px] min-w-[44px] items-center justify-center rounded px-2 text-[11px] font-medium transition-colors ${
                      selected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
                  : `flex min-h-[44px] items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "border-accent/40 bg-accent/10 text-foreground"
                        : "border-border bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`
              }
              title={themeLabel(option, locale)}
            >
              <span className={compact ? "truncate" : "min-w-0 truncate"}>
                {compact ? themeLabel(option, locale).split(" ")[0] : themeLabel(option, locale)}
              </span>
              {!compact && selected && <Check className="size-4 shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
