import { Languages } from "lucide-react";
import { useLocale } from "./localeContext";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      dir="ltr"
      className="flex min-h-[44px] items-center gap-1 rounded-md border border-border bg-background/50 p-1"
      role="group"
      aria-label={t("language")}
    >
      <Languages className="mx-1 size-3.5 text-muted-foreground" aria-hidden="true" />
      {(["en", "ar"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          aria-label={option === "en" ? t("switchToEnglish") : t("switchToArabic")}
          className={`min-h-[40px] rounded px-4 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
            locale === option
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-white/5"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
