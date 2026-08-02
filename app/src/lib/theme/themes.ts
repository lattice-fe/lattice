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

// Slate — a cool dark theme with slate blue accents. More neutral and professional.
export const SLATE: Theme = {
  id: "slate",
  name: "Slate",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#1f2329",
    surface: "#2b313b",
    surfaceHover: "#363c47",
    border: "#3d4551",
    text: "#e5e9f0",
    textDim: "#9aa5b1",
    accent: "#6c7a89",
    accent2: "#8f9bb3",
    accent3: "#5f8a87",
    danger: "#c0392b",
  },
  radius: 11,
  effects: { glow: "#5f8a87", glowStrength: 0.03, shadowStrength: 0.65 },
  tiles: {
    rust: { bg: "#2b2320", fg: "#8d6e63" },
    amber: { bg: "#2e2820", fg: "#ffb74d" },
    green: { bg: "#202623", fg: "#81c784" },
    violet: { bg: "#26212d", fg: "#b39ddb" },
    red: { bg: "#2e1f21", fg: "#e57373" },
    neutral: { bg: "#2a2422", fg: "#a0a0a0" },
  },
};

// Copper — a warm copper/orange dark theme. Rich metallic tones.
export const COPPER: Theme = {
  id: "copper",
  name: "Copper",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#2d2119",
    surface: "#3d2d22",
    surfaceHover: "#4a3a2d",
    border: "#5a493a",
    text: "#f1e6d6",
    textDim: "#b89b7c",
    accent: "#c77c48",
    accent2: "#d48c5a",
    accent3: "#a08058",
    danger: "#b85c4a",
  },
  radius: 11,
  effects: { glow: "#c77c48", glowStrength: 0.04, shadowStrength: 0.7 },
  tiles: {
    rust: { bg: "#3d2d22", fg: "#e0a070" },
    amber: { bg: "#423426", fg: "#ffcc80" },
    green: { bg: "#28312b", fg: "#a5d6a7" },
    violet: { bg: "#342a39", fg: "#ce93d8" },
    red: { bg: "#3d2626", fg: "#e57373" },
    neutral: { bg: "#3b312b", fg: "#c7b090" },
  },
};

// Forest — a deep green dark theme. Natural, earthy tones.
export const FOREST: Theme = {
  id: "forest",
  name: "Forest",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#1a211d",
    surface: "#232d28",
    surfaceHover: "#2d3b35",
    border: "#364942",
    text: "#e0e9e0",
    textDim: "#9ca9a0",
    accent: "#7a9a7a",
    accent2: "#8bb08b",
    accent3: "#6b8a6b",
    danger: "#b85c4a",
  },
  radius: 11,
  effects: { glow: "#7a9a7a", glowStrength: 0.03, shadowStrength: 0.6 },
  tiles: {
    rust: { bg: "#2d2420", fg: "#d7ccc8" },
    amber: { bg: "#312d20", fg: "#ffecb3" },
    green: { bg: "#202d28", fg: "#a5d6a7" },
    violet: { bg: "#282431", fg: "#e1bee7" },
    red: { bg: "#2d2022", fg: "#e57373" },
    neutral: { bg: "#2a312d", fg: "#b0beb5" },
  },
};

// Midnight — a deep dark theme with subtle violet accents. For late-night work.
export const MIDNIGHT: Theme = {
  id: "midnight",
  name: "Midnight",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#0f1115",
    surface: "#1a1d24",
    surfaceHover: "#242832",
    border: "#2d323d",
    text: "#d0d5dc",
    textDim: "#8b94a0",
    accent: "#5a6b9a",
    accent2: "#6b7bb3",
    accent3: "#4a5b8a",
    danger: "#c0392b",
  },
  radius: 11,
  effects: { glow: "#5a6b9a", glowStrength: 0.025, shadowStrength: 0.75 },
  tiles: {
    rust: { bg: "#241d20", fg: "#bcaaa4" },
    amber: { bg: "#2a2420", fg: "#d7ccc8" },
    green: { bg: "#1d2422", fg: "#b0bec5" },
    violet: { bg: "#221d28", fg: "#d1c4e9" },
    red: { bg: "#2a1d20", fg: "#e57373" },
    neutral: { bg: "#222028", fg: "#a0a0a0" },
  },
};

// Canvas — a neutral off-white light theme. Clean and minimal.
export const CANVAS: Theme = {
  id: "canvas",
  name: "Canvas",
  author: "Lattice",
  appearance: "light",
  tokens: {
    bg: "#faf7f2",
    surface: "#f0eadd",
    surfaceHover: "#e6dec1",
    border: "#d7c9b0",
    text: "#2a241e",
    textDim: "#6d6355",
    accent: "#a07550",
    accent2: "#b08560",
    accent3: "#7a8a70",
    danger: "#b23320",
  },
  radius: 11,
  effects: { glow: "#a07550", glowStrength: 0.04, shadowStrength: 0.12 },
  tiles: {
    rust: { bg: "#efe2d6", fg: "#a07550" },
    amber: { bg: "#f2eadd", fg: "#b08560" },
    green: { bg: "#e0eadd", fg: "#7a8a70" },
    violet: { bg: "#eaddf0", fg: "#8a7a9a" },
    red: { bg: "#f2d6d6", fg: "#b23320" },
    neutral: { bg: "#eaddde", fg: "#6d6355" },
  },
};

// Ash — a cool gray theme. Modern and understated.
export const ASH: Theme = {
  id: "ash",
  name: "Ash",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#1c1d21",
    surface: "#282a2f",
    surfaceHover: "#33353b",
    border: "#3d4049",
    text: "#d0d3d9",
    textDim: "#8b8e96",
    accent: "#6e7a89",
    accent2: "#7e8a99",
    accent3: "#5e6a79",
    danger: "#c0392b",
  },
  radius: 11,
  effects: { glow: "#6e7a89", glowStrength: 0.02, shadowStrength: 0.6 },
  tiles: {
    rust: { bg: "#2a2522", fg: "#bcaaa4" },
    amber: { bg: "#2d2a22", fg: "#d7ccc8" },
    green: { bg: "#222a28", fg: "#b0bec5" },
    violet: { bg: "#2a252d", fg: "#d1c4e9" },
    red: { bg: "#2d2225", fg: "#e57373" },
    neutral: { bg: "#2a2a2d", fg: "#a0a0a0" },
  },
};

// Amber — a warm amber theme with golden accents. Cozy and inviting.
export const AMBER: Theme = {
  id: "amber",
  name: "Amber",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#241e17",
    surface: "#312a20",
    surfaceHover: "#3e362b",
    border: "#4f473a",
    text: "#f1e6d6",
    textDim: "#b89b7c",
    accent: "#c78c48",
    accent2: "#d49c5a",
    accent3: "#a07058",
    danger: "#b85c4a",
  },
  radius: 11,
  effects: { glow: "#c78c48", glowStrength: 0.04, shadowStrength: 0.7 },
  tiles: {
    rust: { bg: "#3d2d22", fg: "#e0a070" },
    amber: { bg: "#423426", fg: "#ffcc80" },
    green: { bg: "#28312b", fg: "#a5d6a7" },
    violet: { bg: "#342a39", fg: "#ce93d8" },
    red: { bg: "#3d2626", fg: "#e57373" },
    neutral: { bg: "#3b312b", fg: "#c7b090" },
  },
};

// Graphite — a sleek black theme with subtle contrast. Minimalist and modern.
export const GRAPHITE: Theme = {
  id: "graphite",
  name: "Graphite",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#121212",
    surface: "#1e1e1e",
    surfaceHover: "#2a2a2a",
    border: "#333333",
    text: "#e0e0e0",
    textDim: "#9e9e9e",
    accent: "#5f6b78",
    accent2: "#6b7b89",
    accent3: "#4f5b68",
    danger: "#c0392b",
  },
  radius: 11,
  effects: { glow: "#5f6b78", glowStrength: 0.02, shadowStrength: 0.8 },
  tiles: {
    rust: { bg: "#2a1f1a", fg: "#bcaaa4" },
    amber: { bg: "#2e261a", fg: "#d7ccc8" },
    green: { bg: "#1a2622", fg: "#b0bec5" },
    violet: { bg: "#221a28", fg: "#d1c4e9" },
    red: { bg: "#2e1a20", fg: "#e57373" },
    neutral: { bg: "#26201a", fg: "#a0a0a0" },
  },
};

// Sepia — a warm复古 theme. Yellow-brown tones for a nostalgic look.
export const SEPIA: Theme = {
  id: "sepia",
  name: "Sepia",
  author: "Lattice",
  appearance: "dark",
  tokens: {
    bg: "#2d2720",
    surface: "#3d352b",
    surfaceHover: "#4a4136",
    border: "#5a4e40",
    text: "#f0e6d6",
    textDim: "#b8a99c",
    accent: "#a07c58",
    accent2: "#b08c68",
    accent3: "#8a6c48",
    danger: "#b85c4a",
  },
  radius: 11,
  effects: { glow: "#a07c58", glowStrength: 0.035, shadowStrength: 0.65 },
  tiles: {
    rust: { bg: "#3d3126", fg: "#d7ccc8" },
    amber: { bg: "#423a26", fg: "#ffecb3" },
    green: { bg: "#2b3631", fg: "#b0bec5" },
    violet: { bg: "#36313d", fg: "#e1bee7" },
    red: { bg: "#3d2b2d", fg: "#e57373" },
    neutral: { bg: "#3a3631", fg: "#c7b090" },
  },
};

export const BUILTIN_THEMES: Theme[] = [INK, PAPER, SLATE, COPPER, FOREST, MIDNIGHT, CANVAS, ASH, AMBER, GRAPHITE, SEPIA];

export function themeById(id: string): Theme | undefined {
  return BUILTIN_THEMES.find((t) => t.id === id);
}

export const DEFAULT_THEME = INK;
