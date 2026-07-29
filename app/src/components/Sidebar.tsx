import { Explorer } from "../hooks/useExplorer";
import { Mark } from "../lib/icons";

const QUICK_ICON: Record<string, string> = {
  Home: "⌂", Desktop: "▢", Downloads: "⤓", Documents: "▤", Pictures: "▨", Music: "♪", Videos: "▷", Starred: "☆", Recents: "◷",
};

export function Sidebar({ ex }: { ex: Explorer }) {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const active = (p: string) => norm(ex.path) === norm(p);

  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Mark /></span><span className="brand-word">lattice</span></div>

      <div className="side-group">
        <div className="side-label">Quick access</div>
        {ex.quick.map((q) => (
          <button key={q.path} className={"side-item" + (active(q.path) ? " active" : "")} onClick={() => ex.navigate(q.path)}>
            <span style={{ width: 18, textAlign: "center", color: active(q.path) ? "var(--terracotta)" : "var(--dim)" }}>{QUICK_ICON[q.label] ?? "▪"}</span>
            <span style={{ flex: 1 }}>{q.label}</span>
          </button>
        ))}
      </div>

      <div className="side-group">
        <div className="side-label">This PC</div>
        {ex.drives.map((d) => (
          <button key={d.path} className={"side-item" + (active(d.path) ? " active" : "")} onClick={() => ex.navigate(d.path)}>
            <span style={{ width: 18, textAlign: "center", color: active(d.path) ? "var(--terracotta)" : "var(--dim)" }}>▤</span>
            <span style={{ flex: 1 }}>{d.display}</span>
          </button>
        ))}
      </div>

      <div className="storage">
        <div className="storage-top"><b>{ex.drives[0]?.display ?? "Local Disk"}</b><span>free</span></div>
        <div className="meter"><i style={{ width: "62%" }} /></div>
      </div>
    </aside>
  );
}
