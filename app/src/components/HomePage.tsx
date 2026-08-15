import { useEffect, useMemo, useRef, useState } from "react";
import { Explorer } from "../hooks/useExplorer";
import { Hit, searchOnce } from "../lib/api";
import { baseName, parentOf, fmtWhen } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";
import { Activity, getActivity, groupActivity, ACTIVITY_EVENT } from "../lib/activity";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Small icon for a non-file activity type; file-ish types use the kind Glyph.
function ActivityIcon({ a }: { a: Activity }) {
  if (a.type === "search") {
    return (
      <span style={{ display: "inline-flex", color: "var(--amber)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </span>
    );
  }
  const k = a.type === "create" ? "folder" : kindOf(a.path || a.title);
  return <span style={{ display: "inline-flex", width: 15, height: 15, color: TONE[k].fg }}><Glyph kind={k} /></span>;
}

export function HomePage({ ex }: { ex: Explorer }) {
  const name = ex.homeDir ? cap(baseName(ex.homeDir)) : "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [activity, setActivity] = useState<Activity[]>(() => getActivity());

  // Refresh the timeline whenever an activity is logged.
  useEffect(() => {
    const sync = () => setActivity(getActivity());
    window.addEventListener(ACTIVITY_EVENT, sync);
    return () => window.removeEventListener(ACTIVITY_EVENT, sync);
  }, []);

  // Debounced inline index search (same index the CLI/Spotlight use).
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const hits = await searchOnce(q, "name");
      if (!cancelled) setResults(hits.slice(0, 12));
    }, 160);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const groups = useMemo(() => groupActivity(activity), [activity]);
  const pinned = ex.quick.slice(0, 6);
  const searching = query.trim().length > 0;

  const openHit = (h: Hit) => {
    // ex.openEntry logs the "open" activity itself.
    ex.openEntry({ name: baseName(h.file_path), path: h.file_path, is_dir: h.is_dir, size: 0, modified: null, kind: h.is_dir ? "folder" : kindOf(h.file_path), type_label: "", hidden: false });
  };

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="home-page">
      <h1 className="home-greeting">{greeting()}{name ? `, ${name}` : ""}</h1>

      <div className="home-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
          placeholder="Search files and folders by name…"
          spellCheck={false}
        />
        {searching && <button className="home-search-x" onClick={() => setQuery("")} title="Clear">×</button>}
      </div>

      {searching ? (
        <div className="home-results">
          {results.length === 0 ? (
            <div className="home-empty">No matches for “{query.trim()}”.</div>
          ) : (
            results.map((h) => {
              const k = h.is_dir ? "folder" : kindOf(h.file_path);
              return (
                <button key={h.file_path} className="home-result" onClick={() => openHit(h)}>
                  <span style={{ display: "inline-flex", width: 16, height: 16, color: TONE[k].fg }}><Glyph kind={k} /></span>
                  <span className="home-result-name">{baseName(h.file_path)}</span>
                  <span className="home-result-sub">{parentOf(h.file_path) ?? ""}</span>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="home-section">
              <div className="home-section-label">Pinned</div>
              <div className="home-pins">
                {pinned.map((q) => (
                  <button key={q.path} className="home-pin" onClick={() => ex.navigate(q.path)} title={q.path}>
                    <span className="home-pin-icon" style={{ color: TONE.folder.fg }}><Glyph kind="folder" /></span>
                    <span className="home-pin-name">{q.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="home-section">
            <div className="home-section-label">Lately</div>
            {groups.length === 0 ? (
              <div className="home-empty">Nothing yet — edit, open, or search for something and it’ll show up here.</div>
            ) : (
              groups.map((g) => (
                <div key={g.label} className="home-lately-group">
                  <div className="home-lately-when">{g.label}</div>
                  {g.items.map((a) => (
                    <div
                      key={a.id}
                      className={"home-lately-row" + (a.path ? " clickable" : "")}
                      onClick={a.path ? () => openHit({ file_path: a.path!, is_dir: a.type === "create", snippet: "", score: 0, char_start: 0 }) : undefined}
                    >
                      <span className="home-lately-icon"><ActivityIcon a={a} /></span>
                      <div className="home-lately-body">
                        <div className="home-lately-title">{a.title}</div>
                        {a.sub && <div className="home-lately-sub">{a.sub}</div>}
                      </div>
                      <span className="home-lately-time">{fmtWhen(a.ts)}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
