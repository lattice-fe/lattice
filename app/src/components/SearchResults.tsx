import { Search } from "../hooks/useSearch";
import { Explorer } from "../hooks/useExplorer";
import { api, Kind } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE } from "../lib/icons";

const kindOf = (name: string): Kind => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "image";
  if (["mp4", "mkv", "mov", "webm", "avi", "wmv"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["rs", "ts", "tsx", "js", "jsx", "py", "go", "json", "toml", "yaml", "yml", "html", "css", "c", "cpp", "h", "java"].includes(ext)) return "code";
  if (["pdf", "md", "txt", "doc", "docx", "csv", "rtf"].includes(ext)) return "document";
  if (["exe", "msi", "bat"].includes(ext)) return "executable";
  return "other";
};

export function SearchResults({ s, ex }: { s: Search; ex: Explorer }) {
  const body = () => {
    if (s.results.length === 0)
      return <div className="empty-note">{s.searching ? "Searching…" : `No matches for “${s.query.trim()}”`}</div>;
    return (
      <div className="list">
        {s.results.map((h, i) => {
          const name = baseName(h.file_path);
          const k = kindOf(name);
          const t = TONE[k];
          const dir = parentOf(h.file_path);
          const snip = h.snippet && h.snippet.trim() && h.snippet.trim() !== name ? h.snippet.trim() : null;
          return (
            <button
              key={h.file_path + i}
              className="row result"
              style={{ animationDelay: `${Math.min(i * 16, 240)}ms` }}
              onClick={() => dir && ex.navigate(dir)}
              onDoubleClick={() => api.openPath(h.file_path)}
              title="Click to reveal · double-click to open"
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
