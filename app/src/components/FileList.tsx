import { useEffect, useRef } from "react";
import { Explorer } from "../hooks/useExplorer";
import { useHoverPreview } from "../hooks/useHoverPreview";
import { Entry } from "../lib/api";
import { Glyph, TONE } from "../lib/icons";
import { fmtSize, fmtWhen, baseName } from "../lib/format";
import { SortCol } from "../lib/sort";
import { HoverPreview } from "./HoverPreview";

function RenameField({ entry, ex }: { entry: Entry; ex: Explorer }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      className="rename"
      defaultValue={entry.name}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={(e) => ex.commitRename(entry.path, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") ex.commitRename(entry.path, e.currentTarget.value);
        else if (e.key === "Escape") ex.cancelRename();
        e.stopPropagation();
      }}
    />
  );
}

export function FileList({ ex }: { ex: Explorer }) {
  const { entries, sel, sort, view, renaming } = ex;
  // Manual double-click detection: relying on the DOM dblclick event is flaky
  // because the first click re-renders (selection), which can make the browser
  // miss the pair. A timestamp ref is reliable across re-renders.
  const lastClick = useRef<{ path: string; t: number } | null>(null);
  const hp = useHoverPreview();

  const rowProps = (e: Entry, i: number) => ({
    onMouseEnter: (ev: React.MouseEvent) => hp.onEnter(e, ev),
    onMouseMove: hp.onMove,
    onMouseLeave: () => hp.onLeave(),
    // middle-click a folder → open in a new tab
    onMouseDown: (ev: React.MouseEvent) => { if (ev.button === 1 && e.is_dir) { ev.preventDefault(); hp.onLeave(); ex.newTab(e.path); } },
    onClick: (ev: React.MouseEvent) => {
      ev.stopPropagation();
      const mods = { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey };
      if (mods.ctrl || mods.shift) { lastClick.current = null; ex.selectAt(i, mods); return; }
      const now = Date.now();
      const prev = lastClick.current;
      if (prev && prev.path === e.path && now - prev.t < 400) {
        lastClick.current = null;
        ex.openEntry(e);
      } else {
        lastClick.current = { path: e.path, t: now };
        ex.selectAt(i, mods);
      }
    },
    onContextMenu: (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); if (!sel.has(e.path)) ex.selectAt(i, { ctrl: false, shift: false }); ex.openContext(ev.clientX, ev.clientY, i); },
  });

  const SortHead = ({ col, label, cls = "" }: { col: SortCol; label: string; cls?: string }) => (
    <span className={"s " + cls} onClick={() => ex.setSort(col)}>
      {label}{sort.col === col ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </span>
  );

  return (
    <main className="panel" onClick={ex.clearSel} onScroll={hp.onLeave} onContextMenu={(e) => { e.preventDefault(); ex.openContext(e.clientX, e.clientY, null); }}>
      <div className="hero">
        <div>
          <h1>{baseName(ex.path) || " "}</h1>
          <div className="meta">{entries.length} item{entries.length === 1 ? "" : "s"}</div>
        </div>
        <div className="grow" />
        <div className="viewtoggle">
          <button className={view === "list" ? "on" : ""} title="List" onClick={(e) => { e.stopPropagation(); if (view !== "list") ex.toggleView(); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </button>
          <button className={view === "grid" ? "on" : ""} title="Grid" onClick={(e) => { e.stopPropagation(); if (view !== "grid") ex.toggleView(); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          </button>
        </div>
      </div>

      {view === "list" && (
        <div className="collabel"><SortHead col="name" label="Name" /><SortHead col="modified" label="Modified" /><SortHead col="size" label="Size" cls="r" /></div>
      )}

      {ex.loading ? (
        <div className="empty-note">Loading…</div>
      ) : ex.error ? (
        <div className="empty-note err">{ex.error}</div>
      ) : entries.length === 0 ? (
        <div className="empty-note">This folder is empty</div>
      ) : view === "list" ? (
        <div className="list">
          {entries.map((e, i) => {
            const t = TONE[e.kind];
            return (
              <button key={e.path} className={"row" + (sel.has(e.path) ? " sel" : "")} style={{ animationDelay: `${Math.min(i * 18, 260)}ms` }} {...rowProps(e, i)}>
                <span className="nm">
                  <span className="tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={e.kind} /></span>
                  {renaming === e.path ? <RenameField entry={e} ex={ex} /> : <span className="label">{e.name}</span>}
                </span>
                <span className="col">{fmtWhen(e.modified)}</span>
                <span className="col r">{fmtSize(e.size, e.is_dir)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="list grid">
          {entries.map((e, i) => {
            const t = TONE[e.kind];
            return (
              <button key={e.path} className={"card" + (sel.has(e.path) ? " sel" : "")} style={{ animationDelay: `${Math.min(i * 16, 240)}ms` }} {...rowProps(e, i)}>
                <span className="card-tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={e.kind} /></span>
                {renaming === e.path ? <RenameField entry={e} ex={ex} /> : <span className="card-label">{e.name}</span>}
              </button>
            );
          })}
        </div>
      )}

      {hp.preview && <HoverPreview state={hp.preview} />}
    </main>
  );
}
