import { ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Entry, api, isTauri } from "../lib/api";
import { Glyph, TONE } from "../lib/icons";
import { extOf } from "../lib/preview/registry";
import { highlightCode } from "../lib/preview/highlight";

type Peek = { type: "img"; src: string } | { type: "code"; html: string } | { type: "md"; html: string } | null;

// Extensions that should show code previews even if backend classifies them as "other"
const PREVIEW_EXTS = new Set([
  "js", "ts", "jsx", "tsx", "mjs", "cjs", "json", "yaml", "yml", "toml",
  "ini", "cfg", "conf", "log", "gitignore", "env", "dockerfile", "makefile",
  "sh", "bash", "zsh", "py", "rb", "php", "java", "c", "cpp", "h", "hpp",
  "rs", "go", "swift", "kt", "lua", "r", "scala", "pl", "pm", "vim",
  "css", "scss", "sass", "less", "styl", "html", "htm", "xml", "svg",
  "sql", "graphql", "prisma", "proto", "ex", "exs", "erl", "hrl"
]);

// Config/dotfiles that should use 1x1 sizing instead of 2x1
const CONFIG_FILE_PATTERNS = new Set([
  ".gitignore", ".dockerignore", ".env", ".gitattributes", ".editorconfig",
  ".prettierrc", ".eslintrc", ".babelrc", "dockerfile", "makefile",
  ".npmrc", ".yarnrc", ".nvmrc", "package.json", "package-lock.json",
  "tsconfig.json", "next.config.js", "next.config.ts", "tailwind.config.js",
  "tailwind.config.ts", "postcss.config.js", "webpack.config.js"
]);

// Sensitive files that should be blurred for screen recording safety
const SENSITIVE_FILE_PATTERNS = new Set([
  ".env", ".env.local", ".env.development", ".env.production", ".env.staging",
  ".env.test", ".credentials", ".secrets", "credentials.json", "secrets.json"
]);

// Non-sensitive env variants (example templates, samples)
const NON_SENSITIVE_ENV_PATTERNS = new Set([
  ".env.example", ".env.sample", ".env.template"
]);

// Check if a file is a config/dotfile (should use 1x1 sizing)
function isConfigDotfile(e: Entry): boolean {
  if (e.is_dir || e.kind !== "code") return false;
  const name = e.name.toLowerCase();
  return CONFIG_FILE_PATTERNS.has(name) || name.startsWith(".env.");
}

// Sensitive preview settings (localStorage keys)
const NEVER_BLUR_KEY = "lattice:never-blur";
const NEVER_UNBLUR_KEY = "lattice:never-unblur";
const BLUR_PATTERNS_KEY = "lattice:blur-patterns";

// Read settings from localStorage
function getNeverBlur(): boolean {
  try { return localStorage.getItem(NEVER_BLUR_KEY) === "true"; }
  catch { return false; }
}

function getNeverUnblur(): boolean {
  try { return localStorage.getItem(NEVER_UNBLUR_KEY) === "true"; }
  catch { return false; }
}

function getBlurPatterns(): string[] {
  try {
    const patterns = localStorage.getItem(BLUR_PATTERNS_KEY) || "";
    return patterns.split(",").map(p => p.trim()).filter(p => p.length > 0);
  }
  catch { return []; }
}

// Check if a file matches any blur pattern (regex or substring)
function matchesBlurPattern(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    try {
      // Try to parse as regex first
      const regex = new RegExp(pattern, "i");
      if (regex.test(name)) return true;
    }
    catch {
      // If not a valid regex, do case-insensitive substring match
      if (name.toLowerCase().includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

// Check if a file contains sensitive data (should be blurred)
function isSensitiveFile(e: Entry): boolean {
  if (e.is_dir) return false;
  const name = e.name.toLowerCase();
  const neverBlur = getNeverBlur();
  // const neverUnblur = getNeverUnblur();
  const blurPatterns = getBlurPatterns();

  // Never blur: no sensitive files are blurred
  if (neverBlur) return false;

  // Exclude non-sensitive patterns first
  if (NON_SENSITIVE_ENV_PATTERNS.has(name)) return false;

  // Match specific sensitive patterns
  if (SENSITIVE_FILE_PATTERNS.has(name)) return true;
  // Match .env.* variants (but not .env.example, .env.sample, etc.)
  if (name.startsWith(".env.") && !NON_SENSITIVE_ENV_PATTERNS.has(name)) return true;

  // Match custom patterns
  if (matchesBlurPattern(name, blurPatterns)) return true;

  return false;
}

// Get blur behavior settings
function getBlurBehavior(): { neverUnblur: boolean } {
  return { neverUnblur: getNeverUnblur() };
}

// What kind of rich preview (if any) a card should lazily load.
function peekKind(e: Entry): "img" | "code" | "md" | null {
  if (e.is_dir) return null;
  if (e.kind === "image") return "img";
  const ext = extOf(e.name);
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "md";
  if (e.kind === "code" || e.kind === "document" || PREVIEW_EXTS.has(ext)) return "code";
  return null;
}

// A rich, content-adaptive tile for the Cards view. The preview (thumbnail or
// code peek) is loaded lazily — only once the card scrolls near the viewport —
// so a folder of hundreds of files doesn't read/decode everything up front.
export function FileCard({
  e, selected, intersecting = false, interact, children,
}: {
  e: Entry;
  selected: boolean;
  intersecting?: boolean;
  interact: React.HTMLAttributes<HTMLButtonElement>;
  children: ReactNode; // label or rename field
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false);
  const [peek, setPeek] = useState<Peek>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect(); } },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    const kind = peekKind(e);
    if (kind === "img") { setPeek({ type: "img", src: isTauri ? convertFileSrc(e.path) : e.path }); return; }
    if (kind === "md" || kind === "code") {
      let cancelled = false;
      api.previewFile(e.path)
        .then((p) => {
          if (cancelled) return;
          if (kind === "md") {
            // For MD files, render with ReactMarkdown
            setPeek({ type: "md", html: p.text });
          } else {
            setPeek({ type: "code", html: highlightCode(p.text, extOf(e.name)).html });
          }
        })
        .catch(() => {}); // binary/unreadable → keep the icon fallback
      return () => { cancelled = true; };
    }
  }, [seen, e.path, e.kind, e.name]);

  const t = TONE[e.kind];
  // Config/dotfiles should get 1x1 sizing instead of 2x1
  const isConfigFile = isConfigDotfile(e);
  const gridKind = isConfigFile ? "config" : e.kind;
  // Sensitive files should be blurred for screen recording safety
  const isSensitive = isSensitiveFile(e);
  const { neverUnblur } = getBlurBehavior();
  // unblurable = neverUnblur is TRUE (should stay blurred on hover)
  const isUnblurable = neverUnblur && isSensitive;
  return (
    <button ref={ref} draggable className={"filecard" + (selected ? " sel" : "") + (intersecting ? " rubber-band-hover" : "") + (isSensitive ? " sensitive" : "") + (isUnblurable ? " unblurable" : "")} data-kind={gridKind} {...interact}>
      <div className="filecard-preview">
        {peek?.type === "img" ? (
          <img className="filecard-img" src={peek.src} alt="" loading="lazy" />
        ) : peek?.type === "code" ? (
          <pre className="filecard-code hljs"><code dangerouslySetInnerHTML={{ __html: peek.html }} /></pre>
        ) : peek?.type === "md" ? (
          <div className="filecard-md prev-md">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{peek.html}</ReactMarkdown>
          </div>
        ) : (
          <span className="filecard-tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={e.kind} /></span>
        )}
      </div>
      <div className="filecard-foot">
        <span className="filecard-ic" style={{ background: t.bg, color: t.fg }}><Glyph kind={e.kind} /></span>
        {children}
      </div>
    </button>
  );
}
