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

// Sensitive preview settings (localStorage keys)
const NEVER_BLUR_KEY = "lattice:never-blur";
const NEVER_UNBLUR_KEY = "lattice:never-unblur";
const BLUR_PATTERNS_KEY = "lattice:blur-patterns";

const ICON_SIZE_KEY = "lattice:icon-size";

function getIconSize(): number {
  try { return parseInt(localStorage.getItem(ICON_SIZE_KEY) || "100", 10); } catch { return 100; }
}

export function applyIconSize(val: number) {
  document.documentElement.style.setProperty("--icon-scale", String(val / 100));
}

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

// Radio option for mutually exclusive settings
function RadioOption({ label, desc, checked, onClick }: { label: string; desc?: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      className={"radio-option" + (checked ? " checked" : "")}
      onClick={onClick}
      style={{ textAlign: "left", width: "100%" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="radio-circle">{checked && <span />}</div>
        <div>
          <div className="setting-name">{label}</div>
          {desc && <div className="setting-desc">{desc}</div>}
        </div>
      </div>
    </button>
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

  // Sensitive preview settings
  const [neverBlur, setNeverBlur] = useState(() => localStorage.getItem(NEVER_BLUR_KEY) === "true");
  const [neverUnblur, setNeverUnblur] = useState(() => localStorage.getItem(NEVER_UNBLUR_KEY) === "true");
  const [blurPatterns, setBlurPatterns] = useState(() => localStorage.getItem(BLUR_PATTERNS_KEY) || "");

  // Icon size setting
  const [iconSize, setIconSize] = useState(getIconSize);

  const handleIconSizeChange = (val: number) => {
    setIconSize(val);
    localStorage.setItem(ICON_SIZE_KEY, String(val));
    applyIconSize(val);
  };

  // Handle blur mode change (mutually exclusive with never unblur)
  const handleBlurModeChange = (mode: "blur" | "neverBlur") => {
    if (mode === "neverBlur") {
      setNeverBlur(true);
      setNeverUnblur(false);
      localStorage.setItem(NEVER_BLUR_KEY, "true");
      localStorage.setItem(NEVER_UNBLUR_KEY, "false");
    } else {
      setNeverBlur(false);
      localStorage.setItem(NEVER_BLUR_KEY, "false");
    }
  };


  // Handle patterns change
  const handlePatternsChange = (value: string) => {
    setBlurPatterns(value);
    localStorage.setItem(BLUR_PATTERNS_KEY, value);
  };

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
                <NumberSlider
                  label="Icon size"
                  desc="Adjust display size of file and folder icons"
                  value={iconSize}
                  onChange={handleIconSizeChange}
                  min={75}
                  max={150}
                  step={5}
                  suffix="%"
                />
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

            {/* Advanced */}
            <section className={activeSection === "advanced" ? "active" : ""}>
              {/* Sensitive preview settings */}
              <div className="setting-group">
                <div className="settings-section-title">Sensitive preview</div>
                <div className="setting-desc" style={{ marginBottom: "12px" }}>
                  Control how sensitive files (env, credentials) are displayed in previews
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <RadioOption
                    label="Blur by default"
                    desc="Blur sensitive files; hover to unblur"
                    checked={!neverBlur && !neverUnblur}
                    onClick={() => { setNeverBlur(false); setNeverUnblur(false); localStorage.setItem(NEVER_BLUR_KEY, "false"); localStorage.setItem(NEVER_UNBLUR_KEY, "false"); }}
                  />
                  <RadioOption
                    label="Never blur"
                    desc="Show sensitive files normally (screen recording caution!)"
                    checked={neverBlur}
                    onClick={() => handleBlurModeChange("neverBlur")}
                  />
                  <RadioOption
                    label="Blur and never unblur"
                    desc="Blur sensitive files; hover does not unblur"
                    checked={neverUnblur}
                    onClick={() => { setNeverBlur(false); setNeverUnblur(true); localStorage.setItem(NEVER_BLUR_KEY, "false"); localStorage.setItem(NEVER_UNBLUR_KEY, "true"); }}
                  />
                </div>

                <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                  <div>
                    <div className="setting-name">Additional blur patterns</div>
                    <div className="setting-desc">Comma-separated regex patterns for files to blur (e.g. "password, secret, api_key")</div>
                  </div>
                  <input
                    type="text"
                    value={blurPatterns}
                    onChange={(e) => handlePatternsChange(e.target.value)}
                    placeholder="password, secret, api_key, ..."
                    disabled={neverBlur}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: neverBlur ? "var(--ink-3)" : "var(--card)",
                      color: "var(--paper)",
                      fontFamily: "var(--mono)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      opacity: neverBlur ? 0.5 : 1,
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
