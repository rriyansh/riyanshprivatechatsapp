import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { AccentKey, applyAccent } from "@/lib/accentThemes";

export type ThemePref = "light" | "dark" | "system";

type ThemeContextValue = {
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const LS_THEME = "pc.theme";
const LS_ACCENT = "pc.accent";

const readLS = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (v as unknown as T) : fallback;
  } catch {
    return fallback;
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themePref, setThemePrefState] = useState<ThemePref>(() =>
    readLS<ThemePref>(LS_THEME, "system")
  );
  const [accent, setAccentState] = useState<AccentKey>(() =>
    readLS<AccentKey>(LS_ACCENT, "blue")
  );
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  // Track OS dark-mode changes
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const isDark = themePref === "dark" || (themePref === "system" && systemDark);

  // Toggle .dark on <html>, then re-apply accent (needs to know light/dark)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    applyAccent(accent, isDark, root);
  }, [isDark, accent]);

  const setThemePref = (t: ThemePref) => {
    setThemePrefState(t);
    try {
      localStorage.setItem(LS_THEME, t);
    } catch {
      /* ignore */
    }
  };

  const setAccent = (a: AccentKey) => {
    setAccentState(a);
    try {
      localStorage.setItem(LS_ACCENT, a);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo(
    () => ({ themePref, setThemePref, accent, setAccent, isDark }),
    [themePref, accent, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
