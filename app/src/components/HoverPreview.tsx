import { HoverState } from "../hooks/useHoverPreview";

const PANE_W = 380;
const GAP = 12;
const EST_H = 300; // used only to keep the pane on-screen vertically

// A floating, non-interactive gist of the hovered file. Positioned beside the
// row (flips to the left edge when there's no room on the right).
export function HoverPreview({ state }: { state: HoverState }) {
  const { rect } = state;
  const flipLeft = rect.right + GAP + PANE_W > window.innerWidth;
  const left = flipLeft ? Math.max(GAP, rect.left - GAP - PANE_W) : rect.right + GAP;
  const top = Math.min(rect.top, Math.max(GAP, window.innerHeight - EST_H - GAP));

  return (
    <div className="hoverprev" style={{ left, top, width: PANE_W }}>
      <div className="hoverprev-head">
        <span className="hoverprev-name">{state.name}</span>
      </div>
      {state.loading || !state.data ? (
        <div className="hoverprev-loading"><span className="spinner" />Reading…</div>
      ) : state.data.text.length === 0 ? (
        <div className="hoverprev-empty">Empty file</div>
      ) : (
        <>
          <pre className="hoverprev-body">{state.data.text}</pre>
          {state.data.truncated && <div className="hoverprev-more">…</div>}
        </>
      )}
    </div>
  );
}
