import { Explorer } from "../hooks/useExplorer";

export function ContextMenu({ ex }: { ex: Explorer }) {
  if (!ex.ctx) return null;
  const { x, y, index } = ex.ctx;
  const onRow = index != null;
  const single = ex.sel.size === 1;
  const target = onRow ? ex.entries[index] : null;

  // keep the menu on-screen
  const style: React.CSSProperties = { left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 320) };

  const Item = ({ label, on, danger, kbd }: { label: string; on: () => void; danger?: boolean; kbd?: string }) => (
    <button className={"menu-item" + (danger ? " danger" : "")} onClick={on}>
      <span>{label}</span>{kbd && <span className="menu-kbd">{kbd}</span>}
    </button>
  );
  const Sep = () => <div className="menu-sep" />;

  return (
    <div className="menu-backdrop" onClick={ex.closeContext} onContextMenu={(e) => { e.preventDefault(); ex.closeContext(); }}>
      <div className="menu" style={style} onClick={(e) => e.stopPropagation()}>
        {onRow && target && <>
          <Item label="Open" on={() => { ex.closeContext(); ex.openEntry(target); }} kbd="↵" />
          <Item label="Reveal in Explorer" on={() => { ex.closeContext(); ex.reveal(target.path); }} />
          <Sep />
          <Item label="Copy" on={ex.copySel} kbd="Ctrl C" />
          <Item label="Cut" on={ex.cutSel} kbd="Ctrl X" />
          {single && <Item label="Rename" on={() => ex.startRename(target.path)} kbd="F2" />}
          <Sep />
          <Item label="Delete" on={ex.deleteSel} danger kbd="Del" />
          <Sep />
        </>}
        {ex.clipboard && <Item label="Paste" on={ex.paste} kbd="Ctrl V" />}
        <Item label="New folder" on={ex.newFolder} />
        {!onRow && <Item label="Refresh" on={() => { ex.closeContext(); ex.refresh(); }} />}
      </div>
    </div>
  );
}
