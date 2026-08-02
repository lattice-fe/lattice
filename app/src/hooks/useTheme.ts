import { useCallback, useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Theme } from "../lib/theme/types";
import { applyTheme } from "../lib/theme/engine";
import { BUILTIN_THEMES, DEFAULT_THEME } from "../lib/theme/themes";
import { normalizeTheme } from "../lib/theme/validate";
import { isTauri } from "../lib/api";

/** Event carrying the full active theme to every window (e.g. the Spotlight). */
export const THEME_EVENT = "theme:changed";
const ACTIVE_KEY = "lattice.theme";
const CUSTOM_KEY = "lattice.themes";

const BUILTIN_IDS = new Set(BUILTIN_THEMES.map((t) => t.id));

function loadCustom(): Theme[] {
  try {
    const s = localStorage.getItem(CUSTOM_KEY);
    if (!s) return [];
    return (JSON.parse(s) as unknown[]).flatMap((t) => {
      try { return [normalizeTheme(t)]; } catch { return []; }
    });
  } catch { return []; }
}
function persistCustom(list: Theme[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function resolve(id: string | null, custom: Theme[]): Theme {
  return [...BUILTIN_THEMES, ...custom].find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** The theme to use on load (persisted active id → default). */
export function initialTheme(): Theme {
  try { return resolve(localStorage.getItem(ACTIVE_KEY), loadCustom()); } catch { return DEFAULT_THEME; }
}

export interface ThemeApi {
  theme: Theme;
  themes: Theme[];
  isBuiltin: (id: string) => boolean;
  setTheme: (id: string) => void;
  saveTheme: (theme: Theme) => void;
  deleteTheme: (id: string) => void;
  applyPreview: (theme: Theme) => void; // live-apply without persisting/selecting
}

export function useTheme(): ThemeApi {
  const [custom, setCustom] = useState<Theme[]>(loadCustom);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const themes = [...BUILTIN_THEMES, ...custom];

  useEffect(() => { applyTheme(theme); }, []); // ensure applied on mount

  const activate = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem(ACTIVE_KEY, t.id); } catch { /* ignore */ }
    if (isTauri) emit(THEME_EVENT, t).catch(() => {}); // sync other windows
  }, []);

  const setTheme = useCallback((id: string) => { activate(resolve(id, custom)); }, [custom, activate]);

  const saveTheme = useCallback((t: Theme) => {
    setCustom((prev) => {
      const next = prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
      persistCustom(next);
      return next;
    });
    activate(t);
  }, [activate]);

  const deleteTheme = useCallback((id: string) => {
    setCustom((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persistCustom(next);
      return next;
    });
    setThemeState((cur) => {
      if (cur.id === id) { activate(DEFAULT_THEME); return DEFAULT_THEME; }
      return cur;
    });
  }, [activate]);

  const applyPreview = useCallback((t: Theme) => { applyTheme(t); }, []);

  return {
    theme, themes,
    isBuiltin: (id) => BUILTIN_IDS.has(id),
    setTheme, saveTheme, deleteTheme, applyPreview,
  };
}
