import { Theme } from "./types";

// Ink — the original warm-dark theme, expressed in the schema (values lifted
// from the old hardcoded :root so the look is preserved exactly).
export const INK: Theme = {
  id: "ink",
  name: "Ink",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#1a1815",
    surface: "#24211c",
    surfaceHover: "#2a251f",
    border: "#322c25",
    text: "#f4eee2",
    textDim: "#9a917f",
    accent: "#c05f3c",
    accent2: "#e2a64c",
    accent3: "#4f9a8a",
    danger: "#c0392b",
  },
  radius: 11,
  effects: { glow: "#e0a64c", glowStrength: 0.035, shadowStrength: 0.7 },
  tiles: {
    rust: { bg: "#331f14", fg: "#d8794a" },
    amber: { bg: "#33260f", fg: "#e2a64c" },
    green: { bg: "#22271f", fg: "#9db98a" },
    violet: { bg: "#282132", fg: "#b199d6" },
    red: { bg: "#301c1a", fg: "#cf6f5b" },
    neutral: { bg: "#26221d", fg: "#a99f8e" },
  },
};

// Paper — a warm light theme. Cards/hover are a touch darker than the page so
// the same "surface = hover" pattern reads on a light background.
export const PAPER: Theme = {
  id: "paper",
  name: "Paper",
  author: "Lattice",
  appearance: "light",
  tokens: {
    bg: "#f4eee2",
    surface: "#e7ddca",
    surfaceHover: "#dcceb4",
    border: "#d7c9b0",
    text: "#241f18",
    textDim: "#7c7360",
    accent: "#b6542e",
    accent2: "#b97e28",
    accent3: "#3c8072",
    danger: "#b23320",
  },
  radius: 11,
  effects: { glow: "#d69a3e", glowStrength: 0.05, shadowStrength: 0.15 },
  tiles: {
    rust: { bg: "#f0ddd0", fg: "#b6542e" },
    amber: { bg: "#f1e6c9", fg: "#9c7220" },
    green: { bg: "#e0e8d6", fg: "#5e7d47" },
    violet: { bg: "#e7e0f0", fg: "#6f589c" },
    red: { bg: "#f1dbd3", fg: "#b04f30" },
    neutral: { bg: "#e7e0d3", fg: "#6d6455" },
  },
};

export const BUILTIN_THEMES: Theme[] = [INK, PAPER];

export function themeById(id: string): Theme | undefined {
  return BUILTIN_THEMES.find((t) => t.id === id);
}

export const DEFAULT_THEME = INK;
