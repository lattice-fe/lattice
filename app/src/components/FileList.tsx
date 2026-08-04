import { useCallback, useEffect, useRef } from "react";
import { Explorer } from "../hooks/useExplorer";
import { useHoverPreview } from "../hooks/useHoverPreview";
import { useRubberBand } from "../hooks/useRubberBand";
import { Entry } from "../lib/api";
import { Glyph, TONE } from "../lib/icons";
import { fmtSize, fmtWhen, baseName } from "../lib/format";
import { SortCol } from "../lib/sort";
import { HoverPreview } from "./HoverPreview";
import { FileCard } from "./FileCard";

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
  const panelRef = useRef<HTMLDivElement>(null);

  // Get all entry elements (rows/cards/filecards) — all views
  const getElements = useCallback(() => {
    if (!panelRef.current) return [];
    const items = panelRef.current.querySelectorAll(".row, .card, .filecard, .folder-item");
    return Array.from(items);
  }, []);

  // Rubber band selection handlers
  const handleRubberBand = useCallback((indices: number[], additive: boolean) => {
    console.log("[RB] Selection update:", { indices, additive, count: indices.length });
    if (!additive) {
      // Clear selection and add only these items
      const newSel = new Set<string>();
      indices.forEach(i => {
        if (entries[i]) newSel.add(entries[i].path);
      });
      console.log("[RB] Setting new selection (non-additive):", { size: newSel.size, paths: Array.from(newSel).slice(0, 3) });
      ex.selectSet(newSel);
    } else {
      // Toggle items in selection
      const newSel = new Set(sel);
      indices.forEach(i => {
        if (entries[i]) {
          const p = entries[i].path;
          if (sel.has(p)) newSel.delete(p);
          else newSel.add(p);
        }
      });
      console.log("[RB] Setting new selection (additive):", { size: newSel.size, paths: Array.from(newSel).slice(0, 3) });
      ex.selectSet(newSel);
    }
  }, [entries, sel, ex]);

  const rb = useRubberBand({
    onSelect: handleRubberBand,
    getElements,
    panelRef,
  });

  // Mouse down to start rubber band selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log("[FileList.handleMouseDown] button:", e.button, "target:", e.target, "view:", view);
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    // Only start if clicking on empty space (not on an item)
    if (target === e.currentTarget || target.closest(".panel") === e.currentTarget) {
      console.log("[FileList.handleMouseDown] Starting rubber band");
      e.preventDefault(); // Prevent text selection
      rb.start(e.clientX, e.clientY, e.ctrlKey || e.metaKey);
    } else {
      console.log("[FileList.handleMouseDown] Not starting - clicked on item");
    }
  }, [rb]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rb.state.active) {
      e.preventDefault(); // Prevent text selection while dragging
      rb.update(e.clientX, e.clientY);
    }
  }, [rb]);

  const handleMouseUp = useCallback(() => {
    console.log("[FileList.handleMouseUp] rb.state.active:", rb.state.active);
    if (rb.state.active) {
      console.log("[FileList.handleMouseUp] Ending rubber band");
      rb.end();
    }
  }, [rb]);

  // Only clear selection on click if we're not rubber-banding
  const handleClick = useCallback(() => {
    console.log("[FileList.handleClick] rb.state:", { active: rb.state.active, justFinished: rb.state.justFinished }, "current sel size:", sel.size);
    // Don't clear if actively rubber-banding OR just finished (onClick fires after onMouseUp)
    if (!rb.state.active && !rb.state.justFinished) {
      console.log("[FileList.handleClick] Clearing selection");
      ex.clearSel();
    } else {
      console.log("[FileList.handleClick] Skipping clear - rubber band is active or just finished");
    }
  }, [ex, rb.state.active, rb.state.justFinished, sel]);

  // select / open / context — shared by rows and cards
  const interactProps = (e: Entry, i: number) => ({
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
        hp.onLeave();  // Clear preview before opening folder
        ex.openEntry(e);
      } else {
        lastClick.current = { path: e.path, t: now };
        ex.selectAt(i, mods);
      }
    },
    onContextMenu: (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); if (!sel.has(e.path)) ex.selectAt(i, { ctrl: false, shift: false }); ex.openContext(ev.clientX, ev.clientY, i); },
  });
  // rows/grid also drive the hover-preview; cards render their own content so they don't
  const rowProps = (e: Entry, i: number) => ({
    onMouseEnter: (ev: React.MouseEvent) => { if (!rb.state.active) hp.onEnter(e, ev); },
    onMouseMove: rb.state.active ? undefined : hp.onMove,
    onMouseLeave: () => hp.onLeave(),
    ...interactProps(e, i),
  });

  const SortHead = ({ col, label, cls = "" }: { col: SortCol; label: string; cls?: string }) => (
    <span className={"s " + cls} onClick={() => ex.setSort(col)}>
      {label}{sort.col === col ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </span>
  );

  // Calculate rubber band rectangle for display (viewport coordinates for fixed positioning)
  const bandRect = rb.state.active && rb.state.band ? (() => {
    const { startX, startY, endX, endY } = rb.state.band;
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    return { left, top, width, height };
  })() : null;

  // Check if an entry is currently intersecting with the rubber band
  const isIntersecting = (index: number) => {
    return rb.state.intersectingIndices.includes(index);
  };

  return (
    <main
      ref={panelRef}
      className="panel"
      onClick={handleClick}
      onScroll={hp.onLeave}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => { e.preventDefault(); ex.openContext(e.clientX, e.clientY, null); }}
    >
      {bandRect && (
        <>
          <div className="rubber-band" style={{
            left: `${bandRect.left}px`,
            top: `${bandRect.top}px`,
            width: `${bandRect.width}px`,
            height: `${bandRect.height}px`,
          }} />
          {rb.state.intersectingIndices.length > 0 && (
            <div className="rubber-band-count" style={{
              left: `${bandRect.left + bandRect.width + 8}px`,
              top: `${bandRect.top}px`,
            }}>
              {rb.state.intersectingIndices.length} selected
            </div>
          )}
        </>
      )}
      <div className="hero">
        <div>
          <h1>{baseName(ex.path) || " "}</h1>
          <div className="meta">{entries.length} item{entries.length === 1 ? "" : "s"}</div>
        </div>
        <div className="grow" />
        <div className="viewtoggle">
          <button className={view === "list" ? "on" : ""} title="List" onClick={(e) => { e.stopPropagation(); ex.setView("list"); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </button>
          <button className={view === "grid" ? "on" : ""} title="Grid" onClick={(e) => { e.stopPropagation(); ex.setView("grid"); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          </button>
          <button className={view === "cards" ? "on" : ""} title="Cards — content previews" onClick={(e) => { e.stopPropagation(); ex.setView("cards"); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h18M9 20V14" /></svg>
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
      ) : view === "cards" ? (() => {
        const dirs = entries.filter(e => e.is_dir);
        const files = entries.filter(e => !e.is_dir);
        const dirRatio = dirs.length / entries.length;
        // If >60% folders, fall back to grid view for consistency
        if (dirRatio > 0.6) {
          return (
            <div className="list grid">
              {entries.map((e, i) => {
                const t = TONE[e.kind];
                return (
                  <button key={e.path} className={"card" + (sel.has(e.path) ? " sel" : "") + (isIntersecting(i) ? " rubber-band-hover" : "")} style={{ animationDelay: `${Math.min(i * 16, 240)}ms` }} {...rowProps(e, i)}>
                    <span className="card-tile" style={{ background: t.bg, color: t.fg }}><Glyph kind={e.kind} /></span>
                    {renaming === e.path ? <RenameField entry={e} ex={ex} /> : <span className="card-label">{e.name}</span>}
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <div className="cards-wrapper">
            {dirs.length > 0 && (
              <div className="folderstrip">
                {dirs.map((e) => {
                  const i = entries.findIndex(ent => ent.path === e.path);
                  return (
                    <button key={e.path} className={"folder-item" + (sel.has(e.path) ? " sel" : "") + (isIntersecting(i) ? " rubber-band-hover" : "")} {...rowProps(e, i)}>
                      <span className="folder-icon" style={{ background: TONE.folder.bg, color: TONE.folder.fg }}><Glyph kind="folder" /></span>
                      <span className="folder-name">{e.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Files in cards grid */}
            <div className="cards-view">
              {files.map((e) => {
                const i = entries.findIndex(ent => ent.path === e.path);
                return (
                  <FileCard key={e.path} e={e} selected={sel.has(e.path)} intersecting={isIntersecting(i)} interact={interactProps(e, i)}>
                    {renaming === e.path ? <RenameField entry={e} ex={ex} /> : <span className="filecard-name">{e.name}</span>}
                  </FileCard>
                );
              })}
            </div>
          </div>
        );
      })() : view === "list" ? (
        <div className="list">
          {entries.map((e, i) => {
            const t = TONE[e.kind];
            return (
              <button key={e.path} className={"row" + (sel.has(e.path) ? " sel" : "") + (isIntersecting(i) ? " rubber-band-hover" : "")} style={{ animationDelay: `${Math.min(i * 18, 260)}ms` }} {...rowProps(e, i)}>
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
              <button key={e.path} className={"card" + (sel.has(e.path) ? " sel" : "") + (isIntersecting(i) ? " rubber-band-hover" : "")} style={{ animationDelay: `${Math.min(i * 16, 240)}ms` }} {...rowProps(e, i)}>
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
