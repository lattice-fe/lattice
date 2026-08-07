import { useRef, useState, useLayoutEffect } from "react";
import { Explorer } from "../hooks/useExplorer";
import { api } from "../lib/api";

export function ContextMenu({ ex, onNewFile }: { ex: Explorer; onNewFile: (folderPath: string) => void }) {
  if (!ex.ctx) return null;
  const { x, y, index, customEntry } = ex.ctx;
  const onRow = index != null || !!customEntry;
  const single = ex.sel.size === 1;
  const target = customEntry ?? (index != null ? ex.entries[index] : null);

  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 300),
  });

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;
    setPos({
      left: Math.max(10, Math.min(x, maxX)),
      top: Math.max(10, Math.min(y, maxY)),
    });
  }, [x, y]);

  const style: React.CSSProperties = {
    left: pos.left,
    top: pos.top,
    maxHeight: "calc(100vh - 20px)",
    overflowY: "auto",
  };

  const Item = ({ label, on, danger, kbd }: { label: string; on: () => void; danger?: boolean; kbd?: string }) => (
    <button
      type="button"
      className={"menu-item" + (danger ? " danger" : "")}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        on();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        on();
      }}
    >
      <span>{label}</span>{kbd && <span className="menu-kbd">{kbd}</span>}
    </button>
  );
  const Sep = () => <div className="menu-sep" />;

  return (
    <div
      className="menu-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          ex.closeContext();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          ex.closeContext();
        }
      }}
      onContextMenu={(e) => { e.preventDefault(); ex.closeContext(); }}
    >
      <div
        ref={menuRef}
        className="menu"
        style={style}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {onRow && target && <>
          <Item label="Open" on={() => { ex.closeContext(); ex.openEntry(target); }} kbd="↵" />
          <Item label="Open in new tab" on={() => { ex.closeContext(); ex.newTab(target.path); }} />
          {!target.is_dir && (
            <Item label="Open preview in side panel" on={() => { ex.closeContext(); ex.openItemSpecial(target); }} kbd="Shift ↵" />
          )}
          {target.is_dir && (
            ex.isPinned(target.path)
              ? <Item label="Unpin from Quick Access" on={() => { ex.closeContext(); ex.unpinFolder(target.path); }} />
              : <Item label="Pin to Quick Access" on={() => { ex.closeContext(); ex.pinFolder(target.name, target.path); }} />
          )}
          <Item label="Reveal in Explorer" on={() => { ex.closeContext(); ex.reveal(target.path); }} />
          {target.is_dir && <Item label="Index for search" on={() => { ex.closeContext(); api.indexFolder(target.path); }} />}
          <Sep />
          <Item label="Copy" on={ex.copySel} kbd="Ctrl C" />
          <Item label="Cut" on={ex.cutSel} kbd="Ctrl X" />
          {single && <Item label="Rename" on={() => ex.startRename(target.path)} kbd="F2" />}
          <Sep />
          <Item label="Delete" on={ex.deleteSel} danger kbd="Del" />
          <Sep />
        </>}
        {ex.clipboard && <Item label="Paste" on={ex.paste} kbd="Ctrl V" />}
        <Item label="New file" on={() => { ex.closeContext(); onNewFile(target && target.is_dir ? target.path : ex.path); }} kbd="Ctrl N" />
        <Item label="New folder" on={ex.newFolder} kbd="Ctrl ⇧ N" />
        {!onRow && <Item label="Index this folder for search" on={() => { ex.closeContext(); api.indexFolder(ex.path); }} />}
        {!onRow && <Item label="Refresh" on={() => { ex.closeContext(); ex.refresh(); }} />}
      </div>
    </div>
  );
}
