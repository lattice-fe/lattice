import { useEffect, useMemo, useState } from "react";
import { Entry, Kind, isTauri, listDir, homeDir } from "./api";
import "./lattice.css";

/* ---------- tones + glyphs (mirrors the iced Ink palette) ---------- */
const TONE: Record<Kind, { bg: string; fg: string }> = {
  folder: { bg: "#33260f", fg: "#E2A64C" },
  archive: { bg: "#33260f", fg: "#E2A64C" },
  code: { bg: "#331f14", fg: "#d8794a" },
  image: { bg: "#22271f", fg: "#9db98a" },
  audio: { bg: "#282132", fg: "#b199d6" },
  video: { bg: "#301c1a", fg: "#cf6f5b" },
  executable: { bg: "#301c1a", fg: "#cf6f5b" },
  document: { bg: "#26221d", fg: "#a99f8e" },
  other: { bg: "#26221d", fg: "#a99f8e" },
};

function Glyph({ kind }: { kind: Kind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "folder": return <svg viewBox="0 0 24 24" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
    case "image": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>;
    case "code": return <svg viewBox="0 0 24 24" {...p}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>;
    case "video": return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m10 9 5 3-5 3z" /></svg>;
    case "audio": return <svg viewBox="0 0 24 24" {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
    case "archive": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>;
    case "executable": return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m8 9 3 3-3 3M13 15h3" /></svg>;
    default: return <svg viewBox="0 0 24 24" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>;
  }
}

const Mark = () => (
  <svg viewBox="0 0 48 48">
    <g fill="none" stroke="#C05F3C" strokeWidth="2" strokeLinecap="round" opacity="0.92">
      <line x1="10" y1="10" x2="38" y2="10" /><line x1="10" y1="38" x2="38" y2="38" />
      <line x1="10" y1="10" x2="10" y2="38" /><line x1="38" y1="10" x2="38" y2="38" />
      <line x1="10" y1="24" x2="38" y2="24" /><line x1="24" y1="10" x2="24" y2="38" />
    </g>
    <g fill="#C05F3C"><circle cx="10" cy="10" r="3.1" /><circle cx="38" cy="10" r="3.1" /><circle cx="10" cy="38" r="3.1" /><circle cx="38" cy="38" r="3.1" /><circle cx="24" cy="10" r="3.1" /><circle cx="10" cy="24" r="3.1" /><circle cx="38" cy="24" r="3.1" /><circle cx="24" cy="38" r="3.1" /></g>
    <circle cx="24" cy="24" r="7.4" fill="none" stroke="#E2A64C" strokeWidth="1.5" opacity="0.45" style={{ animation: "pulse 3.4s ease-in-out infinite", transformOrigin: "24px 24px" }} />
    <circle cx="24" cy="24" r="4.4" fill="#E2A64C" />
  </svg>
);

/* ---------- format helpers ---------- */
const fmtSize = (b: number) => {
  if (b <= 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const fmtWhen = (ms: number | null) => {
  if (!ms) return "—";
  const s = (Date.now() - ms) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  if (s < 2592000) return `${Math.round(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString();
};
const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase() : "");
const kindLabel = (e: Entry) => {
  if (e.is_dir) return "Folder";
  const map: Record<string, string> = { RS: "Rust", TS: "TypeScript", TSX: "TypeScript", JS: "JavaScript", TOML: "TOML", JSON: "JSON", MD: "Markdown", PNG: "PNG image", JPG: "JPEG image", MOV: "QuickTime", WAV: "WAV audio", ZIP: "Archive" };
  return map[ext(e.name)] || (ext(e.name) ? `${ext(e.name)} file` : "File");
};

const QUICK = [
  { name: "Home", icon: "⌂" },
  { name: "Recents", icon: "◷" },
  { name: "lattice", icon: "▦", active: true, count: 12 },
  { name: "Downloads", icon: "⤓" },
  { name: "Starred", icon: "☆" },
];
const TAGS = [
  { name: "Work", color: "#C05F3C" },
  { name: "Design", color: "#E2A64C" },
  { name: "Ideas", color: "#4F9A8A" },
];

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [crumbs, setCrumbs] = useState<string[]>(["Home", "Projects", "lattice"]);

  async function open(p: string) {
    const list = await listDir(p);
    setEntries(list);
    setSel(null);
    if (isTauri) setCrumbs(p.replace(/\\/g, "/").split("/").filter(Boolean));
  }
  useEffect(() => { homeDir().then(open); }, []);

  const selected = sel != null ? entries[sel] : null;
  const title = crumbs[crumbs.length - 1] || "lattice";
  const totalSize = useMemo(() => entries.reduce((a, e) => a + e.size, 0), [entries]);

  return (
    <div className="app">
      {/* top bar */}
      <div className="topbar">
        <div className="nav">
          <button className="iconbtn" title="Back"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <button className="iconbtn" disabled><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
          <button className="iconbtn" title="Up"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
        </div>
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              <button className={"crumb" + (i === crumbs.length - 1 ? " here" : "")}>{c}</button>
              {i < crumbs.length - 1 && <span className="crumb-sep">/</span>}
            </span>
          ))}
        </div>
        <div className="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input placeholder="Search or jump to…" />
          <span className="kbd">⌘K</span>
        </div>
        <button className="iconbtn" title="Settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.7 8a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V8a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></button>
      </div>

      <div className="body">
        {/* sidebar */}
        <aside className="sidebar">
          <div className="brand"><span className="brand-mark"><Mark /></span><span className="brand-word">lattice</span></div>
          <div className="side-group">
            <div className="side-label">Quick access</div>
            {QUICK.map((q) => (
              <button key={q.name} className={"side-item" + (q.active ? " active" : "")}>
                <span style={{ width: 18, textAlign: "center", color: q.active ? "var(--terracotta)" : "var(--dim)" }}>{q.icon}</span>
                <span style={{ flex: 1 }}>{q.name}</span>
                {q.count && <span className="count">{q.count}</span>}
              </button>
            ))}
          </div>
          <div className="side-group">
            <div className="side-label">Tags</div>
            {TAGS.map((t) => (
              <button key={t.name} className="side-item">
                <span className="dot" style={{ background: t.color }} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
          <div className="storage">
            <div className="storage-top"><b>Local Disk (D:)</b><span>318 GB free</span></div>
            <div className="meter"><i style={{ width: "62%" }} /></div>
          </div>
        </aside>

        {/* file panel */}
        <main className="panel">
          <div className="hero">
            <div>
              <h1>{title}</h1>
              <div className="meta">{entries.length} items · {fmtSize(totalSize)}</div>
            </div>
            <div className="grow" />
            <div className="viewtoggle">
              <button className="on" title="List"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg></button>
              <button title="Grid"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg></button>
            </div>
          </div>
          <div className="collabel"><span className="s">Name</span><span className="s">Modified</span><span className="s r">Size</span></div>
          <div className="list">
            {entries.map((e, i) => {
              const t = TONE[e.kind];
              return (
                <button
                  key={e.path}
                  className={"row" + (i === sel ? " sel" : "")}
                  style={{ animationDelay: `${Math.min(i * 22, 320)}ms` }}
                  onClick={() => setSel(i)}
                  onDoubleClick={() => { if (e.is_dir && isTauri) open(e.path); }}
                >
                  <span className="nm">
                    <span className="tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={e.kind} /></span>
                    <span className="label">{e.name}</span>
                  </span>
                  <span className="col">{fmtWhen(e.modified)}</span>
                  <span className="col r">{fmtSize(e.size)}</span>
                </button>
              );
            })}
          </div>
        </main>

        {/* inspector */}
        {selected ? (
          <aside className="inspector">
            <div className="insp-in" key={selected.path}>
              <div className="preview" style={{ background: `linear-gradient(150deg, ${TONE[selected.kind].bg}, #1b1712)`, color: TONE[selected.kind].fg }}>
                <Glyph kind={selected.kind} />
              </div>
              <div>
                <div className="insp-name">{selected.name}</div>
                <div className="insp-sub">{kindLabel(selected)} · {fmtSize(selected.size)}</div>
              </div>
              <div className="actions">
                <button className="btn-open">Open</button>
                <button className="btn-ghost" title="Share"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M16 6l-4-4-4 4M12 2v14" /></svg></button>
                <button className="btn-ghost" title="More"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /><circle cx="5" cy="12" r="1.4" /></svg></button>
              </div>
              <div className="divider" />
              <div>
                <div className="info-h">Information</div>
                <div className="info-row"><span className="k">Kind</span><span className="v">{kindLabel(selected)}</span></div>
                <div className="info-row"><span className="k">Size</span><span className="v">{fmtSize(selected.size)}</span></div>
                <div className="info-row"><span className="k">Where</span><span className="v">{selected.path.replace(/[\\/][^\\/]*$/, "") || "/"}</span></div>
                <div className="info-row"><span className="k">Modified</span><span className="v">{fmtWhen(selected.modified)}</span></div>
              </div>
              <div>
                <div className="info-h">Tags</div>
                <div className="chips">
                  <span className="chip"><span className="dot" style={{ background: "#C05F3C" }} />Work</span>
                </div>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="inspector empty">Select an item<br />to see details</aside>
        )}
      </div>

      {!isTauri && <div className="scaffold-note">preview · mock data — run <b style={{ color: "var(--paper-dim)" }}>npm run tauri dev</b> for live files</div>}
    </div>
  );
}
