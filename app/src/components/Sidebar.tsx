import { useState } from "react";
import { Explorer } from "../hooks/useExplorer";
import { QuickAccessModal } from "./QuickAccessModal";

const QUICK_ICON: Record<string, string> = {
  Home: "⌂", Desktop: "▢", Downloads: "⤓", Documents: "▤", Pictures: "▨", Music: "♪", Videos: "▷", Starred: "☆", Recents: "◷",
};

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
          <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: norm(ex.path) === "lattice://home" ? "var(--amber)" : "var(--dim)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
            </svg>
          </span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Home</span>
        </button>
        <button
          className={"side-item" + (norm(ex.path) === "lattice://keep" ? " active" : "")}
          onClick={() => ex.openKeepTab()}
          title="Keep Notes"
        >
          <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: norm(ex.path) === "lattice://keep" ? "var(--amber)" : "var(--dim)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </span>
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
            <span style={{ width: 18, textAlign: "center", color: active(q.path) ? "var(--terracotta)" : "var(--dim)" }}>{QUICK_ICON[q.label] ?? "▪"}</span>
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
            <span style={{ width: 18, textAlign: "center", color: active(d.path) ? "var(--terracotta)" : "var(--dim)" }}>▤</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.display}</span>
          </button>
        ))}
      </div>

      {editOpen && <QuickAccessModal ex={ex} onClose={() => setEditOpen(false)} />}
    </aside>
  );
}
