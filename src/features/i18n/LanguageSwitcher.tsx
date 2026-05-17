import { Languages } from "lucide-react";
import { useLocale } from "./localeContext";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background/50 p-1">
      <Languages className="mx-1 size-3.5 text-muted-foreground" />
      {(["en", "ar"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            locale === option
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:bg-white/5"
          }`}
          aria-label={option === "en" ? t("english") : t("arabic")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
