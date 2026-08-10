import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow, Effect } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { emit, listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearch } from "../hooks/useSearch";
import { AppMatch, Kind, api, isTauri, SearchMode } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";
import { calc, fmtNum } from "../lib/math";
import { asUrl, webSearchUrl } from "../lib/url";
import { getAssistantConfig, AssistantConfig, ASSISTANT_EVENT } from "../lib/assistant/config";
import { askAssistant } from "../lib/assistant/client";
import { searchNotes } from "../lib/keep/store";
import { Note } from "../lib/keep/types";

const MODES: SearchMode[] = ["name", "text", "semantic"];
type Mode = "default" | "apps" | "files" | "web" | "math" | "commands" | "assistant";
const PREFIX: Record<string, Mode> = { ">": "apps", "@": "files", "?": "web", "=": "math", "/": "commands", "!": "assistant" };
const BADGE: Record<Mode, string> = { default: "", apps: "Apps", files: "Files", web: "Web", math: "Math", commands: "Commands", assistant: "Watson" };

// `@kind query` filters — mirror the `lat` CLI. code/doc/folder are index-backed;
// image/audio/video/archive aren't indexed, so they return nothing here (the CLI
// walks the filesystem for those).
const KINDS: Record<string, Kind> = {
  image: "image", img: "image", code: "code", doc: "document", document: "document",
  folder: "folder", dir: "folder", audio: "audio", video: "video", archive: "archive",
};
const KIND_LABEL: Partial<Record<Kind, string>> = {
  image: "Images", code: "Code", document: "Docs", folder: "Folders",
  audio: "Audio", video: "Video", archive: "Archives",
};

type Item =
  | { kind: "app"; name: string; path: string }
  | { kind: "file"; name: string; sub: string; path: string; k: Kind; isDir: boolean }
  | { kind: "note"; note: Note; run: () => void }
  | { kind: "math"; value: number }
  | { kind: "web"; term: string; url: string | null }
  | { kind: "command"; name: string; sub: string; run: () => void };

const AppIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
const WebIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>);
const CmdIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m4 7 5 5-5 5M12 19h8" /></svg>);
const EqIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 9h14M5 15h14" /></svg>);
const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "4px" }}>
    <path d="M7 17L17 7M7 7h10v10" />
  </svg>
);

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

  // Assistant state
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig>(getAssistantConfig);
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantCopied, setAssistantCopied] = useState(false);
  const [assistantElapsedMs, setAssistantElapsedMs] = useState(0);
  const [assistantLatencyMs, setAssistantLatencyMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const p0 = raw[0] ?? "";
  const mode: Mode = PREFIX[p0] ?? "default";
  const term = mode === "default" ? raw : raw.slice(1).replace(/^\s+/, "");

  // `@kind query`: the first token is a kind filter when recognized (like the CLI).
  let kindFilter: Kind | null = null;
  let fileQuery = term;
  if (mode === "files") {
    const sp = term.indexOf(" ");
    const first = (sp === -1 ? term : term.slice(0, sp)).toLowerCase();
    if (KINDS[first]) {
      kindFilter = KINDS[first];
      fileQuery = sp === -1 ? "" : term.slice(sp + 1).trimStart();
    }
  }

  const hide = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRaw("");
    setApps([]);
    s.clear();
    setAssistantAnswer(null);
    setAssistantError(null);
    setAssistantLoading(false);
    setAssistantCopied(false);
    setAssistantLatencyMs(null);
    setAssistantElapsedMs(0);
    win?.hide();
  };

  useEffect(() => {
    // Apply native Windows acrylic blur to Spotlight window
    if (isTauri && win) {
      win.setEffects({ effects: [Effect.Acrylic] }).catch(() => {});
    }
  }, [win]);

  useEffect(() => {
    inputRef.current?.focus();
    api.quickAccess().then((q) => setNav(q.map((x) => ({ name: x.label, path: x.path }))));
    if (!win) return;
    const unFocus = win.onFocusChanged(({ payload: focused }) => {
      if (focused) { inputRef.current?.focus(); inputRef.current?.select(); }
      else hide();
    });

    let unListen: Promise<() => void> | null = null;
    if (isTauri) {
      unListen = listen<AssistantConfig>(ASSISTANT_EVENT, (ev) => {
        if (ev.payload) setAssistantConfig(ev.payload);
      });
    }

    return () => {
      unFocus.then((f) => f());
      unListen?.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset assistant result when user clears input or switches away from assistant mode
  useEffect(() => {
    if (mode !== "assistant") {
      setAssistantAnswer(null);
      setAssistantError(null);
      setAssistantLoading(false);
      setAssistantCopied(false);
    }
  }, [mode]);

  // drive file search (index) with the query part (after any @kind token)
  const fileTerm = mode === "default" ? term : mode === "files" ? fileQuery : "";
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
    { name: "Open Keep Notes", sub: "Scratchpad & Checklists", run: () => { fire("spotlight:navigate", "lattice://keep"); api.showMain(); } },
    ...nav.map((n) => ({ name: `Go to ${n.name}`, sub: n.path, run: () => { fire("spotlight:navigate", n.path); api.showMain(); } })),
    { name: "Open Settings", sub: "Preferences", run: () => { fire("spotlight:open-settings"); api.showMain(); } },
    { name: "Show Lattice", sub: "Bring the window to front", run: () => api.showMain() },
    { name: "Quit Lattice", sub: "Exit the app", run: () => api.quit() },
  ], [nav]);

  const items: Item[] = useMemo(() => {
    if (mode === "math") { const v = calc(term); return v != null ? [{ kind: "math", value: v }] : []; }
    if (mode === "web") { const q = term.trim(); return q ? [{ kind: "web", term: q, url: asUrl(q) }] : []; }
    if (mode === "commands") return commands.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())).map((c) => ({ kind: "command", name: c.name, sub: c.sub, run: c.run }));
    if (mode === "assistant") return [];
    const a: Item[] = mode === "default" || mode === "apps" ? apps.map((x) => ({ kind: "app", name: x.name, path: x.path })) : [];
    
    // Notes matches
    const notesMatches: Item[] =
      mode === "default" && term.trim().length >= 2
        ? searchNotes(term).slice(0, 3).map((n) => ({
            kind: "note" as const,
            note: n,
            run: () => { fire("spotlight:navigate", "lattice://keep"); api.showMain(); },
          }))
        : [];

    const f: Item[] = mode === "default" || mode === "files"
      ? s.results
          .filter((h) => !kindFilter || (h.is_dir ? "folder" : kindOf(baseName(h.file_path))) === kindFilter)
          .slice(0, 8)
          .map((h) => { const name = baseName(h.file_path); const snip = h.snippet?.trim() && h.snippet.trim() !== name ? h.snippet.trim() : parentOf(h.file_path) ?? ""; return { kind: "file", name, sub: snip, path: h.file_path, k: h.is_dir ? "folder" : kindOf(name), isDir: h.is_dir }; })
      : [];
    return [...a, ...notesMatches, ...f];
  }, [mode, term, kindFilter, apps, s.results, commands]);

  useEffect(() => { setActive(0); }, [items.length, mode]);

  const runAssistant = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;
    const cfg = getAssistantConfig();
    if (!cfg.apiKey.trim()) {
      setAssistantError("API key is not configured. Set your credentials in Settings > Advanced.");
      return;
    }
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantAnswer(null);
    setAssistantPrompt(q);
    setAssistantCopied(false);
    setAssistantLatencyMs(null);
    setAssistantElapsedMs(0);

    const startTime = performance.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setAssistantElapsedMs(Math.round(performance.now() - startTime));
    }, 40);

    try {
      const res = await askAssistant(q, cfg);
      const latency = Math.round(performance.now() - startTime);
      setAssistantLatencyMs(latency);
      setAssistantAnswer(res);
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      setAssistantLatencyMs(latency);
      setAssistantError(err.message || "Failed to query assistant.");
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setAssistantLoading(false);
    }
  };

  const copyAssistantAnswer = () => {
    if (!assistantAnswer) return;
    navigator.clipboard?.writeText(assistantAnswer).then(() => {
      setAssistantCopied(true);
      setTimeout(() => setAssistantCopied(false), 1500);
    }).catch(() => {});
  };

  const continueInChatGPT = () => {
    const q = assistantPrompt || term;
    if (!q.trim()) return;
    const url = `https://chatgpt.com/?q=${encodeURIComponent(q.trim())}`;
    api.openUrl(url);
    hide();
  };

  const run = (it: Item, shift = false) => {
    if (it.kind === "app") api.openPath(it.path);
    else if (it.kind === "file") {
      if (it.isDir || shift) {
        fire("spotlight:navigate", it.path);
        api.showMain();
      } else {
        api.openPath(it.path);
      }
    }
    else if (it.kind === "web") api.openUrl(it.url ?? webSearchUrl(it.term));
    else if (it.kind === "math") navigator.clipboard?.writeText(String(it.value)).catch(() => {});
    else if (it.kind === "note") it.run();
    else if (it.kind === "command") it.run();
    hide();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    }
    else if (mode === "assistant") {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          continueInChatGPT();
        } else if (assistantAnswer) {
          copyAssistantAnswer();
        } else if (!assistantLoading && term.trim()) {
          runAssistant(term);
        }
      }
    }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); run(items[active], e.shiftKey); }
  };

  const appCount = mode === "default" ? apps.length : 0;
  const isConfigured = Boolean(assistantConfig.apiKey && assistantConfig.apiKey.trim());

  return (
    <div className="spot" ref={spotRef}>
      <div className="spot-search">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKey}
          placeholder={mode === "assistant" ? "Ask Watson..." : "Search, or try  > @ ? = / !"}
          spellCheck={false}
        />
        {mode === "default" || mode === "files" ? (
          <div className="spot-modes">
            {kindFilter && <span className="spot-kind">{KIND_LABEL[kindFilter] ?? kindFilter}</span>}
            {MODES.map((m) => <button key={m} className={"mode" + (s.mode === m ? " on" : "")} onClick={() => s.setMode(m)}>{m}</button>)}
          </div>
        ) : (
          <div className="spot-badge">{BADGE[mode]}</div>
        )}
      </div>

      {mode === "assistant" ? (
        <div className="spot-assistant-panel" style={{ padding: "14px 20px 16px" }}>
          {assistantLoading ? (
            <div style={{ padding: "14px 0", color: "var(--paper-dim)", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="splash-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--amber)", display: "inline-block", animation: "splashCorePulse 1.2s infinite" }} />
                Thinking...
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--dim-2)" }}>{assistantElapsedMs}ms</span>
            </div>
          ) : assistantAnswer ? (
            <div>
              <div className="spot-markdown" style={{ maxHeight: "320px", overflowY: "auto" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {assistantAnswer}
                </ReactMarkdown>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={copyAssistantAnswer}
                    style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--ink-2)", color: "var(--paper)", cursor: "pointer" }}
                  >
                    {assistantCopied ? "Copied" : "Copy"}
                  </button>
                  {assistantLatencyMs != null && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--dim-2)" }}>
                      {assistantLatencyMs}ms
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={continueInChatGPT}
                  style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--ink-2)", color: "var(--paper-dim)", cursor: "pointer" }}
                >
                  Continue elsewhere <ExternalIcon />
                </button>
              </div>
            </div>
          ) : assistantError ? (
            <div style={{ padding: "8px 0" }}>
              <div style={{ color: "var(--danger, #c0392b)", fontSize: "13px", marginBottom: "12px" }}>
                {assistantError}
              </div>
              <button
                type="button"
                onClick={() => { fire("spotlight:open-settings"); api.showMain(); hide(); }}
                style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--ink-2)", color: "var(--paper)", cursor: "pointer" }}
              >
                Open Settings
              </button>
            </div>
          ) : !isConfigured ? (
            <div style={{ padding: "8px 0", color: "var(--paper-dim)", fontSize: "13px" }}>
              <div style={{ marginBottom: "12px" }}>
                Watson is not configured. Add your API credentials in Settings &gt; Advanced to enable instant queries.
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => { fire("spotlight:open-settings"); api.showMain(); hide(); }}
                  style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--ink-2)", color: "var(--paper)", cursor: "pointer" }}
                >
                  Open Settings
                </button>
                {term.trim() && (
                  <button
                    type="button"
                    onClick={continueInChatGPT}
                    style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--ink-2)", color: "var(--paper-dim)", cursor: "pointer" }}
                  >
                    Continue elsewhere <ExternalIcon />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: "8px 0", color: "var(--dim-2)", fontSize: "12.5px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Press Enter to ask Watson</span>
              {term.trim() && (
                <button
                  type="button"
                  onClick={continueInChatGPT}
                  style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", fontSize: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--dim-2)", cursor: "pointer" }}
                >
                  Continue elsewhere <ExternalIcon />
                </button>
              )}
            </div>
          )}
        </div>
      ) : raw.trim() === "" ? (
        <div className="spot-hints">
          <span><b>&gt;</b> apps</span><span><b>@</b> kind</span><span><b>=</b> math</span><span><b>?</b> web</span><span><b>/</b> commands</span><span><b>!</b> watson</span>
        </div>
      ) : (
        <div className="spot-results">
          {items.length === 0 ? (
            mode === "files" && !fileQuery && !kindFilter ? (
              <div className="spot-hints spot-kinds">{["code", "doc", "folder", "image", "audio", "video", "archive"].map((k) => <span key={k}><b>@{k}</b></span>)}</div>
            ) : (
              <div className="spot-empty">{s.searching ? "Searching…" : "No matches"}</div>
            )
          ) : (
            items.map((it, i) => {
              const showApps = mode === "default" && it.kind === "app" && i === 0;
              const showFiles = mode === "default" && it.kind === "file" && i === appCount;
              let tile: React.ReactNode, bg = "var(--tile-neutral-bg)", fg = "var(--tile-neutral-fg)", name = "", sub = "";
              if (it.kind === "app") { tile = <AppIcon />; bg = "var(--tile-rust-bg)"; fg = "var(--tile-rust-fg)"; name = it.name; sub = "Application"; }
              else if (it.kind === "file") {
                tile = <Glyph kind={it.k} />;
                bg = TONE[it.k].bg;
                fg = TONE[it.k].fg;
                name = it.name;
                sub = it.isDir ? it.sub : `${it.sub} · ⇧↵ in tab`;
              }
              else if (it.kind === "web") { tile = <WebIcon />; bg = "var(--tile-green-bg)"; fg = "var(--tile-green-fg)"; name = it.url ? `Open ${it.url}` : `Search the web for “${it.term}”`; sub = "Opens in your browser"; }
              else if (it.kind === "math") { tile = <EqIcon />; bg = "var(--tile-amber-bg)"; fg = "var(--tile-amber-fg)"; name = fmtNum(it.value); sub = "Copy to clipboard"; }
              else if (it.kind === "note") {
                tile = <span style={{ fontSize: "14px" }}>🗈</span>;
                bg = "color-mix(in srgb, var(--amber) 18%, var(--card))";
                fg = "var(--amber)";
                name = it.note.title || "Untitled Note";
                sub = it.note.type === "checklist"
                  ? `${it.note.items?.length || 0} checklist items · Keep`
                  : `${it.note.content.slice(0, 45) || "Empty note"} · Keep`;
              }
              else { tile = <CmdIcon />; bg = "var(--tile-violet-bg)"; fg = "var(--tile-violet-fg)"; name = it.name; sub = it.sub; }
              return (
                <div key={it.kind + i}>
                  {showApps && <div className="spot-sec">Applications</div>}
                  {showFiles && appCount > 0 && <div className="spot-sec">Files</div>}
                  <button className={"spot-row" + (i === active ? " active" : "")} onMouseMove={() => setActive(i)} onClick={(e) => run(it, e.shiftKey)}>
                    <span className="tile" style={{ background: bg, color: fg }}>{tile}</span>
                    <span className="spot-main">
                      <span className={"spot-name" + (it.kind === "math" ? " mono" : "")}>{name}</span>
                      <span className="spot-sub">{sub}</span>
                    </span>
                    {i === active && <span className="spot-enter">{it.kind === "file" && !it.isDir ? "⇧↵" : "↵"}</span>}
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

