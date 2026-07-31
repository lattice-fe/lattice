// Tiny safe arithmetic evaluator (recursive descent — no eval).
// Supports + - * / % ^, parentheses, and unary minus.
export function calc(expr: string): number | null {
  const s = expr.replace(/\s+/g, "");
  if (!s || !/^[0-9.+\-*/%^()]+$/.test(s)) return null;
  let i = 0;
  const peek = () => s[i];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") { const op = s[i++]; const r = parseTerm(); v = op === "+" ? v + r : v - r; }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") { const op = s[i++]; const r = parseFactor(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; }
    return v;
  }
  function parseFactor(): number {
    const v = parseUnary();
    if (peek() === "^") { i++; return Math.pow(v, parseFactor()); }
    return v;
  }
  function parseUnary(): number {
    if (peek() === "-") { i++; return -parseUnary(); }
    if (peek() === "+") { i++; return parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary(): number {
    if (peek() === "(") { i++; const v = parseExpr(); if (peek() !== ")") throw new Error("paren"); i++; return v; }
    let num = "";
    while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
    if (!num) throw new Error("num");
    return parseFloat(num);
  }

  try {
    const v = parseExpr();
    if (i !== s.length) return null;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export const fmtNum = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString() : parseFloat(n.toPrecision(12)).toLocaleString();
