// The Lattice theme schema — the public contract for bring-your-own-themes.
//
// A theme is a small *seed*: authors set the core palette plus whichever
// optional groups they care about; the engine (engine.ts) derives every other
// shade the UI needs. Every field except the core `tokens` is optional and
// falls back to the active base theme, so partial themes are valid.

export type Hex = string; // "#rgb" or "#rrggbb"

/** File-category tile hues (the coloured icon chips). */
export type Tone = "rust" | "amber" | "green" | "violet" | "red" | "neutral";

export interface ThemeTokens {
  // Surfaces
  bg: Hex;            // app background
  surface: Hex;      // cards / panels / menus
  surfaceHover?: Hex; // hover / active surface (derived if omitted)
  // Borders
  border: Hex;
  // Text
  text: Hex;         // primary
  textDim: Hex;      // secondary
  // Accents
  accent: Hex;       // primary / brand
  accent2: Hex;      // secondary
  accent3: Hex;      // tertiary
  // Semantic
  danger: Hex;       // destructive actions, close-button hover
}

export interface ThemeFonts {
  ui?: string;       // body / controls
  display?: string;  // hero headings
  mono?: string;     // code, paths, numbers
}

export interface ThemeEffects {
  glow?: Hex;            // ambient top-of-window wash
  glowStrength?: number; // 0–1 alpha of that wash
  shadowStrength?: number; // 0–1 alpha of drop shadows
}

export interface Theme {
  id: string;
  name: string;
  author?: string;
  appearance: "dark" | "light";
  tokens: ThemeTokens;
  fonts?: ThemeFonts;               // Typography group
  radius?: number;                  // Shape group — base corner radius (px)
  effects?: ThemeEffects;           // Effects group
  tiles?: Partial<Record<Tone, { bg: Hex; fg: Hex }>>; // File-tile group
}

/** File kind → tile tone (the mapping the UI uses). */
export const KIND_TONE: Record<string, Tone> = {
  folder: "amber",
  archive: "amber",
  code: "rust",
  image: "green",
  audio: "violet",
  video: "red",
  executable: "red",
  document: "neutral",
  other: "neutral",
};
