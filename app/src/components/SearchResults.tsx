import { Search } from "../hooks/useSearch";
import { Explorer } from "../hooks/useExplorer";
import { api } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";

export function SearchResults({ s, ex }: { s: Search; ex: Explorer }) {
  const body = () => {
    if (s.results.length === 0)
      return <div className="empty-note">{s.searching ? "Searching…" : `No matches for “${s.query.trim()}”`}</div>;
    return (
      <div className="list">
        {s.results.map((h, i) => {
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
            {s.searching && s.results.length === 0 ? "searching…" : `${s.results.length} result${s.results.length === 1 ? "" : "s"}`}
            {" · "}<span style={{ color: "var(--terracotta)" }}>{s.mode}</span>
          </div>
        </div>
      </div>
      {body()}
    </main>
  );
}
