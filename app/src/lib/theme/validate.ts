import { Theme, ThemeTokens } from "./types";

const REQUIRED: (keyof ThemeTokens)[] = [
  "bg", "surface", "border", "text", "textDim", "accent", "accent2", "accent3", "danger",
];
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validate + normalize an untrusted theme object (from import or storage).
 * Throws with a friendly message on invalid input. `newId` forces a fresh id
 * (used on import so a shared theme can't clobber a built-in).
 */
export function normalizeTheme(raw: unknown, opts?: { newId?: boolean }): Theme {
  if (!raw || typeof raw !== "object") throw new Error("Not a theme object.");
  const r = raw as Record<string, unknown>;
  const tokens = r.tokens as Record<string, unknown> | undefined;
  if (!tokens || typeof tokens !== "object") throw new Error("Missing `tokens`.");
  for (const k of REQUIRED) {
    const v = tokens[k];
    if (typeof v !== "string" || !HEX.test(v.trim())) throw new Error(`Invalid colour for "${k}".`);
  }
  const t = tokens as unknown as ThemeTokens;
  const id = opts?.newId || typeof r.id !== "string" ? `custom-${Date.now()}` : (r.id as string);
  return {
    id,
    name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Custom",
    author: typeof r.author === "string" ? r.author : undefined,
    appearance: r.appearance === "light" ? "light" : "dark",
    tokens: {
      bg: t.bg, surface: t.surface, surfaceHover: t.surfaceHover,
      border: t.border, text: t.text, textDim: t.textDim,
      accent: t.accent, accent2: t.accent2, accent3: t.accent3, danger: t.danger,
    },
    fonts: r.fonts as Theme["fonts"],
    radius: typeof r.radius === "number" ? r.radius : undefined,
    effects: r.effects as Theme["effects"],
    tiles: r.tiles as Theme["tiles"],
  };
}

export function parseThemeJson(text: string): Theme {
  return normalizeTheme(JSON.parse(text), { newId: true });
}

/** A clean, shareable JSON string for a theme (drops the internal id). */
export function themeToJson(theme: Theme): string {
  const { id: _id, ...rest } = theme;
  return JSON.stringify(rest, null, 2);
}
