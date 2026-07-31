import { Explorer } from "../hooks/useExplorer";
import { Indexer } from "../hooks/useIndexer";
import { api } from "../lib/api";
import { baseName } from "../lib/format";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className={"switch" + (on ? " on" : "")} onClick={onClick} role="switch" aria-checked={on}><span /></button>;
}

export function Settings({ ex, ind, onClose }: { ex: Explorer; ind: Indexer; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="modal-x" onClick={onClose} title="Close">×</button>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-name">Show hidden files</div>
            <div className="setting-desc">Reveal dotfiles and system-hidden items</div>
          </div>
          <Switch on={ex.showHidden} onClick={ex.toggleHidden} />
        </div>

        <div className="modal-sec">Indexed folders</div>
        {ind.collections.length === 0 ? (
          <div className="setting-desc" style={{ padding: "2px 2px 6px" }}>
            No folders indexed yet. Right-click a folder → <b style={{ color: "var(--paper-dim)" }}>Index for search</b>.
          </div>
        ) : (
          <div className="coll-list">
            {ind.collections.map((c) => (
              <div className="coll" key={c.id}>
                <div className="coll-info">
                  <div className="coll-name">{baseName(c.root)}</div>
                  <div className="coll-meta">{c.file_count} file{c.file_count === 1 ? "" : "s"} · {c.status}</div>
                </div>
                <button
                  className={"chip-toggle" + (c.semantic ? " on" : "")}
                  title={c.semantic ? "Semantic search on" : "Semantic search off"}
                  onClick={() => api.setSemantic(c.id, !c.semantic)}
                >semantic</button>
                <button className="coll-btn" title="Reindex" onClick={() => api.reindex(c.id)}>↻</button>
                <button className="coll-btn danger" title="Remove from index" onClick={() => api.removeCollection(c.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
