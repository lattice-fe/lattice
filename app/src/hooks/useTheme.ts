import { useCallback, useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Theme } from "../lib/theme/types";
import { applyTheme } from "../lib/theme/engine";
import { BUILTIN_THEMES, DEFAULT_THEME, themeById } from "../lib/theme/themes";
import { isTauri } from "../lib/api";

/** Event broadcast to every window when the theme changes. */
export const THEME_EVENT = "theme:changed";

const STORAGE_KEY = "lattice.theme";

/** Resolve the theme to use on load (persisted choice → default). */
export function initialTheme(): Theme {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) return themeById(id) ?? DEFAULT_THEME;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

export interface ThemeApi {
  theme: Theme;
  themes: Theme[];
  setTheme: (id: string) => void;
}

export function useTheme(): ThemeApi {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((id: string) => {
    const next = themeById(id) ?? DEFAULT_THEME;
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next.id); } catch { /* ignore */ }
    if (isTauri) emit(THEME_EVENT, next.id).catch(() => {}); // sync other windows (e.g. spotlight)
  }, []);

  return { theme, themes: BUILTIN_THEMES, setTheme };
}
