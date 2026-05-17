import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LocaleContext, type LocaleContextValue } from "./localeContext";
import { translations, type Locale } from "./translations";
const STORAGE_KEY = "nexus-locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.classList.toggle("rtl", dir === "rtl");
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [dir, locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir,
      setLocale: setLocaleState,
      t: (key, values) => {
        let text: string = translations[locale][key] ?? translations.en[key] ?? key;
        if (values) {
          for (const [name, value] of Object.entries(values)) {
            text = text.replace(`{${name}}`, String(value));
          }
        }
        return text;
      },
    }),
    [dir, locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
