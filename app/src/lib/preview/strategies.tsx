import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, Entry, Preview, isTauri } from "../api";
import { byExt, extOf, registerPreviewStrategy } from "./registry";
import { highlightCode } from "./highlight";

import { AudioPreview } from "../../components/AudioPreview";

// --- built-in preview strategies ---
// Order matters: markdown, pdf, audio, and image are more specific than the text fallback,
// so they're registered first. Extend by calling registerPreviewStrategy() from
// your own module — e.g. a CSV table renderer, a syntax-highlighted code view.

function TruncMark({ p }: { p: Preview }) {
  return p.truncated ? <div className="hoverprev-more">…</div> : null;
}

// Markdown → rendered rich text.
registerPreviewStrategy({
  id: "markdown",
  match: byExt("md", "markdown", "mdx"),
  load: (e: Entry) => api.previewFile(e.path),
  render: (d: Preview) => (
    <div className="hoverprev-scroll prev-md">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{d.text}</ReactMarkdown>
      <TruncMark p={d} />
    </div>
  ),
});

// PDF Documents → embedded native PDF viewer / preview.
registerPreviewStrategy({
  id: "pdf",
  match: byExt("pdf"),
  load: async (e: Entry) => (isTauri ? convertFileSrc(e.path) : e.path),
  render: (src: string) => (
    <div className="prev-pdf-container">
      <object data={`${src}#toolbar=0&navpanes=0`} type="application/pdf" className="prev-pdf-frame">
        <embed src={src} type="application/pdf" className="prev-pdf-frame" />
      </object>
    </div>
  ),
});

// Audio files → interactive waveform visualization & player.
const AUDIO_EXTS = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "wma", "aiff"];
registerPreviewStrategy({
  id: "audio",
  match: byExt(...AUDIO_EXTS),
  load: async (e: Entry) => (isTauri ? convertFileSrc(e.path) : e.path),
  render: (src: string) => <AudioPreview src={src} />,
});

// Images → shown via the asset protocol (no bytes cross the IPC bridge).
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"];
registerPreviewStrategy({
  id: "image",
  match: byExt(...IMAGE_EXTS),
  load: async (e: Entry) => (isTauri ? convertFileSrc(e.path) : e.path),
  render: (src: string) => <img className="prev-img" src={src} alt="" />,
});

// Code / plain-text documents → syntax-highlighted head in a monospace pane.
// Fallback for any text-like kind not claimed above (binary files fail load()
// and show nothing). load() carries the extension so render() can highlight.
interface CodePreview extends Preview { ext: string }
const CODE_EXTS = new Set([
  "js", "ts", "jsx", "tsx", "mjs", "cjs", "json", "yaml", "yml", "toml",
  "ini", "cfg", "conf", "log", "gitignore", "env", "dockerfile", "makefile",
  "sh", "bash", "zsh", "py", "rb", "php", "java", "c", "cpp", "h", "hpp",
  "rs", "go", "swift", "kt", "lua", "r", "scala", "pl", "pm", "vim",
  "css", "scss", "sass", "less", "styl", "html", "htm", "xml", "svg",
  "sql", "graphql", "prisma", "proto", "graphql", "ex", "exs", "erl", "hrl"
]);
registerPreviewStrategy<CodePreview>({
  id: "text",
  match: (e: Entry) => !e.is_dir && (e.kind === "code" || e.kind === "document" || CODE_EXTS.has(extOf(e.name))),
  load: async (e: Entry) => ({ ...(await api.previewFile(e.path)), ext: extOf(e.name) }),
  render: (d: CodePreview) => {
    const { html } = highlightCode(d.text, d.ext);
    return (
      <>
        <pre className="hoverprev-scroll hoverprev-body hljs">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
        <TruncMark p={d} />
      </>
    );
  },
});

// Folders → peek at first few child items (no hidden files).
// Shows up to 5 items as a two-column layout: list on left, metadata on right.
interface FolderPreview { entries: Entry[]; totalCount?: number }
registerPreviewStrategy<FolderPreview>({
  id: "folder",
  match: (e: Entry) => e.is_dir,
  load: async (e: Entry) => {
    const entries = await api.listDir(e.path, false);
    const preview = entries.slice(0, 5);
    return { entries: preview, totalCount: entries.length };
  },
  render: (d: FolderPreview) => (
    <div className="hoverprev-scroll" style={{ padding: "10px 12px", maxHeight: "180px", overflow: "hidden" }}>
      {/* Header: item count and last modified */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--dim)", fontSize: "11px", borderBottom: "1px solid var(--border-soft)", paddingBottom: "6px" }}>
        <span>{d.totalCount !== undefined && d.totalCount > 5 ? `${d.totalCount} items` : d.entries.length === 1 ? "1 item" : `${d.entries.length} items`}</span>
      </div>
      {/* Two-column layout: items left, metadata right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px" }}>
        {d.entries.map((e) => (
          <div key={e.path} style={{ display: "contents" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--paper-dim)", fontSize: "12.5px", padding: "3px 0" }}>
              <span style={{ color: "var(--dim)", width: "16px", textAlign: "center" }}>{e.is_dir ? "▤" : "▷"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", color: "var(--dim-2)", fontSize: "11px", fontFamily: "var(--mono)", padding: "3px 0", minWidth: "70px" }}>
              {e.is_dir ? "" : <span>{e.kind}</span>}
            </div>
          </div>
        ))}
      </div>
      {d.entries.length === 0 && (
        <div style={{ color: "var(--dim)", fontSize: "12px", fontStyle: "italic", padding: "8px 0" }}>Empty folder</div>
      )}
    </div>
  ),
});
