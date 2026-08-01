import ReactMarkdown from "react-markdown";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, Entry, Preview, isTauri } from "../api";
import { byExt, registerPreviewStrategy } from "./registry";

// --- built-in preview strategies ---
// Order matters: markdown and image are more specific than the text fallback,
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
      <ReactMarkdown>{d.text}</ReactMarkdown>
      <TruncMark p={d} />
    </div>
  ),
});

// Images → shown via the asset protocol (no bytes cross the IPC bridge).
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"];
registerPreviewStrategy({
  id: "image",
  match: byExt(...IMAGE_EXTS),
  load: async (e: Entry) => (isTauri ? convertFileSrc(e.path) : e.path),
  render: (src: string) => <img className="prev-img" src={src} alt="" />,
});

// Code / plain-text documents → raw head in a monospace pane. Fallback for any
// text-like kind not claimed above (binary files fail load() and show nothing).
registerPreviewStrategy({
  id: "text",
  match: (e: Entry) => !e.is_dir && (e.kind === "code" || e.kind === "document"),
  load: (e: Entry) => api.previewFile(e.path),
  render: (d: Preview) => (
    <>
      <pre className="hoverprev-scroll hoverprev-body">{d.text}</pre>
      <TruncMark p={d} />
    </>
  ),
});
