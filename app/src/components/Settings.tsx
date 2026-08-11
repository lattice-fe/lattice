import { useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Explorer } from "../hooks/useExplorer";
import { Indexer } from "../hooks/useIndexer";
import { ThemeApi } from "../hooks/useTheme";
import { Theme } from "../lib/theme/types";
import { api, isTauri } from "../lib/api";
import { baseName } from "../lib/format";
import { themeVars } from "../lib/theme/engine";
import { ThemeEditor } from "./ThemeEditor";
import { getAssistantConfig, saveAssistantConfig, AssistantConfig, ASSISTANT_EVENT } from "../lib/assistant/config";
import { askAssistant } from "../lib/assistant/client";

// Hover preview delay settings (localStorage keys)
const HOVER_DELAY_KEY = "lattice:hover-delay";
const PERSISTENCE_KEY = "lattice:preview-persistence";
const DISABLE_HOVER_KEY = "lattice:disable-hover";

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
type Section = "general" | "appearance" | "indexing" | "shortcuts" | "advanced";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
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
  { action: "Edit path", keys: "Ctrl + L" },
  { action: "Search", keys: "Ctrl + F" },
  { action: "Documentation", keys: "F1" },
  { action: "Select all", keys: "Ctrl + A" },
  { action: "Copy", keys: "Ctrl + C" },
  { action: "Cut", keys: "Ctrl + X" },
  { action: "Paste", keys: "Ctrl + V" },
  { action: "Rename", keys: "F2" },
  { action: "New file", keys: "Ctrl + N" },
  { action: "New folder", keys: "Ctrl + Shift + N" },
  { action: "Delete", keys: "Delete" },
  { action: "Open", keys: "Enter" },
  { action: "New tab", keys: "Ctrl + T" },
  { action: "Close tab", keys: "Ctrl + W" },
  { action: "Next tab", keys: "Ctrl + Tab" },
  { action: "Previous tab", keys: "Ctrl + Shift + Tab" },
  { action: "Spotlight", keys: "Alt + Space" },
  { action: "Save file (editor)", keys: "Ctrl + S" },
  { action: "Command palette (editor)", keys: "Ctrl + Shift + P" },
];

export function Settings({ ex, ind, th, onClose }: { ex: Explorer; ind: Indexer; th: ThemeApi; onClose: () => void }) {
  // editing: a theme to edit, "new" to fork the active one, or null
  const [editing, setEditing] = useState<Theme | "new" | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("general");

  // Sensitive preview settings
  const [neverBlur, setNeverBlur] = useState(() => localStorage.getItem(NEVER_BLUR_KEY) === "true");
  const [neverUnblur, setNeverUnblur] = useState(() => localStorage.getItem(NEVER_UNBLUR_KEY) === "true");
  const [blurPatterns, setBlurPatterns] = useState(() => localStorage.getItem(BLUR_PATTERNS_KEY) || "");

  // Startup animation setting (read at page load by index.html)
  const [startupAnim, setStartupAnim] = useState(() => localStorage.getItem("lattice:startup-animation") !== "off");
  const handleStartupAnimChange = () => {
    const next = !startupAnim;
    setStartupAnim(next);
    localStorage.setItem("lattice:startup-animation", next ? "on" : "off");
  };

  // Hover preview setting
  const [disableHover, setDisableHover] = useState(() => localStorage.getItem(DISABLE_HOVER_KEY) === "true");

  const handleDisableHoverChange = () => {
    const next = !disableHover;
    setDisableHover(next);
    localStorage.setItem(DISABLE_HOVER_KEY, String(next));
  };

  // Icon size setting
  const [iconSize, setIconSize] = useState(getIconSize);

  const handleIconSizeChange = (val: number) => {
    setIconSize(val);
    localStorage.setItem(ICON_SIZE_KEY, String(val));
    applyIconSize(val);
  };

  // Assistant configuration
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig>(getAssistantConfig);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const updateAssistantConfig = (patch: Partial<AssistantConfig>) => {
    const updated = { ...assistantConfig, ...patch };
    setAssistantConfig(updated);
    saveAssistantConfig(updated);
    if (isTauri) {
      emit(ASSISTANT_EVENT, updated).catch(() => {});
    }
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      await askAssistant("Say OK", assistantConfig);
      setTestStatus("success");
      setTestMessage("Connected successfully");
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage(err.message || "Connection failed");
    }
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
                <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <div>
                    <div className="setting-name">Shift-Open Mode</div>
                    <div className="setting-desc">Behavior when pressing Shift+Click or Shift+Enter on a file</div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                    <RadioOption
                      label="Side-by-Side Split Panel"
                      desc="Opens file in 50% split view"
                      checked={ex.openMode === "split"}
                      onClick={() => ex.setOpenMode("split")}
                    />
                    <RadioOption
                      label="New Explorer Tab"
                      desc="Opens file in a dedicated tab"
                      checked={ex.openMode === "tab"}
                      onClick={() => ex.setOpenMode("tab")}
                    />
                  </div>
                </div>
                <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <div>
                    <div className="setting-name">Default Home Directory</div>
                    <div className="setting-desc">Starting folder for new tabs and fresh application launches</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", width: "100%", boxSizing: "border-box" }}>
                    <input
                      type="text"
                      value={ex.homeDir}
                      onChange={(e) => ex.setHomeDir(e.target.value)}
                      placeholder="Default (OS Home Folder)"
                      style={{ flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: "6px", background: "var(--ink-3)", border: "1px solid var(--border)", color: "var(--paper)", fontFamily: "var(--mono)", fontSize: "12px" }}
                    />
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={async () => {
                        const folder = await api.selectFolder();
                        if (folder) ex.setHomeDir(folder);
                      }}
                      style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px", whiteSpace: "nowrap", flex: "none" }}
                    >
                      Browse…
                    </button>
                  </div>
                </div>
                <div className="setting-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div className="setting-name">Documentation & Guides</div>
                    <div className="setting-desc">Open feature guide, CLI reference, and keyboard shortcuts</div>
                  </div>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      onClose();
                      ex.openDocTab();
                    }}
                    style={{ padding: "6px 14px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                  >
                    Open Documentation
                  </button>
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
              {/* Startup */}
              <div className="setting-group" style={{ marginBottom: "24px" }}>
                <div className="settings-section-title">Startup</div>
                <div className="setting-row">
                  <div>
                    <div className="setting-name">Startup animation</div>
                    <div className="setting-desc">Play the splash lettermark animation on launch</div>
                  </div>
                  <Switch on={startupAnim} onClick={handleStartupAnimChange} />
                </div>
              </div>

              {/* Hover preview settings */}
              <div className="setting-group" style={{ marginBottom: "24px" }}>
                <div className="settings-section-title">Hover previews</div>
                <div className="setting-row" style={{ marginBottom: "12px" }}>
                  <div>
                    <div className="setting-name">Enable Hover Previews</div>
                    <div className="setting-desc">Show card hover preview peeks on mouse hover</div>
                  </div>
                  <Switch on={!disableHover} onClick={handleDisableHoverChange} />
                </div>
                {!disableHover && (
                  <>
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
                  </>
                )}
              </div>

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

              {/* Watson (Spotlight '!' quick queries) */}
              <div className="setting-group">
                <div className="settings-section-title">Watson</div>
                <div className="setting-desc" style={{ marginBottom: "14px" }}>
                  Configure the OpenAI-compatible API used for Watson instant Spotlight queries (! prefix)
                </div>

                <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px", marginBottom: "12px" }}>
                  <div className="setting-name">API Base URL</div>
                  <div className="setting-desc">Endpoint host (OpenAI, Omniroute, OpenRouter, Ollama, DeepSeek)</div>
                  <input
                    type="text"
                    value={assistantConfig.baseUrl}
                    onChange={(e) => updateAssistantConfig({ baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--paper)",
                      fontFamily: "var(--mono)",
                      fontSize: "12.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px", marginBottom: "12px" }}>
                  <div className="setting-name">Model name</div>
                  <div className="setting-desc">Model identifier to query</div>
                  <input
                    type="text"
                    value={assistantConfig.model}
                    onChange={(e) => updateAssistantConfig({ model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--paper)",
                      fontFamily: "var(--mono)",
                      fontSize: "12.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px", marginBottom: "14px" }}>
                  <div className="setting-name">API Key</div>
                  <div className="setting-desc">Bearer token for authorization</div>
                  <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={assistantConfig.apiKey}
                      onChange={(e) => updateAssistantConfig({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        color: "var(--paper)",
                        fontFamily: "var(--mono)",
                        fontSize: "12.5px",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="btn-outline"
                      style={{ padding: "8px 14px", fontSize: "12px", cursor: "pointer", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--ink-2)", color: "var(--paper)" }}
                    >
                      {showApiKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus === "testing" || !assistantConfig.apiKey.trim()}
                    style={{
                      padding: "7px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: !assistantConfig.apiKey.trim() ? "not-allowed" : "pointer",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--ink-2)",
                      color: "var(--paper)",
                      opacity: !assistantConfig.apiKey.trim() ? 0.5 : 1,
                    }}
                  >
                    {testStatus === "testing" ? "Testing..." : "Test connection"}
                  </button>

                  {testStatus === "success" && (
                    <span style={{ fontSize: "12px", color: "var(--teal, #2a9d8f)", fontWeight: 500 }}>
                      Connected successfully
                    </span>
                  )}
                  {testStatus === "error" && (
                    <span style={{ fontSize: "12px", color: "var(--danger, #c0392b)", fontWeight: 500 }}>
                      {testMessage}
                    </span>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
