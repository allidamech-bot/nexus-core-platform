import { Check, Palette } from "lucide-react";
import { useLocale } from "@/features/i18n/localeContext";
import { NEXUS_THEMES, type NexusTheme, useTheme } from "./themeContext";

const THEME_LABELS: Record<NexusTheme, { en: string; ar: string; shortAr: string }> = {
  "matte-black": {
    en: "Matte Black",
    ar: "أسود مطفي",
    shortAr: "مطفي",
  },
  "deep-black": {
    en: "Deep Black",
    ar: "أسود عميق",
    shortAr: "عميق",
  },
  "light-beige": {
    en: "Light Beige",
    ar: "فاتح بيج",
    shortAr: "فاتح",
  },
};

export function themeLabel(theme: NexusTheme, locale: "en" | "ar", short: boolean = false) {
  if (locale === "ar" && short) return THEME_LABELS[theme].shortAr;
  return short ? THEME_LABELS[theme].en.split(" ")[0] : THEME_LABELS[theme][locale];
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
                  ? `flex min-h-[44px] min-w-[44px] items-center justify-center rounded px-2 text-[11px] font-medium transition-colors ${
                      selected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
                  : `flex min-h-[48px] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      selected
                        ? "border-accent/40 bg-accent/10 text-foreground"
                        : "border-border bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`
              }
              title={themeLabel(option, locale)}
            >
              <span className={compact ? "truncate" : "min-w-0 truncate"}>
                {themeLabel(option, locale, compact)}
              </span>
              {!compact && selected && <Check className="size-4 shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
