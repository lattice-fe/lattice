import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSearch } from "../hooks/useSearch";
import { api, SearchMode } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";

const MODES: SearchMode[] = ["name", "text", "semantic"];

export function Spotlight() {
  const s = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const win = getCurrentWindow();

  const hide = () => { s.clear(); win.hide(); };
  const openHit = (path: string) => { api.openPath(path); hide(); };

  useEffect(() => {
    inputRef.current?.focus();
    // focus on show; hide on blur (click-away), like a launcher
    const un = win.onFocusChanged(({ payload: focused }) => {
      if (focused) { inputRef.current?.focus(); inputRef.current?.select(); }
      else hide();
    });
    return () => { un.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); hide(); }
    else if (e.key === "Enter" && s.results[0]) { e.preventDefault(); openHit(s.results[0].file_path); }
  };

  const hits = s.results.slice(0, 8);

  return (
    <div className="spot">
      <div className="spot-search">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          value={s.query}
          onChange={(e) => s.setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search Lattice…"
          spellCheck={false}
        />
        <div className="spot-modes">
          {MODES.map((m) => (
            <button key={m} className={"mode" + (s.mode === m ? " on" : "")} onClick={() => s.setMode(m)}>{m}</button>
          ))}
        </div>
      </div>

      {s.active && (
        <div className="spot-results">
          {hits.length === 0 ? (
            <div className="spot-empty">{s.searching ? "Searching…" : "No matches"}</div>
          ) : (
            hits.map((h, i) => {
              const name = baseName(h.file_path);
              const t = TONE[kindOf(name)];
              const snip = h.snippet && h.snippet.trim() && h.snippet.trim() !== name ? h.snippet.trim() : parentOf(h.file_path);
              return (
                <button key={h.file_path + i} className={"spot-row" + (i === 0 ? " first" : "")} onClick={() => openHit(h.file_path)}>
                  <span className="tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={kindOf(name)} /></span>
                  <span className="spot-main">
                    <span className="spot-name">{name}</span>
                    <span className="spot-sub">{snip}</span>
                  </span>
                  {i === 0 && <span className="spot-enter">↵</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
