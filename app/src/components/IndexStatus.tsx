import { Indexer } from "../hooks/useIndexer";
import { baseName } from "../lib/format";

export function IndexStatus({ ind }: { ind: Indexer }) {
  const { progress, status, done } = ind;

  if (progress) {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="index-toast">
        <span className="spinner" />
        <div className="it-body">
          <div className="it-top"><b>Indexing…</b><span>{progress.done} / {progress.total}</span></div>
          <div className="it-bar"><i style={{ width: `${pct}%` }} /></div>
          {progress.current && <div className="it-cur">{baseName(progress.current)}</div>}
        </div>
      </div>
    );
  }
  if (done) return <div className="index-toast done"><span className="it-check">✓</span>&nbsp;Indexed {done.total} files</div>;
  if (status) return <div className="index-toast"><span className="spinner" />{status}</div>;
  return null;
}
