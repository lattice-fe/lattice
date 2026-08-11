import { useState, useRef, useEffect } from "react";
import { Explorer } from "../hooks/useExplorer";
import { Search } from "../hooks/useSearch";
import { baseName, crumbsOf, parentOf } from "../lib/format";
import { api, Entry } from "../lib/api";

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

export function TopBar({
  ex,
  s,
  onSettings,
  onToggleSidebar,
  sidebarOpen,
}: {
  ex: Explorer;
  s: Search;
  onSettings: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}) {
  const crumbs = ex.path ? crumbsOf(ex.path) : [];

  // Editable path field: click empty crumb space to type any path (incl. docs/keep), Tab to complete.
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const comp = useRef<{ dir: string; matches: string[]; idx: number; last: string }>({ dir: "", matches: [], idx: 0, last: "" });

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const startEdit = () => { setValue(ex.path); comp.current = { dir: "", matches: [], idx: 0, last: "" }; setEditing(true); };

  // Ctrl+L (address-bar convention) enters path edit; App dispatches the event.
  useEffect(() => {
    const open = () => startEdit();
    window.addEventListener("lattice-edit-path", open);
    return () => window.removeEventListener("lattice-edit-path", open);
  }, [ex.path]);

  const commit = () => {
    const t = value.trim();
    setEditing(false);
    if (!t) return;
    const l = t.toLowerCase();
    const dest =
      l === "docs" || l === "lattice://docs" ? "lattice://docs" :
      l === "keep" || l === "lattice://keep" ? "lattice://keep" : t;
    ex.navigate(dest);
  };

  const complete = async () => {
    const c = comp.current;
    if (c.matches.length && value === c.last) {            // repeat Tab → cycle siblings
      c.idx = (c.idx + 1) % c.matches.length;
    } else {
      const norm = value.replace(/\\/g, "/");
      const ends = norm.endsWith("/");
      const dir = ends ? (/^[A-Za-z]:\/$/.test(norm) ? norm : norm.replace(/\/+$/, "")) : (parentOf(norm) ?? "");
      const prefix = ends ? "" : baseName(norm);
      let list: Entry[] = [];
      try { list = await api.listDir(dir, ex.showHidden); } catch { return; }
      const matches = list.filter((e) => e.is_dir && e.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .map((e) => e.name).sort((a, b) => a.localeCompare(b));
      if (!matches.length) return;
      c.dir = dir; c.matches = matches; c.idx = 0;
    }
    const nv = c.dir + (c.dir.endsWith("/") ? "" : "/") + c.matches[c.idx] + "/";
    c.last = nv;
    setValue(nv);
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
          <input
            ref={inputRef}
            className="crumb-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onPathKey}
            onBlur={() => setEditing(false)}
            spellCheck={false}
            autoComplete="off"
            placeholder="Type a path or docs / keep…"
          />
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
          onKeyDown={(e) => { if (e.key === "Escape") s.clear(); }}
          placeholder="Search this index…"
        />
        {s.active && <button className="search-x" onClick={s.clear} title="Clear">×</button>}
        <SearchDropdown s={s} ex={ex} />
      </div>
      <button className="iconbtn" title="Settings" onClick={onSettings}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.7 8a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V8a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></button>
    </div>
  );
}
