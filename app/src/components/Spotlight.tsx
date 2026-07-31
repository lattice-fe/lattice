import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useSearch } from "../hooks/useSearch";
import { AppMatch, api, isTauri, SearchMode } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";

const MODES: SearchMode[] = ["name", "text", "semantic"];

type Item =
  | { kind: "app"; name: string; path: string }
  | { kind: "file"; name: string; sub: string; path: string; k: ReturnType<typeof kindOf> };

const AppIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export function Spotlight() {
  const s = useSearch();
  const [apps, setApps] = useState<AppMatch[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const win = isTauri ? getCurrentWindow() : null;

  const hide = () => { s.clear(); setApps([]); win?.hide(); };

  // focus on show, hide on blur
  useEffect(() => {
    inputRef.current?.focus();
    if (!win) return;
    const un = win.onFocusChanged(({ payload: focused }) => {
      if (focused) { inputRef.current?.focus(); inputRef.current?.select(); }
      else hide();
    });
    return () => { un.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // app search (debounced alongside file search)
  useEffect(() => {
    const q = s.query;
    const t = setTimeout(() => { api.searchApps(q).then(setApps).catch(() => setApps([])); }, 120);
    return () => clearTimeout(t);
  }, [s.query, s.mode]);

  // resize the window to fit content (compact → grows with results)
  useEffect(() => {
    if (!win || !spotRef.current) return;
    const el = spotRef.current;
    const ro = new ResizeObserver(() => {
      win.setSize(new LogicalSize(680, Math.ceil(el.offsetHeight) + 32)).catch(() => {});
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: Item[] = useMemo(() => {
    const a: Item[] = apps.map((x) => ({ kind: "app", name: x.name, path: x.path }));
    const f: Item[] = s.results.slice(0, 8).map((h) => {
      const name = baseName(h.file_path);
      const snip = h.snippet?.trim() && h.snippet.trim() !== name ? h.snippet.trim() : (parentOf(h.file_path) ?? "");
      return { kind: "file", name, sub: snip, path: h.file_path, k: kindOf(name) };
    });
    return [...a, ...f];
  }, [apps, s.results]);

  useEffect(() => { setActive(0); }, [items.length]);

  const run = (it: Item) => { api.openPath(it.path); hide(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); hide(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); run(items[active]); }
  };

  const appCount = apps.length;

  return (
    <div className="spot" ref={spotRef}>
      <div className="spot-search">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input ref={inputRef} value={s.query} onChange={(e) => s.setQuery(e.target.value)} onKeyDown={onKey} placeholder="Search files, folders & apps…" spellCheck={false} />
        <div className="spot-modes">
          {MODES.map((m) => <button key={m} className={"mode" + (s.mode === m ? " on" : "")} onClick={() => s.setMode(m)}>{m}</button>)}
        </div>
      </div>

      {s.active && (
        <div className="spot-results">
          {items.length === 0 ? (
            <div className="spot-empty">{s.searching ? "Searching…" : "No matches"}</div>
          ) : (
            items.map((it, i) => {
              const isApp = it.kind === "app";
              const t = isApp ? { bg: "#331f14", fg: "#d8794a" } : TONE[it.k];
              const showAppLabel = isApp && i === 0;
              const showFileLabel = !isApp && i === appCount;
              return (
                <div key={it.path + i}>
                  {showAppLabel && <div className="spot-sec">Applications</div>}
                  {showFileLabel && appCount > 0 && <div className="spot-sec">Files</div>}
                  <button className={"spot-row" + (i === active ? " active" : "")} onMouseMove={() => setActive(i)} onClick={() => run(it)}>
                    <span className="tile" style={{ background: t.bg, color: t.fg }}>{isApp ? <AppIcon /> : <Glyph kind={it.k} />}</span>
                    <span className="spot-main">
                      <span className="spot-name">{it.name}</span>
                      <span className="spot-sub">{isApp ? "Application" : it.sub}</span>
                    </span>
                    {i === active && <span className="spot-enter">↵</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
