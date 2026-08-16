import { useState } from "react";
import { Explorer } from "../hooks/useExplorer";
import { QuickAccessModal } from "./QuickAccessModal";

// SVG glyphs for quick-access folders — replaces the old unicode symbols that
// rendered inconsistently and clashed with the file-list icon set.
const FOLDER = <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
const QUICK_ICON: Record<string, React.ReactNode> = {
  Home: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  Desktop: <><rect x="2" y="4" width="20" height="13" rx="1.5" /><path d="M8 21h8M12 17v4" /></>,
  Downloads: <><path d="M12 3v11m-4-4 4 4 4-4" /><path d="M5 21h14" /></>,
  Documents: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  Pictures: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  Music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  Videos: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m10 9 5 3-5 3z" /></>,
  Starred: <path d="M12 2.5l2.9 6.3 6.6.6-5 4.4 1.5 6.6L12 17l-5.9 3.4 1.5-6.6-5-4.4 6.6-.6z" />,
  Recents: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};
const DRIVE = <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M6.5 7.5h.01M6.5 16.5h.01" /></>;

function SideIcon({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: active ? "var(--terracotta)" : "var(--dim)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </span>
  );
}

export function Sidebar({ ex }: { ex: Explorer }) {
  const [editOpen, setEditOpen] = useState(false);
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const active = (p: string) => norm(ex.path) === norm(p);

  return (
    <aside className="sidebar">
      {/* Top-level nav — Home & Keep, above Quick access */}
      <div className="side-group">
        <button
          className={"side-item" + (norm(ex.path) === "lattice://home" ? " active" : "")}
          onClick={() => ex.navigate("lattice://home")}
          title="Home"
        >
          <SideIcon active={norm(ex.path) === "lattice://home"}>{QUICK_ICON.Home}</SideIcon>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Home</span>
        </button>
        <button
          className={"side-item" + (norm(ex.path) === "lattice://keep" ? " active" : "")}
          onClick={() => ex.openKeepTab()}
          title="Keep Notes"
        >
          <SideIcon active={norm(ex.path) === "lattice://keep"}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </SideIcon>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Keep</span>
        </button>
      </div>

      <div className="side-group">
        <div className="side-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Quick access</span>
          <button className="side-edit" title="Edit quick access" onClick={() => setEditOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        </div>
        {ex.quick.map((q) => (
          <button
            key={q.path}
            className={"side-item" + (active(q.path) ? " active" : "")}
            onClick={() => ex.navigate(q.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              ex.openContext(e.clientX, e.clientY, null, {
                name: q.label, path: q.path, is_dir: true, size: 0, modified: null, kind: "folder", type_label: "File folder", hidden: false,
              });
            }}
            title={q.label}
          >
            <SideIcon active={active(q.path)}>{QUICK_ICON[q.label] ?? FOLDER}</SideIcon>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.label}</span>
          </button>
        ))}
      </div>

      <div className="side-group">
        <div className="side-label">This PC</div>
        {ex.drives.map((d) => (
          <button
            key={d.path}
            className={"side-item" + (active(d.path) ? " active" : "")}
            onClick={() => ex.navigate(d.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              ex.openContext(e.clientX, e.clientY, null, {
                name: d.display, path: d.path, is_dir: true, size: 0, modified: null, kind: "folder", type_label: "Drive", hidden: false,
              });
            }}
          >
            <SideIcon active={active(d.path)}>{DRIVE}</SideIcon>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.display}</span>
          </button>
        ))}
      </div>

      {editOpen && <QuickAccessModal ex={ex} onClose={() => setEditOpen(false)} />}
    </aside>
  );
}
