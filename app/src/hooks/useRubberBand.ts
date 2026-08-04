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
}

interface UseRubberBandOptions {
  onSelect: (indices: number[], additive: boolean) => void;
  getElements: () => Element[];
}

export function useRubberBand({ onSelect, getElements }: UseRubberBandOptions) {
  const [state, setState] = useState<RubberBandState>({ active: false, band: null, justFinished: false });
  const startRef = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  const justFinishedTimeoutRef = useRef<number | null>(null);

  const start = useCallback((x: number, y: number, additive: boolean) => {
    console.log("[RB.start] Starting rubber band at:", { x, y, additive });
    // Clear any pending justFinished timeout
    if (justFinishedTimeoutRef.current) {
      clearTimeout(justFinishedTimeoutRef.current);
    }
    startRef.current = { x, y, additive };
    selectedIndicesRef.current = new Set();
    setState({ active: true, band: { startX: x, startY: y, endX: x, endY: y }, justFinished: false });
  }, []);

  const update = useCallback((x: number, y: number) => {
    if (!startRef.current) return;
    const { x: startX, y: startY } = startRef.current;

    setState((prev) => {
      if (!prev.band) return prev;
      return { ...prev, band: { startX, startY, endX: x, endY: y } };
    });

    // Calculate bounding box
    const left = Math.min(startX, x);
    const right = Math.max(startX, x);
    const top = Math.min(startY, y);
    const bottom = Math.max(startY, y);

    // Get all entry elements and check which ones intersect the rectangle
    const elements = getElements();
    const indices: number[] = [];

    elements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();

      // Check if element rectangle intersects with selection rectangle
      if (!(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom)) {
        indices.push(idx);
      }
    });

    const newSet = new Set(indices);

    // Only trigger selection if changed
    if (setsEqual(newSet, selectedIndicesRef.current)) {
      console.log("[RB.update] Indices unchanged, skipping callback");
      return;
    }
    selectedIndicesRef.current = newSet;

    console.log("[RB.update] Detected intersection:", {
      bbox: { left, right, top, bottom },
      elementCount: elements.length,
      matchCount: indices.length,
      indices: indices.slice(0, 5)
    });

    if (indices.length > 0 && startRef.current) {
      console.log("[RB.update] Calling onSelect with indices:", indices.length);
      onSelect(indices, startRef.current.additive);
    }
  }, [getElements, onSelect]);

  const end = useCallback(() => {
    console.log("[RB.end] Ending rubber band, state.active:", state.active);
    startRef.current = null;
    setState({ active: false, band: null, justFinished: true });

    // Clear the justFinished flag after 50ms (enough time for onClick to fire)
    if (justFinishedTimeoutRef.current) {
      clearTimeout(justFinishedTimeoutRef.current);
    }
    justFinishedTimeoutRef.current = setTimeout(() => {
      console.log("[RB.end] Clearing justFinished flag");
      setState((prev) => ({ ...prev, justFinished: false }));
      justFinishedTimeoutRef.current = null;
    }, 50);
  }, [state.active]);

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
