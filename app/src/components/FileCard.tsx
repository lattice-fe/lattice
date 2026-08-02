import { ReactNode, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Entry, api, isTauri } from "../lib/api";
import { Glyph, TONE } from "../lib/icons";
import { extOf } from "../lib/preview/registry";
import { highlightCode } from "../lib/preview/highlight";

type Peek = { type: "img"; src: string } | { type: "code"; html: string } | null;

// What kind of rich preview (if any) a card should lazily load.
function peekKind(e: Entry): "img" | "code" | null {
  if (e.is_dir) return null;
  if (e.kind === "image") return "img";
  if (e.kind === "code" || e.kind === "document") return "code";
  return null;
}

// A rich, content-adaptive tile for the Cards view. The preview (thumbnail or
// code peek) is loaded lazily — only once the card scrolls near the viewport —
// so a folder of hundreds of files doesn't read/decode everything up front.
export function FileCard({
  e, selected, interact, children,
}: {
  e: Entry;
  selected: boolean;
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
    if (kind === "code") {
      let cancelled = false;
      api.previewFile(e.path)
        .then((p) => { if (!cancelled) setPeek({ type: "code", html: highlightCode(p.text, extOf(e.name)).html }); })
        .catch(() => {}); // binary/unreadable → keep the icon fallback
      return () => { cancelled = true; };
    }
  }, [seen, e.path, e.kind, e.name]);

  const t = TONE[e.kind];
  return (
    <button ref={ref} className={"filecard" + (selected ? " sel" : "")} {...interact}>
      <div className="filecard-preview">
        {peek?.type === "img" ? (
          <img className="filecard-img" src={peek.src} alt="" loading="lazy" />
        ) : peek?.type === "code" ? (
          <pre className="filecard-code hljs"><code dangerouslySetInnerHTML={{ __html: peek.html }} /></pre>
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
