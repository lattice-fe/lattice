// Minimal colour helpers for deriving theme tokens from a seed palette.
// All inputs are #rgb / #rrggbb hex; mixing is done in sRGB (good enough for UI
// shades and keeps themes predictable for authors).

export interface RGB { r: number; g: number; b: number; }

export function parseHex(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function toHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
}

/** Linear sRGB blend: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a), y = parseHex(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** Hex → rgba() string with the given alpha. */
export function alpha(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Perceived luminance in [0,1] — used to pick a readable foreground. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** True when the colour is dark enough to want light text on top. */
export function isDark(hex: string): boolean {
  return luminance(hex) < 0.5;
}
