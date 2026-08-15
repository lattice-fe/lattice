import { Explorer } from "../hooks/useExplorer";
import { api } from "../lib/api";
import { baseName } from "../lib/format";

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

export function QuickAccessModal({ ex, onClose }: { ex: Explorer; onClose: () => void }) {
  const hidden = new Set(ex.hiddenQuick.map((h) => h.toLowerCase()));
  const isHidden = (p: string) => hidden.has(p.toLowerCase());

  const addFolder = async () => {
    const path = await api.selectFolder();
    if (path) ex.pinFolder(baseName(path) || path, path);
  };

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
    borderRadius: "var(--radius-sm)", fontSize: "13px", color: "var(--paper)",
  };
  const labelStyle: React.CSSProperties = { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const pathStyle: React.CSSProperties = { fontSize: "11px", color: "var(--dim)", fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "480px", maxWidth: "92vw", maxHeight: "80vh", background: "var(--ink)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 24px 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--paper)" }}>Edit Quick Access</div>
          <button className="iconbtn" onClick={onClose} title="Done" style={{ width: 26, height: 26 }}><XIcon /></button>
        </div>

        <div style={{ padding: "12px 12px 16px", overflowY: "auto" }}>
          {/* Default folders — toggle visibility */}
          <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "var(--dim-2)", fontFamily: "var(--mono)", padding: "6px 10px 8px" }}>Default folders</div>
          {ex.quickDefaults.length === 0 && <div style={{ ...rowStyle, color: "var(--dim)" }}>None</div>}
          {ex.quickDefaults.map((q) => {
            const off = isHidden(q.path);
            return (
              <div key={q.path} style={{ ...rowStyle, opacity: off ? 0.5 : 1 }}>
                <span style={labelStyle}>{q.label}</span>
                <span style={pathStyle}>{q.path}</span>
                <button
                  className="btn-outline"
                  style={{ fontSize: "11px", padding: "3px 10px", flexShrink: 0 }}
                  onClick={() => (off ? ex.showQuick(q.path) : ex.hideQuick(q.path))}
                >
                  {off ? "Show" : "Hide"}
                </button>
              </div>
            );
          })}

          {/* Custom pinned folders — remove */}
          <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "var(--dim-2)", fontFamily: "var(--mono)", padding: "16px 10px 8px" }}>Custom folders</div>
          {ex.pinnedQuick.length === 0 && <div style={{ ...rowStyle, color: "var(--dim)" }}>None added yet.</div>}
          {ex.pinnedQuick.map((q) => (
            <div key={q.path} style={rowStyle}>
              <span style={labelStyle}>{q.label}</span>
              <span style={pathStyle}>{q.path}</span>
              <button className="iconbtn" style={{ width: 24, height: 24, flexShrink: 0 }} title="Remove" onClick={() => ex.unpinFolder(q.path)}><XIcon /></button>
            </div>
          ))}

          <button
            onClick={addFolder}
            style={{ marginTop: "14px", width: "calc(100% - 20px)", marginLeft: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "9px", background: "var(--card)", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", color: "var(--paper)", fontSize: "13px", cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add folder…
          </button>
        </div>
      </div>
    </div>
  );
}
