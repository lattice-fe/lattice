import { Explorer } from "../hooks/useExplorer";

const QUICK_ICON: Record<string, string> = {
  Home: "⌂", Desktop: "▢", Downloads: "⤓", Documents: "▤", Pictures: "▨", Music: "♪", Videos: "▷", Starred: "☆", Recents: "◷",
};

export function Sidebar({ ex }: { ex: Explorer }) {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const active = (p: string) => norm(ex.path) === norm(p);

  return (
    <aside className="sidebar">
      <div className="side-group">
        <div className="side-label">Quick access</div>
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
        {ex.quick.map((q) => {
          return (
            <button
              key={q.path}
              className={"side-item" + (active(q.path) ? " active" : "")}
              onClick={() => ex.navigate(q.path)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                ex.openContext(e.clientX, e.clientY, null, {
                  name: q.label,
                  path: q.path,
                  is_dir: true,
                  size: 0,
                  modified: null,
                  kind: "folder",
                  type_label: "File folder",
                  hidden: false,
                });
              }}
              title={q.label}
            >
              <span style={{ width: 18, textAlign: "center", color: active(q.path) ? "var(--terracotta)" : "var(--dim)" }}>{QUICK_ICON[q.label] ?? "▪"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.label}</span>
            </button>
          );
        })}
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
                name: d.display,
                path: d.path,
                is_dir: true,
                size: 0,
                modified: null,
                kind: "folder",
                type_label: "Drive",
                hidden: false,
              });
            }}
          >
            <span style={{ width: 18, textAlign: "center", color: active(d.path) ? "var(--terracotta)" : "var(--dim)" }}>▤</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.display}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
