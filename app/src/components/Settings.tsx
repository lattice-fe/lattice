import { useState } from "react";
import { Explorer } from "../hooks/useExplorer";
import { Indexer } from "../hooks/useIndexer";
import { ThemeApi } from "../hooks/useTheme";
import { Theme } from "../lib/theme/types";
import { api } from "../lib/api";
import { baseName } from "../lib/format";
import { themeVars } from "../lib/theme/engine";
import { ThemeEditor } from "./ThemeEditor";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className={"switch" + (on ? " on" : "")} onClick={onClick} role="switch" aria-checked={on}><span /></button>;
}

export function Settings({ ex, ind, th, onClose }: { ex: Explorer; ind: Indexer; th: ThemeApi; onClose: () => void }) {
  // editing: a theme to edit, "new" to fork the active one, or null
  const [editing, setEditing] = useState<Theme | "new" | null>(null);
  if (editing) {
    return <ThemeEditor th={th} base={editing === "new" ? th.theme : editing} isNew={editing === "new"} onClose={() => setEditing(null)} />;
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="modal-x" onClick={onClose} title="Close">×</button>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-name">Show hidden files</div>
            <div className="setting-desc">Reveal dotfiles and system-hidden items</div>
          </div>
          <Switch on={ex.showHidden} onClick={ex.toggleHidden} />
        </div>

        <div className="modal-sec">Appearance</div>
        <div className="theme-grid">
          {th.themes.map((t) => {
            const v = themeVars(t);
            const active = t.id === th.theme.id;
            const custom = !th.isBuiltin(t.id);
            return (
              <div
                key={t.id}
                className={"theme-card" + (active ? " on" : "")}
                onClick={() => th.setTheme(t.id)}
                style={{ background: v["--ink"], borderColor: active ? v["--terracotta"] : v["--border"] }}
              >
                <div className="theme-swatches">
                  {["--card", "--terracotta", "--amber", "--teal"].map((k) => (
                    <span key={k} style={{ background: v[k] }} />
                  ))}
                </div>
                <div className="theme-name" style={{ color: v["--paper"] }}>{t.name}</div>
                <div className="theme-appear" style={{ color: v["--dim"] }}>{t.appearance}</div>
                <div className="theme-card-actions">
                  <button title="Duplicate & edit" style={{ color: v["--dim"] }} onClick={(e) => { e.stopPropagation(); setEditing(custom ? t : "new"); }}>✎</button>
                  {custom && <button title="Delete theme" style={{ color: v["--dim"] }} onClick={(e) => { e.stopPropagation(); th.deleteTheme(t.id); }}>×</button>}
                </div>
              </div>
            );
          })}
          <button className="theme-card theme-new" onClick={() => setEditing("new")}>
            <span className="theme-new-plus">+</span>
            <div className="theme-name">New theme</div>
            <div className="theme-appear">customize colours</div>
          </button>
        </div>

        <div className="modal-sec">Indexed folders</div>
        {ind.collections.length === 0 ? (
          <div className="setting-desc" style={{ padding: "2px 2px 6px" }}>
            No folders indexed yet. Right-click a folder → <b style={{ color: "var(--paper-dim)" }}>Index for search</b>.
          </div>
        ) : (
          <div className="coll-list">
            {ind.collections.map((c) => (
              <div className="coll" key={c.id}>
                <div className="coll-info">
                  <div className="coll-name">{baseName(c.root)}</div>
                  <div className="coll-meta">{c.file_count} file{c.file_count === 1 ? "" : "s"} · {c.status}</div>
                </div>
                <button
                  className={"chip-toggle" + (c.semantic ? " on" : "")}
                  title={c.semantic ? "Semantic search on" : "Semantic search off"}
                  onClick={() => { api.setSemantic(c.id, !c.semantic); setTimeout(ind.refresh, 300); }}
                >semantic</button>
                <button className="coll-btn" title="Reindex" onClick={() => { api.reindex(c.id); setTimeout(ind.refresh, 300); }}>↻</button>
                <button className="coll-btn danger" title="Remove from index" onClick={() => { api.removeCollection(c.id); setTimeout(ind.refresh, 400); }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
