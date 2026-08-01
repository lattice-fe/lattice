// highlight.js "common" bundle: ~40 popular languages (rust, ts/js, python,
// go, java, c/cpp, json, yaml, css, sql, bash, …) — much smaller than the full
// set. highlight.js registers ext aliases ("rs" → rust, "py" → python, …), so
// the file extension usually resolves a language directly.
import hljs from "highlight.js/lib/common";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Highlight `text` for the given extension. Returns HTML safe to inject (both
 * highlight.js and the escape fallback escape the source). We only highlight
 * when the extension maps to a known grammar, so prose/logs stay plain instead
 * of being mis-guessed by auto-detection.
 */
export function highlightCode(text: string, ext: string): { html: string; highlighted: boolean } {
  if (ext && hljs.getLanguage(ext)) {
    try {
      const html = hljs.highlight(text, { language: ext, ignoreIllegals: true }).value;
      return { html, highlighted: true };
    } catch {
      /* fall through to plain */
    }
  }
  return { html: escapeHtml(text), highlighted: false };
}
