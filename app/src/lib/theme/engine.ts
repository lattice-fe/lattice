import { Theme, Tone } from "./types";
import { mix, alpha } from "./color";

// Fallback hues for each file-tile tone (tuned for dark surfaces; lightened
// automatically for light themes). Only used when a theme doesn't specify tiles.
const TONE_HUE: Record<Tone, string> = {
  rust: "#d8794a", amber: "#e2a64c", green: "#9db98a",
  violet: "#b199d6", red: "#cf6f5b", neutral: "#a99f8e",
};
const TONES: Tone[] = ["rust", "amber", "green", "violet", "red", "neutral"];

const DEFAULT_FONTS = {
  ui: '"Inter", system-ui, sans-serif',
  display: '"IBM Plex Sans", inter, serif',
  mono: '"JetBrains Mono", monospace',
};

/**
 * Compile a theme (seed) into the full set of CSS custom properties the app
 * uses. This is the "derived" half of the hybrid model: authors set a handful
 * of tokens, everything in-between is mixed from them.
 */
export function themeVars(theme: Theme): Record<string, string> {
  const t = theme.tokens;
  const dark = theme.appearance === "dark";
  const surfaceHover = t.surfaceHover ?? mix(t.surface, t.text, 0.06);
  const fonts = { ...DEFAULT_FONTS, ...theme.fonts };
  const radius = theme.radius ?? 11;
  const glow = theme.effects?.glow ?? t.accent2;
  const glowStrength = theme.effects?.glowStrength ?? (dark ? 0.035 : 0.05);
  const shadowStrength = theme.effects?.shadowStrength ?? (dark ? 0.7 : 0.16);

  const vars: Record<string, string> = {
    // surfaces
    "--ink": t.bg,
    "--ink-2": mix(t.bg, t.surface, 0.5),
    "--ink-3": mix(t.bg, t.surface, 0.22),
    "--card": t.surface,
    "--card-hi": surfaceHover,
    // borders
    "--border": t.border,
    "--border-soft": mix(t.border, t.bg, 0.45),
    // text
    "--paper": t.text,
    "--paper-dim": mix(t.text, t.textDim, 0.5),
    "--dim": t.textDim,
    "--dim-2": mix(t.textDim, t.bg, 0.4),
    // accents
    "--terracotta": t.accent,
    "--amber": t.accent2,
    "--teal": t.accent3,
    "--danger": t.danger,
    // effects
    "--shadow": `0 18px 50px -24px ${alpha("#000000", shadowStrength)}`,
    "--shadow-soft": `0 8px 24px -14px ${alpha("#000000", shadowStrength * 0.82)}`,
    "--glow": alpha(glow, glowStrength),
    // spotlight surface (translucent, blurred). Light themes wash out over a
    // light desktop, so they get a more opaque fill, a stronger border, and a
    // faint inner ring; dark themes keep a soft top highlight.
    "--spot-bg": alpha(t.bg, dark ? 0.82 : 0.9),
    "--spot-border": alpha(t.text, dark ? 0.1 : 0.18),
    "--spot-inset": dark
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.045)"
      : "inset 0 0 0 1px rgba(0, 0, 0, 0.05)",
    // shape
    "--radius": `${radius}px`,
    "--radius-sm": `${Math.max(4, radius - 4)}px`,
    "--radius-lg": `${radius + 2}px`,
    // fonts
    "--serif": fonts.display!,
    "--sans": fonts.ui!,
    "--mono": fonts.mono!,
  };

  // file-tile tones
  for (const tone of TONES) {
    const explicit = theme.tiles?.[tone];
    let bg: string, fg: string;
    if (explicit) {
      bg = explicit.bg; fg = explicit.fg;
    } else {
      const hue = TONE_HUE[tone];
      fg = dark ? hue : mix(hue, t.text, 0.42);
      bg = mix(t.bg, fg, 0.14);
    }
    vars[`--tile-${tone}-bg`] = bg;
    vars[`--tile-${tone}-fg`] = fg;
  }
  return vars;
}

/** Apply a theme to the document by writing its compiled vars onto :root. */
export function applyTheme(theme: Theme): void {
  const vars = themeVars(theme);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute("data-appearance", theme.appearance);
  root.style.colorScheme = theme.appearance;
}
