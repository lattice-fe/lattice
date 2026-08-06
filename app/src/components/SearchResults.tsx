import { useMemo } from "react";
import { Search } from "../hooks/useSearch";
import { Explorer } from "../hooks/useExplorer";
import { api, Hit, SearchMode } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";

const MODES: SearchMode[] = ["name", "text", "semantic"];

export function SearchResults({ s, ex }: { s: Search; ex: Explorer }) {
  // Live-merge the current folder's entries into name-mode results, so files
  // added/removed since the last index are searchable immediately. Live hits
  // (what you're looking at) rank first; index hits fill in the rest.
  const results = useMemo(() => {
    const q = s.query.trim().toLowerCase();
    if (s.mode !== "name" || !q) return s.results;
    const live: Hit[] = ex.entries
      .filter((e) => e.name.toLowerCase().includes(q))
      .map((e) => ({ file_path: e.path, is_dir: e.is_dir, snippet: "", score: 1, char_start: 0 }));
    const seen = new Set(live.map((h) => h.file_path.toLowerCase()));
    return [...live, ...s.results.filter((h) => !seen.has(h.file_path.toLowerCase()))];
  }, [s.mode, s.query, s.results, ex.entries]);

  const body = () => {
    if (results.length === 0)
      return <div className="empty-note">{s.searching ? "Searching…" : `No matches for “${s.query.trim()}”`}</div>;
    return (
      <div className="list">
        {results.map((h, i) => {
          const name = baseName(h.file_path);
          const k = h.is_dir ? "folder" : kindOf(name);
          const t = TONE[k];
          const dir = parentOf(h.file_path);
          const snip = h.snippet && h.snippet.trim() && h.snippet.trim() !== name ? h.snippet.trim() : null;
          return (
            <button
              key={h.file_path + i}
              className="row result"
              style={{ animationDelay: `${Math.min(i * 16, 240)}ms` }}
              onClick={() => (h.is_dir ? ex.navigate(h.file_path) : dir && ex.navigate(dir))}
              onDoubleClick={() => (h.is_dir ? ex.navigate(h.file_path) : api.openPath(h.file_path))}
              title={h.is_dir ? "Open folder" : "Click to reveal · double-click to open"}
            >
              <span className="tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={k} /></span>
              <span className="result-main">
                <span className="label">{name}</span>
                {snip && <span className="snippet">{snip}</span>}
                <span className="result-path">{dir}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <main className="panel">
      <div className="hero">
        <div>
          <h1>Search</h1>
          <div className="meta">
            {s.searching && results.length === 0 ? "searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
            {" · "}
            <span className="mode-switch">
              {MODES.map((m) => (
                <button key={m} className={"mode-mini" + (s.mode === m ? " on" : "")} onClick={() => s.setMode(m)}>{m}</button>
              ))}
            </span>
          </div>
        </div>
      </div>
      {body()}
    </main>
  );
}
