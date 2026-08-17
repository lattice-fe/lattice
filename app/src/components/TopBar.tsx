import { useState, useRef, useEffect, useCallback } from "react";
import { Explorer } from "../hooks/useExplorer";
import { Search } from "../hooks/useSearch";
import { baseName, crumbsOf, parentOf } from "../lib/format";
import { api, Entry } from "../lib/api";
import { logActivity } from "../lib/activity";

const I = {
  back: <path d="M15 18l-6-6 6-6" />,
  fwd: <path d="M9 18l6-6-6-6" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  refresh: <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />,
};
const Ico = ({ d, w = 17 }: { d: React.ReactNode; w?: number }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

import { SearchDropdown } from "./SearchDropdown";
import { Glyph, TONE, kindOf } from "../lib/icons";

type Match = { name: string; isDir: boolean };
type Sug = Match & { path: string };

export function TopBar({
  ex,
  s,
  onSettings,
  onToggleSidebar,
  sidebarOpen,
  onToggleChat,
  chatOpen,
  aiPaneEnabled,
}: {
  ex: Explorer;
  s: Search;
  onSettings: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onToggleChat?: () => void;
  chatOpen?: boolean;
  aiPaneEnabled?: boolean;
}) {
  const crumbs = ex.path ? crumbsOf(ex.path) : [];

  // Editable path field: click empty crumb space (or Ctrl+L) to type any path
  // (incl. docs/keep). Live folder + file suggestions; Tab completes/cycles.
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [sug, setSug] = useState<Sug[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const comp = useRef<{ base: string; matches: Match[]; idx: number; last: string }>({ base: "", matches: [], idx: 0, last: "" });

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const startEdit = () => { setValue(ex.path); setInvalid(false); comp.current = { base: "", matches: [], idx: 0, last: "" }; setEditing(true); };

  // Ctrl+L (address-bar convention) enters path edit; App dispatches the event.
  useEffect(() => {
    const open = () => startEdit();
    window.addEventListener("lattice-edit-path", open);
    return () => window.removeEventListener("lattice-edit-path", open);
  }, [ex.path]);

  // Entries under the value's parent dir whose name matches the trailing segment.
  // Folders first (they append "/" and drill deeper); files open on select.
  const dirMatches = useCallback(async (v: string): Promise<{ base: string; items: Match[] }> => {
    const norm = v.replace(/\\/g, "/");
    const ends = norm.endsWith("/");
    const dir = ends ? (/^[A-Za-z]:\/$/.test(norm) ? norm : norm.replace(/\/+$/, "")) : (parentOf(norm) ?? "");
    const prefix = ends ? "" : baseName(norm);
    if (!dir) return { base: "", items: [] };
    let list: Entry[] = [];
    try { list = await api.listDir(dir, ex.showHidden); } catch { return { base: "", items: [] }; }
    const p = prefix.toLowerCase();
    const items = list
      .filter((e) => e.name.toLowerCase().startsWith(p))
      .map((e) => ({ name: e.name, isDir: e.is_dir }))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return { base: dir + (dir.endsWith("/") ? "" : "/"), items };
  }, [ex.showHidden]);

  const pathOf = (base: string, m: Match) => base + m.name + (m.isDir ? "/" : "");

  // Live suggestion dropdown, debounced.
  useEffect(() => {
    if (!editing) { setSug([]); return; }
    let cancelled = false;
    const id = setTimeout(async () => {
      const { base, items } = await dirMatches(value);
      if (!cancelled) setSug(items.slice(0, 12).map((it) => ({ ...it, path: pathOf(base, it) })));
    }, 120);
    return () => { cancelled = true; clearTimeout(id); };
  }, [value, editing, dirMatches]);

  // Absolute-path shapes we accept: drive (C:\ / C:/), unix root, UNC, or ~.
  const looksLikePath = (p: string) => /^[A-Za-z]:/.test(p) || p.startsWith("/") || p.startsWith("\\\\") || p.startsWith("~");

  const commit = () => {
    let t = value.trim();
    if (!t) { setEditing(false); return; }
    // A bare drive letter ("d:") is drive-relative — make it the drive root ("d:/").
    if (/^[A-Za-z]:$/.test(t)) t += "/";
    const l = t.toLowerCase();
    const special =
      l === "home" || l === "lattice://home" ? "lattice://home" :
      l === "docs" || l === "lattice://docs" ? "lattice://docs" :
      l === "keep" || l === "lattice://keep" ? "lattice://keep" : null;
    if (special) { ex.navigate(special); setEditing(false); return; }
    // Junk that isn't a route or a real path shape — don't even try to open it.
    if (!looksLikePath(t)) { setInvalid(true); return; }
    ex.navigate(t);
    setEditing(false);
  };

  const complete = async () => {
    const c = comp.current;
    if (c.matches.length && value === c.last) {            // repeat Tab → cycle siblings
      c.idx = (c.idx + 1) % c.matches.length;
    } else {
      const { base, items } = await dirMatches(value);
      if (!items.length) return;
      c.base = base; c.matches = items; c.idx = 0;
    }
    const nv = pathOf(c.base, c.matches[c.idx]);
    c.last = nv;
    setValue(nv);
  };

  const applySuggestion = (s: Sug) => {
    if (s.isDir) {                       // folder → fill and keep editing to drill deeper
      setValue(s.path);
      comp.current = { base: "", matches: [], idx: 0, last: "" };
      inputRef.current?.focus();
    } else {                             // file → open it
      setEditing(false);
      ex.navigate(s.path);
    }
  };

  const onPathKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
    else if (e.key === "Tab") { e.preventDefault(); complete(); }
  };

  return (
    <div className="topbar">
      <div className="nav">
        {onToggleSidebar && (
          <button
            className={"iconbtn" + (sidebarOpen ? " active" : "")}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            onClick={onToggleSidebar}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <button className="iconbtn" title="Back" disabled={!ex.canBack} onClick={ex.back}><Ico d={I.back} /></button>
        <button className="iconbtn" title="Forward" disabled={!ex.canForward} onClick={ex.forward}><Ico d={I.fwd} /></button>
        <button className="iconbtn" title="Up" disabled={!ex.canUp} onClick={ex.up}><Ico d={I.up} /></button>
        <button className="iconbtn" title="Refresh" onClick={ex.refresh}><Ico d={I.refresh} w={16} /></button>
      </div>
      <div
        className="crumbs"
        title={editing ? undefined : "Click to type a path"}
        onClick={(e) => { if (!editing && e.target === e.currentTarget) startEdit(); }}
      >
        {editing ? (
          <div className="crumb-edit">
            <input
              ref={inputRef}
              className={"crumb-input" + (invalid ? " invalid" : "")}
              value={value}
              onChange={(e) => { setValue(e.target.value); if (invalid) setInvalid(false); }}
              onKeyDown={onPathKey}
              onBlur={() => setEditing(false)}
              spellCheck={false}
              autoComplete="off"
              placeholder="Type a path or docs / keep…"
            />
            {sug.length > 0 && (
              <div className="crumb-suggest">
                {sug.map((s) => {
                  const k = s.isDir ? "folder" : kindOf(s.name);
                  const t = TONE[k];
                  return (
                    <button
                      key={s.path}
                      type="button"
                      className={"crumb-suggest-item" + (s.isDir ? "" : " file")}
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: t.fg, flexShrink: 0 }}>
                        <Glyph kind={k} />
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name}{s.isDir ? "/" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          crumbs.map(([label, full], i) => (
            <span key={full} style={{ display: "contents" }}>
              <button
                className={"crumb" + (i === crumbs.length - 1 ? " here" : "")}
                onClick={() => ex.navigate(full)}
              >{label.replace(/\/$/, "") || baseName(full)}</button>
              {i < crumbs.length - 1 && <span className="crumb-sep">/</span>}
            </span>
          ))
        )}
      </div>
      <div className="search" style={{ position: "relative" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          value={s.query}
          onChange={(e) => s.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") s.clear();
            else if (e.key === "Enter" && s.query.trim()) {
              logActivity({ type: "search", title: `Searched “${s.query.trim()}”`, sub: `${s.mode[0].toUpperCase() + s.mode.slice(1)} · ${s.results.length} result${s.results.length === 1 ? "" : "s"}` });
            }
          }}
          placeholder="Search this index…"
        />
        {s.active && <button className="search-x" onClick={s.clear} title="Clear">×</button>}
        <SearchDropdown s={s} ex={ex} />
      </div>
      {onToggleChat && aiPaneEnabled && (
        <button
          className={"iconbtn" + (chatOpen ? " active" : "")}
          title={chatOpen ? "Close watson chat" : "Open watson chat"}
          onClick={onToggleChat}
          style={{ width: "auto", padding: "0 9px", height: "32px", display: "inline-flex", alignItems: "center", gap: "5px" }}
        >
          <span style={{ fontFamily: "'Syne Mono', monospace, var(--mono)", fontSize: "12px", fontWeight: 600, color: chatOpen ? "var(--amber)" : "var(--dim)" }}>
            watson
          </span>
        </button>
      )}
      <button className="iconbtn" title="Settings" onClick={onSettings}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.7 8a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V8a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></button>
    </div>
  );
}
