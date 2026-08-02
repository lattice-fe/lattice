import { HoverState } from "../hooks/useHoverPreview";

const PANE_W = 380;
const OFFSET = 18; // gap between cursor and pane
const EDGE = 10; // min gap from viewport edges
const EST_H = 300; // pane's max height (keeps it on-screen vertically)
const FOLDER_EST_H = 180; // shorter estimated height for folder previews

// A floating, non-interactive preview anchored near the cursor. Flips to the
// other side of the cursor when it would run off the right/bottom edge. The
// actual content is produced by the matched preview strategy.
export function HoverPreview({ state }: { state: HoverState }) {
  const { x, y, strategy } = state;
  // Use smaller estimated height for folder previews to prevent diagonal offset
  const estH = state.entry.is_dir ? FOLDER_EST_H : EST_H;

  let left = x + OFFSET;
  if (left + PANE_W > window.innerWidth - EDGE) left = Math.max(EDGE, x - OFFSET - PANE_W);
  let top = y + OFFSET;
  if (top + estH > window.innerHeight - EDGE) top = Math.max(EDGE, window.innerHeight - estH - EDGE);

  return (
    <div className="hoverprev" style={{ left, top, width: PANE_W }}>
      <div className="hoverprev-head">
        <span className="hoverprev-name">{state.entry.name}</span>
      </div>
      {state.loading || state.data == null ? (
        <div className="hoverprev-loading"><span className="spinner" />Reading…</div>
      ) : (
        strategy.render(state.data)
      )}
    </div>
  );
}
