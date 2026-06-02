import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const NEXUS_THEMES = ["matte-black", "deep-black", "light-beige"] as const;

export type NexusTheme = (typeof NEXUS_THEMES)[number];

const STORAGE_KEY = "nexus-theme";
const DEFAULT_THEME: NexusTheme = "matte-black";

interface ThemeContextValue {
  theme: NexusTheme;
  setTheme: (theme: NexusTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isNexusTheme(value: string | null): value is NexusTheme {
  return NEXUS_THEMES.some((theme) => theme === value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<NexusTheme>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme = isNexusTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("light", nextTheme === "light-beige");
    document.documentElement.classList.toggle("dark", nextTheme !== "light-beige");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("light", theme === "light-beige");
    document.documentElement.classList.toggle("dark", theme !== "light-beige");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [hydrated, theme]);

  const setTheme = useCallback((nextTheme: NexusTheme) => {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("light", nextTheme === "light-beige");
    document.documentElement.classList.toggle("dark", nextTheme !== "light-beige");
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
