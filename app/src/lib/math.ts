// Safe arithmetic evaluator for Spotlight math queries
export function calc(expr: string): number | null {
  const s = expr.trim().replace(/\^/g, "**");
  if (!s || !/^[0-9.+\-*/%()* ]+$/.test(s)) return null;
  try {
    const val = Function(`"use strict"; return (${s})`)();
    return typeof val === "number" && Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export const fmtNum = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString() : parseFloat(n.toPrecision(12)).toLocaleString();
