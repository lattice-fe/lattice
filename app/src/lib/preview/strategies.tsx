import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, Entry, Preview, isTauri } from "../api";
import { byExt, extOf, registerPreviewStrategy } from "./registry";
import { highlightCode } from "./highlight";

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
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{d.text}</ReactMarkdown>
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

// Code / plain-text documents → syntax-highlighted head in a monospace pane.
// Fallback for any text-like kind not claimed above (binary files fail load()
// and show nothing). load() carries the extension so render() can highlight.
interface CodePreview extends Preview { ext: string }
registerPreviewStrategy<CodePreview>({
  id: "text",
  match: (e: Entry) => !e.is_dir && (e.kind === "code" || e.kind === "document"),
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
