import { useCallback, useRef, useState } from "react";

export interface RubberBand {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface RubberBandState {
  active: boolean;
  band: RubberBand | null;
  justFinished: boolean; // Flag to prevent immediate onClick from clearing selection
  intersectingIndices: number[]; // Current intersecting indices for visual feedback
}

interface UseRubberBandOptions {
  onSelect: (indices: number[], additive: boolean) => void;
  getElements: () => Element[];
  panelRef: React.RefObject<HTMLElement | null>;
}

export function useRubberBand({ onSelect, getElements, panelRef }: UseRubberBandOptions) {
  const [state, setState] = useState<RubberBandState>({
    active: false,
    band: null,
    justFinished: false,
    intersectingIndices: []
  });
  const startRef = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  const justFinishedTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const elementPositionsRef = useRef<{ el: Element; rect: DOMRect }[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);
  const panelOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Throttle collision detection to ~15fps (every ~67ms) during drag
  const THROTTLE_MS = 67;

  const start = useCallback((x: number, y: number, additive: boolean) => {
    console.log("[RB.start] Starting rubber band at:", { x, y, additive });
    // Clear any pending justFinished timeout
    if (justFinishedTimeoutRef.current) {
      clearTimeout(justFinishedTimeoutRef.current);
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    startRef.current = { x, y, additive };
    selectedIndicesRef.current = new Set();
    lastUpdateTimeRef.current = Date.now();

    // Get panel offset relative to viewport
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      panelOffsetRef.current = { x: rect.left, y: rect.top };
    }

    // Cache element positions once at drag start
    const elements = getElements();
    elementPositionsRef.current = elements.map(el => ({
      el,
      rect: el.getBoundingClientRect()
    }));

    setState({
      active: true,
      band: { startX: x, startY: y, endX: x, endY: y },
      justFinished: false,
      intersectingIndices: []
    });
  }, [getElements, panelRef]);

  const update = useCallback((x: number, y: number) => {
    if (!startRef.current) return;
    const { x: startX, y: startY } = startRef.current;

    // Update visual rectangle on every frame for smooth feedback
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      setState((prev) => {
        if (!prev.band) return prev;
        return { ...prev, band: { startX, startY, endX: x, endY: y } };
      });
    });

    // Throttle collision detection
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < THROTTLE_MS) {
      return;
    }
    lastUpdateTimeRef.current = now;

    // Calculate bounding box
    const left = Math.min(startX, x);
    const right = Math.max(startX, x);
    const top = Math.min(startY, y);
    const bottom = Math.max(startY, y);

    // Check intersection using cached positions
    const indices: number[] = [];
    elementPositionsRef.current.forEach(({ rect }, idx) => {
      if (!(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom)) {
        indices.push(idx);
      }
    });

    const newSet = new Set(indices);

    // Only update intersecting indices if changed
    if (!setsEqual(newSet, selectedIndicesRef.current)) {
      selectedIndicesRef.current = newSet;

      // Update intersecting indices for visual feedback
      setState((prev) => ({ ...prev, intersectingIndices: indices }));

      console.log("[RB.update] Detected intersection:", {
        bbox: { left, right, top, bottom },
        elementCount: elementPositionsRef.current.length,
        matchCount: indices.length,
        indices: indices.slice(0, 5)
      });
    }
  }, []);

  const end = useCallback(() => {
    console.log("[RB.end] Ending rubber band, state.active:", state.active);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Only commit selection if the user actually dragged (moved at least 5px)
    const didDrag = startRef.current && state.band && (
      Math.abs(state.band.endX - state.band.startX) > 5 ||
      Math.abs(state.band.endY - state.band.startY) > 5
    );

    // Commit final selection on mouseup if user actually dragged
    if (didDrag && startRef.current && selectedIndicesRef.current.size > 0) {
      console.log("[RB.end] Committing selection:", {
        indices: Array.from(selectedIndicesRef.current),
        additive: startRef.current.additive
      });
      onSelect(Array.from(selectedIndicesRef.current), startRef.current.additive);
    }

    startRef.current = null;
    elementPositionsRef.current = [];

    setState({
      active: false,
      band: null,
      justFinished: didDrag, // Only set justFinished if we actually dragged
      intersectingIndices: []
    });

    // Clear the justFinished flag after 50ms (enough time for onClick to fire)
    if (didDrag) {
      if (justFinishedTimeoutRef.current) {
        clearTimeout(justFinishedTimeoutRef.current);
      }
      justFinishedTimeoutRef.current = setTimeout(() => {
        console.log("[RB.end] Clearing justFinished flag");
        setState((prev) => ({ ...prev, justFinished: false }));
        justFinishedTimeoutRef.current = null;
      }, 50);
    }
  }, [state.active, state.band, onSelect]);

  return {
    state,
    start,
    update,
    end,
  };
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
