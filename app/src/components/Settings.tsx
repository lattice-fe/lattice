import { useState } from "react";
import { Explorer } from "../hooks/useExplorer";
import { Indexer } from "../hooks/useIndexer";
import { ThemeApi } from "../hooks/useTheme";
import { Theme } from "../lib/theme/types";
import { api } from "../lib/api";
import { baseName } from "../lib/format";
import { themeVars } from "../lib/theme/engine";
import { ThemeEditor } from "./ThemeEditor";

// Hover preview delay settings (localStorage keys)
const HOVER_DELAY_KEY = "lattice:hover-delay";
const PERSISTENCE_KEY = "lattice:preview-persistence";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className={"switch" + (on ? " on" : "")} onClick={onClick} role="switch" aria-checked={on}><span /></button>;
}

function NumberSlider({ label, desc, value, onChange, min, max, step, suffix = "" }: { label: string; desc?: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string }) {
  return (
    <div className="setting-row" style={{ alignItems: "flex-start" }}>
      <div>
        <div className="setting-name">{label} · {value}{suffix}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      <div style={{ width: 120 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--terracotta)" }}
        />
      </div>
    </div>
  );
}

// Get persisted delay values from localStorage with defaults
function getHoverDelay(): number {
  try { return parseInt(localStorage.getItem(HOVER_DELAY_KEY) || "550", 10); } catch { return 550; }
}
function getPersistence(): number {
  try { return parseInt(localStorage.getItem(PERSISTENCE_KEY) || "250", 10); } catch { return 250; }
}

// Settings sections for navigation
type Section = "general" | "appearance" | "hover" | "indexing" | "shortcuts" | "advanced";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "hover", label: "Hover preview" },
  { id: "indexing", label: "Indexing" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "advanced", label: "Advanced" },
];

// Keyboard shortcuts reference
const KEYBINDS: { action: string; keys: string }[] = [
  { action: "Navigate back", keys: "Alt + ←" },
  { action: "Navigate forward", keys: "Alt + →" },
  { action: "Go up", keys: "Backspace" },
  { action: "Refresh", keys: "F5" },
  { action: "Select all", keys: "Ctrl + A" },
  { action: "Copy", keys: "Ctrl + C" },
  { action: "Cut", keys: "Ctrl + X" },
  { action: "Paste", keys: "Ctrl + V" },
  { action: "Rename", keys: "F2" },
  { action: "New folder", keys: "Ctrl + Shift + N" },
  { action: "Delete", keys: "Delete" },
  { action: "Open", keys: "Enter" },
  { action: "New tab", keys: "Ctrl + T" },
  { action: "Close tab", keys: "Ctrl + W" },
  { action: "Next tab", keys: "Ctrl + Tab" },
  { action: "Previous tab", keys: "Ctrl + Shift + Tab" },
  { action: "Spotlight", keys: "Alt + Space" },
];

export function Settings({ ex, ind, th, onClose }: { ex: Explorer; ind: Indexer; th: ThemeApi; onClose: () => void }) {
  // editing: a theme to edit, "new" to fork the active one, or null
  const [editing, setEditing] = useState<Theme | "new" | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("general");

  if (editing) {
    return <ThemeEditor th={th} base={editing === "new" ? th.theme : editing} isNew={editing === "new"} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="modal-x" onClick={onClose} title="Close">×</button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Side navigation */}
          <nav className="settings-nav">
            {SECTIONS.map((s) => (
              <button key={s.id} className={activeSection === s.id ? "active" : ""} onClick={() => setActiveSection(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content area */}
          <div className="settings-content">
            {/* General */}
            <section className={activeSection === "general" ? "active" : ""}>
              <div className="setting-group">
                <div className="setting-row">
                  <div>
                    <div className="setting-name">Show hidden files</div>
                    <div className="setting-desc">Reveal dotfiles and system-hidden items</div>
                  </div>
                  <Switch on={ex.showHidden} onClick={ex.toggleHidden} />
                </div>
              </div>
            </section>

            {/* Appearance */}
            <section className={activeSection === "appearance" ? "active" : ""}>
              <div className="setting-group">
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
              </div>
            </section>

            {/* Hover preview */}
            <section className={activeSection === "hover" ? "active" : ""}>
              <div className="setting-group">
                <NumberSlider
                  label="Hover delay"
                  desc="How long to hover before preview appears"
                  value={getHoverDelay()}
                  onChange={(v) => localStorage.setItem(HOVER_DELAY_KEY, String(v))}
                  min={100}
                  max={2000}
                  step={50}
                  suffix="ms"
                />
                <NumberSlider
                  label="Persistence"
                  desc="How long preview stays after cursor leaves"
                  value={getPersistence()}
                  onChange={(v) => localStorage.setItem(PERSISTENCE_KEY, String(v))}
                  min={50}
                  max={1000}
                  step={25}
                  suffix="ms"
                />
              </div>
            </section>

            {/* Indexing */}
            <section className={activeSection === "indexing" ? "active" : ""}>
              <div className="setting-group">
                <div className="setting-row" style={{ marginBottom: "16px" }}>
                  <div>
                    <div className="setting-name">Indexed folders</div>
                    <div className="setting-desc">Folders included in search indexing</div>
                  </div>
                  <button className="btn-soft" onClick={async () => { const path = await api.selectFolder(); if (path) { api.indexFolder(path); setTimeout(ind.refresh, 400); } }}>
                    + Add folder
                  </button>
                </div>
                {ind.collections.length === 0 ? (
                  <div className="setting-desc" style={{ padding: "2px 2px 6px" }}>
                    No folders indexed yet. Click <b style={{ color: "var(--paper-dim)" }}>+ Add folder</b> to get started.
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
            </section>

            {/* Keybinds */}
            <section className={activeSection === "shortcuts" ? "active" : ""}>
              <div className="setting-group">
                <div className="settings-section-title">Keyboard shortcuts</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 24px", maxWidth: "520px" }}>
                  {KEYBINDS.map((kb) => (
                    <div key={kb.keys} style={{ display: "contents" }}>
                      <span style={{ color: "var(--paper-dim)", padding: "7px 0", fontSize: "13px" }}>{kb.action}</span>
                      <kbd style={{ color: "var(--paper)", fontFamily: "var(--mono)", fontSize: "12px", background: "var(--ink-3)", padding: "5px 10px", borderRadius: "var(--radius-sm)", textAlign: "center", border: "1px solid var(--border-soft)" }}>{kb.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Advanced (placeholder) */}
            <section className={activeSection === "advanced" ? "active" : ""}>
              <div className="setting-group">
                <div className="setting-desc" style={{ fontStyle: "italic" }}>
                  Advanced settings coming soon...
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
