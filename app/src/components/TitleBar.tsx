import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Explorer } from "../hooks/useExplorer";
import { baseName, isFilePath } from "../lib/format";
import { Mark, Glyph, kindOf, TONE } from "../lib/icons";
import { isTauri } from "../lib/api";
import { TabContextMenu, TabCtxState } from "./TabContextMenu";

function tabTitle(path: string, splitPath?: string | null): string {
  if (path.toLowerCase() === "lattice://docs") return "Documentation";
  if (path.toLowerCase() === "lattice://keep") return "Keep";
  const folder = baseName(path) || path.replace(/[\\/]+$/, "") || "This PC";
  if (splitPath) {
    const file = baseName(splitPath);
    return `${folder} | ${file}`;
  }
  return folder;
}

const win = () => getCurrentWindow();

const MinIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11"><line x1="1.5" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.1" /></svg>);
const MaxIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1"><rect x="1.7" y="1.7" width="7.6" height="7.6" rx="1.2" /></svg>);
const RestoreIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1"><rect x="1.4" y="3.1" width="6.1" height="6.1" rx="1" /><path d="M3.5 3.1 V1.5 H9.5 V7.5 H7.6" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M2.2 2.2 L8.8 8.8 M8.8 2.2 L2.2 8.8" /></svg>);

export function TitleBar({ ex }: { ex: Explorer }) {
  const [maxed, setMaxed] = useState(false);
  const [tabCtx, setTabCtx] = useState<TabCtxState | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const dragRef = useRef<{ sourceId: number; startX: number; moved: boolean } | null>(null);
  const dragOverGroupRef = useRef<string | null>(null);

  // Keep ref in sync with state
  const updateDragOverGroup = (v: string | null) => {
    dragOverGroupRef.current = v;
    setDragOverGroup(v);
  };

  useEffect(() => {
    if (!isTauri) return;
    const w = win();
    w.isMaximized().then(setMaxed).catch(() => {});
    const un = w.onResized(() => w.isMaximized().then(setMaxed).catch(() => {}));
    return () => { un.then((f) => f()).catch(() => {}); };
  }, []);

  const minimize = () => { if (isTauri) win().minimize(); };
  const toggleMax = () => { if (isTauri) win().toggleMaximize(); };
  const close = () => { if (isTauri) win().close(); };

  const onGlobalMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.startX) > 5) {
      drag.moved = true;
      setDraggingId(drag.sourceId);
    }
    if (!drag.moved) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);

    // Check if hovering over a group pill (drag-into-group)
    const groupEl = el?.closest<HTMLElement>("[data-group-id]");
    if (groupEl) {
      updateDragOverGroup(groupEl.dataset.groupId ?? null);
      setDragOverId(null);
      return;
    }
    updateDragOverGroup(null);

    // Check if hovering over a tab (reorder)
    const tabEl = el?.closest<HTMLElement>("[data-tab-id]");
    if (tabEl) {
      const targetId = Number(tabEl.dataset.tabId);
      if (targetId && targetId !== drag.sourceId) {
        setDragOverId(targetId);
        ex.reorderTabs(drag.sourceId, targetId);
      }
    } else {
      setDragOverId(null);
    }
  }, [ex]);

  const onGlobalMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    // Read from ref — not the stale closure state
    const groupId = dragOverGroupRef.current;
    if (groupId) {
      ex.addTabToGroup(groupId, drag.sourceId);
    } else if (!drag.moved) {
      ex.selectTab(drag.sourceId);
    }

    dragRef.current = null;
    dragOverGroupRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    setDragOverGroup(null);
    document.removeEventListener("mousemove", onGlobalMouseMove);
    document.removeEventListener("mouseup", onGlobalMouseUp);
  }, [ex, onGlobalMouseMove]);

  const startDrag = useCallback((e: React.MouseEvent, tabId: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".tab-x")) return;
    e.preventDefault();
    dragRef.current = { sourceId: tabId, startX: e.clientX, moved: false };
    document.addEventListener("mousemove", onGlobalMouseMove);
    document.addEventListener("mouseup", onGlobalMouseUp);
  }, [onGlobalMouseMove, onGlobalMouseUp]);

  // Build group membership lookup
  const groupMap = useMemo(() => {
    const m = new Map<number, typeof ex.groups[0]>();
    ex.groups.forEach((g) => g.tabIds.forEach((tid) => m.set(tid, g)));
    return m;
  }, [ex.groups]);

  // Build Chrome-style render order: walk tabs, cluster grouped tabs together
  // When we hit a grouped tab whose group hasn't been rendered yet, emit group pill + all its member tabs
  const renderItems = useMemo(() => {
    const items: Array<
      | { type: "tab"; tab: typeof ex.tabs[0]; group?: typeof ex.groups[0] }
      | { type: "group-pill"; group: typeof ex.groups[0] }
    > = [];
    const renderedGroups = new Set<string>();
    const groupedTabIds = new Set<number>();
    ex.groups.forEach((g) => g.tabIds.forEach((tid) => groupedTabIds.add(tid)));

    for (const t of ex.tabs) {
      const grp = groupMap.get(t.id);
      if (grp) {
        if (renderedGroups.has(grp.id)) continue; // already emitted with group cluster
        // Emit group pill + all its member tabs (in tab order)
        renderedGroups.add(grp.id);
        items.push({ type: "group-pill", group: grp });
        if (!grp.collapsed) {
          const memberTabs = ex.tabs.filter((mt) => grp.tabIds.includes(mt.id));
          for (const mt of memberTabs) {
            items.push({ type: "tab", tab: mt, group: grp });
          }
        }
      } else {
        items.push({ type: "tab", tab: t });
      }
    }
    return items;
  }, [ex.tabs, ex.groups, groupMap]);

  const renderTab = (t: typeof ex.tabs[0], grp?: typeof ex.groups[0]) => {
    const isFile = isFilePath(t.path);
    const name = baseName(t.path);
    const pLow = t.path.toLowerCase();
    const isDocs = pLow === "lattice://docs";
    const isKeep = pLow === "lattice://keep";
    const kind = isDocs || isKeep ? "document" : isFile ? kindOf(name) : "folder";
    const tone = TONE[kind] ?? TONE.other;
    const isActive = t.id === ex.activeTabId;
    const isDragging = draggingId === t.id;
    const isDragOver = dragOverId === t.id && draggingId !== t.id;

    return (
      <div
        key={t.id}
        data-tab-id={t.id}
        className={
          "tab" +
          (isActive ? " active" : "") +
          (isDragging ? " dragging" : "") +
          (isDragOver ? " drag-over" : "") +
          (grp ? " grouped" : "")
        }
        style={{
          borderBottom: grp ? `2px solid ${grp.color}` : undefined,
        }}
        title={t.path}
        onMouseDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            ex.closeTab(t.id);
          } else if (e.button === 0) {
            startDrag(e, t.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setTabCtx({ x: e.clientX, y: e.clientY, tabId: t.id, path: t.path });
        }}
      >
        <span
          className="tab-glyph"
          style={{
            display: "grid",
            placeItems: "center",
            width: "14px",
            height: "14px",
            color: isActive ? tone.fg : "var(--dim)",
            flex: "none",
            opacity: isActive ? 1 : 0.75,
          }}
        >
          <Glyph kind={kind} />
        </span>
        <span className="tab-title">{tabTitle(t.path, t.splitPath)}</span>
        {ex.tabs.length > 1 && (
          <button
            className="tab-x"
            title="Close tab"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              ex.closeTab(t.id);
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="titlebar">
      <div className="titlebar-logo" data-tauri-drag-region title="Lattice"><Mark /></div>
      <div className="titlebar-tabs">
        {renderItems.map((item) => {
          if (item.type === "group-pill") {
            const g = item.group;
            const isDropTarget = dragOverGroup === g.id;
            return (
              <div
                key={`grp-${g.id}`}
                data-group-id={g.id}
                className={"tab-group-pill" + (isDropTarget ? " drop-target" : "")}
                style={{ "--grp-color": g.color } as React.CSSProperties}
                onClick={() => ex.toggleGroupCollapse(g.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                title={g.collapsed ? `${g.name} (${g.tabIds.length} tabs) · click to expand` : `${g.name} · click to collapse`}
              >
                <span className="tab-group-dot" style={{ background: g.color }} />
                <span>{g.name}</span>
                {g.collapsed && <span className="tab-group-count">{g.tabIds.length}</span>}
              </div>
            );
          }
          return renderTab(item.tab, item.group);
        })}
        <button className="tab-new" title="New tab (Ctrl+T)" onClick={() => ex.newTab()}>+</button>
      </div>

      <div className="titlebar-drag" data-tauri-drag-region onDoubleClick={toggleMax} />

      <div className="winctrls">
        <button className="winctrl" title="Minimize" onClick={minimize}><MinIcon /></button>
        <button className="winctrl" title={maxed ? "Restore" : "Maximize"} onClick={toggleMax}>{maxed ? <RestoreIcon /> : <MaxIcon />}</button>
        <button className="winctrl close" title="Close" onClick={close}><CloseIcon /></button>
      </div>

      <TabContextMenu ex={ex} ctx={tabCtx} onClose={() => setTabCtx(null)} />
    </div>
  );
}

