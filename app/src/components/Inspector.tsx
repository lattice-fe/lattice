import { useEffect, useState } from "react";
import { Explorer } from "../hooks/useExplorer";
import { Glyph, TONE } from "../lib/icons";
import { fmtSize, fmtWhen, parentOf, baseName } from "../lib/format";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Entry, api, isTauri } from "../lib/api";
import { pickStrategy } from "../lib/preview/registry";
import { AudioPreview } from "./AudioPreview";

// Normalize Windows paths to forward slashes for display consistency
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function FolderTree({ path }: { path: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.listDir(path, false).then((ents) => {
      // Sort: folders first, then files, alphabetically
      const sorted = [...ents].sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setLoading(false);
    });
  }, [path]);

  if (loading) {
    return <div style={{ padding: "12px", color: "var(--dim)", fontSize: "13px" }}>Loading…</div>;
  }

  const total = entries.length;
  const displayEntries = entries.slice(0, 40);

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--dim-2)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Contents ({total})
      </div>
      <div style={{ padding: "0 4px" }}>
        {displayEntries.map((e) => {
          const t = TONE[e.kind];
          const ext = e.name.includes('.') ? e.name.split('.').pop() || '' : '';
          const displayName = e.is_dir ? `${e.name}/` : `${e.name}${ext ? `.${ext}` : ''}`;
          return (
            <div key={e.path} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", cursor: "default" }}>
              <span style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", color: t.fg, flexShrink: 0 }}>
                <Glyph kind={e.kind} />
              </span>
              <span style={{ fontSize: "13px", color: "var(--paper-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {displayName}
              </span>
            </div>
          );
        })}
        {total > 40 && (
          <div style={{ padding: "8px 12px", fontSize: "12px", color: "var(--dim)", fontStyle: "italic" }}>
            …and {total - 40} more
          </div>
        )}
        {total === 0 && (
          <div style={{ padding: "12px", fontSize: "13px", color: "var(--dim)" }}>
            Empty folder
          </div>
        )}
      </div>
    </div>
  );
}

export function Inspector({ ex, onCollapse }: { ex: Explorer; onCollapse: () => void }) {
  const items = ex.selectedEntries;

  if (items.length === 0)
    return (
      <aside className="inspector">
        <button className="inspector-collapse" onClick={onCollapse} title="Collapse preview pane">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <div style={{ padding: "16px 0" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>
            {baseName(ex.path) || "/"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--dim)", fontFamily: "var(--mono)", marginBottom: "16px", wordBreak: "break-all" }}>
            {normalizePath(ex.path)}
          </div>
          <FolderTree path={ex.path} />
        </div>
      </aside>
    );

  if (items.length > 1) {
    const total = items.reduce((a, e) => a + e.size, 0);
    return (
      <aside className="inspector">
        <button className="inspector-collapse" onClick={onCollapse} title="Collapse preview pane">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <div className="insp-in">
          <div className="preview" style={{ background: "linear-gradient(150deg, var(--card-hi), var(--ink))", color: "var(--amber)" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 40, fontWeight: 600 }}>{items.length}</div>
          </div>
          <div><div className="insp-name">{items.length} items</div><div className="insp-sub">selected · {fmtSize(total)}</div></div>
        </div>
      </aside>
    );
  }

  const e = items[0];
  const t = TONE[e.kind];
  const assetSrc = isTauri ? convertFileSrc(e.path) : e.path;

  const [copied, setCopied] = useState(false);

  // Copy actual image pixels to clipboard
  const copyToClipboard = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = assetSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const ext = e.name.includes(".") ? e.name.split(".").pop()?.toLowerCase() || "" : "";

  // Check file types
  const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"];
  const AUDIO_EXTS = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "wma", "aiff"];
  const isImage = IMAGE_EXTS.includes(ext);
  const isAudio = AUDIO_EXTS.includes(ext);

  const strategy = pickStrategy(e);
  const disableInspector = strategy?.disableInspector;

  return (
    <aside className="inspector">
      <button className="inspector-collapse" onClick={onCollapse} title="Collapse preview pane">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <div className="insp-in" key={e.path}>
        {isAudio ? (
          <AudioPreview src={assetSrc} filename={e.name} />
        ) : (
          <div className="preview" style={{ background: isImage ? "var(--card)" : `linear-gradient(150deg, ${t.bg}, var(--ink))`, color: t.fg }}>
            {disableInspector ? (
              <Glyph kind={e.kind} />
            ) : isImage ? (
              <img src={assetSrc} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "var(--radius-lg)" }} />
            ) : (
              <Glyph kind={e.kind} />
            )}

            {isImage && (
              <button
                className="btn-copy"
                onClick={copyToClipboard}
                title={copied ? "Copied!" : "Copy image to clipboard"}
                style={{ position: "absolute", bottom: "8px", right: "8px", color: copied ? "var(--teal)" : "var(--dim)" }}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
            )}
          </div>
        )}
        <div>
          <div className="insp-name">{e.name}</div>
          <div className="insp-sub">{e.type_label} · {fmtSize(e.size, e.is_dir)}</div>
        </div>
        <div className="actions">
          <button className="btn-open" onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); ex.openEntry(e); }}>Open</button>
          <button className="btn-ghost" title="More" onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); ex.openContext(ev.clientX, ev.clientY, ex.entries.findIndex((x) => x.path === e.path)); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /><circle cx="5" cy="12" r="1.4" /></svg></button>
        </div>
        <div className="divider" />
        <div>
          <div className="info-h">Information</div>
          <div className="info-row"><span className="k">Kind</span><span className="v">{e.type_label}</span></div>
          <div className="info-row"><span className="k">Size</span><span className="v">{fmtSize(e.size, e.is_dir)}</span></div>
          <div className="info-row"><span className="k">Where</span><span className="v">{parentOf(e.path) ?? "/"}</span></div>
          <div className="info-row"><span className="k">Modified</span><span className="v">{fmtWhen(e.modified)}</span></div>
        </div>
      </div>
    </aside>
  );
}
