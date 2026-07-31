import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { emit } from "@tauri-apps/api/event";
import { useSearch } from "../hooks/useSearch";
import { AppMatch, Kind, api, isTauri, SearchMode } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";
import { calc, fmtNum } from "../lib/math";

const MODES: SearchMode[] = ["name", "text", "semantic"];
type Mode = "default" | "apps" | "files" | "web" | "math" | "commands";
const PREFIX: Record<string, Mode> = { ">": "apps", "@": "files", "?": "web", "=": "math", "/": "commands" };
const BADGE: Record<Mode, string> = { default: "", apps: "Apps", files: "Files", web: "Web", math: "Math", commands: "Commands" };

type Item =
  | { kind: "app"; name: string; path: string }
  | { kind: "file"; name: string; sub: string; path: string; k: Kind; isDir: boolean }
  | { kind: "math"; value: number }
  | { kind: "web"; term: string }
  | { kind: "command"; name: string; sub: string; run: () => void };

const AppIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
const WebIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>);
const CmdIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m4 7 5 5-5 5M12 19h8" /></svg>);
const EqIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 9h14M5 15h14" /></svg>);

function fire(name: string, payload?: unknown) { if (isTauri) emit(name, payload).catch(() => {}); }

export function Spotlight() {
  const s = useSearch();
  const [raw, setRaw] = useState("");
  const [apps, setApps] = useState<AppMatch[]>([]);
  const [nav, setNav] = useState<{ name: string; path: string }[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const win = isTauri ? getCurrentWindow() : null;

  const p0 = raw[0] ?? "";
  const mode: Mode = PREFIX[p0] ?? "default";
  const term = mode === "default" ? raw : raw.slice(1).replace(/^\s+/, "");

  const hide = () => { setRaw(""); setApps([]); s.clear(); win?.hide(); };

  useEffect(() => {
    inputRef.current?.focus();
    api.quickAccess().then((q) => setNav(q.map((x) => ({ name: x.label, path: x.path }))));
    if (!win) return;
    const un = win.onFocusChanged(({ payload: focused }) => {
      if (focused) { inputRef.current?.focus(); inputRef.current?.select(); }
      else hide();
    });
    return () => { un.then((f) => f()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drive file search (index) with the stripped term
  const fileTerm = mode === "default" || mode === "files" ? term : "";
  useEffect(() => { s.setQuery(fileTerm); /* eslint-disable-next-line */ }, [fileTerm]);

  // drive app search
  const appTerm = mode === "default" || mode === "apps" ? term : "";
  useEffect(() => {
    const t = setTimeout(() => api.searchApps(appTerm).then(setApps).catch(() => setApps([])), 110);
    return () => clearTimeout(t);
  }, [appTerm]);

  // grow to fit
  useEffect(() => {
    if (!win || !spotRef.current) return;
    const el = spotRef.current;
    const ro = new ResizeObserver(() => { win.setSize(new LogicalSize(680, Math.ceil(el.offsetHeight) + 32)).catch(() => {}); });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commands = useMemo(() => [
    ...nav.map((n) => ({ name: `Go to ${n.name}`, sub: n.path, run: () => { fire("spotlight:navigate", n.path); api.showMain(); } })),
    { name: "Open Settings", sub: "Preferences", run: () => { fire("spotlight:open-settings"); api.showMain(); } },
    { name: "Show Lattice", sub: "Bring the window to front", run: () => api.showMain() },
    { name: "Quit Lattice", sub: "Exit the app", run: () => api.quit() },
  ], [nav]);

  const items: Item[] = useMemo(() => {
    if (mode === "math") { const v = calc(term); return v != null ? [{ kind: "math", value: v }] : []; }
    if (mode === "web") return term.trim() ? [{ kind: "web", term: term.trim() }] : [];
    if (mode === "commands") return commands.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())).map((c) => ({ kind: "command", name: c.name, sub: c.sub, run: c.run }));
    const a: Item[] = mode === "default" || mode === "apps" ? apps.map((x) => ({ kind: "app", name: x.name, path: x.path })) : [];
    const f: Item[] = mode === "default" || mode === "files"
      ? s.results.slice(0, 8).map((h) => { const name = baseName(h.file_path); const snip = h.snippet?.trim() && h.snippet.trim() !== name ? h.snippet.trim() : parentOf(h.file_path) ?? ""; return { kind: "file", name, sub: snip, path: h.file_path, k: h.is_dir ? "folder" : kindOf(name), isDir: h.is_dir }; })
      : [];
    return [...a, ...f];
  }, [mode, term, apps, s.results, commands]);

  useEffect(() => { setActive(0); }, [items.length, mode]);

  const run = (it: Item) => {
    if (it.kind === "app") api.openPath(it.path);
    else if (it.kind === "file") { if (it.isDir) { fire("spotlight:navigate", it.path); api.showMain(); } else api.openPath(it.path); }
    else if (it.kind === "web") api.openUrl(`https://www.google.com/search?q=${encodeURIComponent(it.term)}`);
    else if (it.kind === "math") navigator.clipboard?.writeText(String(it.value)).catch(() => {});
    else if (it.kind === "command") it.run();
    hide();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); hide(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); run(items[active]); }
  };

  const appCount = mode === "default" ? apps.length : 0;

  return (
    <div className="spot" ref={spotRef}>
      <div className="spot-search">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input ref={inputRef} value={raw} onChange={(e) => setRaw(e.target.value)} onKeyDown={onKey} placeholder="Search, or try  &gt; @ ? = /" spellCheck={false} />
        {mode === "default" || mode === "files" ? (
          <div className="spot-modes">{MODES.map((m) => <button key={m} className={"mode" + (s.mode === m ? " on" : "")} onClick={() => s.setMode(m)}>{m}</button>)}</div>
        ) : (
          <div className="spot-badge">{BADGE[mode]}</div>
        )}
      </div>

      {raw.trim() === "" ? (
        <div className="spot-hints">
          <span><b>&gt;</b> apps</span><span><b>@</b> files</span><span><b>=</b> math</span><span><b>?</b> web</span><span><b>/</b> commands</span>
        </div>
      ) : (
        <div className="spot-results">
          {items.length === 0 ? (
            <div className="spot-empty">{s.searching ? "Searching…" : "No matches"}</div>
          ) : (
            items.map((it, i) => {
              const showApps = mode === "default" && it.kind === "app" && i === 0;
              const showFiles = mode === "default" && it.kind === "file" && i === appCount;
              let tile: React.ReactNode, bg = "#26221d", fg = "#a99f8e", name = "", sub = "";
              if (it.kind === "app") { tile = <AppIcon />; bg = "#331f14"; fg = "#d8794a"; name = it.name; sub = "Application"; }
              else if (it.kind === "file") { tile = <Glyph kind={it.k} />; bg = TONE[it.k].bg; fg = TONE[it.k].fg; name = it.name; sub = it.sub; }
              else if (it.kind === "web") { tile = <WebIcon />; bg = "#22271f"; fg = "#9db98a"; name = `Search the web for “${it.term}”`; sub = "Opens in your browser"; }
              else if (it.kind === "math") { tile = <EqIcon />; bg = "#33260f"; fg = "#E2A64C"; name = fmtNum(it.value); sub = "Copy to clipboard"; }
              else { tile = <CmdIcon />; bg = "#282132"; fg = "#b199d6"; name = it.name; sub = it.sub; }
              return (
                <div key={it.kind + i}>
                  {showApps && <div className="spot-sec">Applications</div>}
                  {showFiles && appCount > 0 && <div className="spot-sec">Files</div>}
                  <button className={"spot-row" + (i === active ? " active" : "")} onMouseMove={() => setActive(i)} onClick={() => run(it)}>
                    <span className="tile" style={{ background: bg, color: fg }}>{tile}</span>
                    <span className="spot-main">
                      <span className={"spot-name" + (it.kind === "math" ? " mono" : "")}>{name}</span>
                      <span className="spot-sub">{sub}</span>
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
