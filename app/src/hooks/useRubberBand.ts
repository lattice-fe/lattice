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
  justFinished: boolean;
  intersectingIndices: number[];
}

interface UseRubberBandOptions {
  onSelect: (indices: number[], additive: boolean) => void;
  getElements: () => Element[];
  panelRef?: React.RefObject<HTMLElement | null>;
}

export function useRubberBand({ onSelect, getElements }: UseRubberBandOptions) {
  const [state, setState] = useState<RubberBandState>({
    active: false,
    band: null,
    justFinished: false,
    intersectingIndices: []
  });

  const startRef = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectedIndicesRef = useRef<Set<number>>(new Set());
  const justFinishedTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const elementPositionsRef = useRef<{ index: number; rect: DOMRect }[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);

  const THROTTLE_MS = 35; // Responsive 35ms collision sampling

  const start = useCallback((x: number, y: number, additive: boolean) => {
    if (justFinishedTimeoutRef.current) {
      clearTimeout(justFinishedTimeoutRef.current);
      justFinishedTimeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    startRef.current = { x, y, additive };
    lastPosRef.current = { x, y };
    selectedIndicesRef.current = new Set();
    lastUpdateTimeRef.current = Date.now();

    // Cache element positions with their data-index attribute
    const elements = getElements();
    elementPositionsRef.current = elements.map(el => ({
      index: Number(el.getAttribute("data-index") ?? -1),
      rect: el.getBoundingClientRect()
    })).filter(item => item.index >= 0);

    setState({
      active: true,
      band: { startX: x, startY: y, endX: x, endY: y },
      justFinished: false,
      intersectingIndices: []
    });
  }, [getElements]);

  const computeCollisions = useCallback((x: number, y: number) => {
    if (!startRef.current) return [];
    const { x: startX, y: startY } = startRef.current;
    const left = Math.min(startX, x);
    const right = Math.max(startX, x);
    const top = Math.min(startY, y);
    const bottom = Math.max(startY, y);

    const indices: number[] = [];
    elementPositionsRef.current.forEach(({ index, rect }) => {
      if (!(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom)) {
        indices.push(index);
      }
    });
    return indices;
  }, []);

  const update = useCallback((x: number, y: number) => {
    if (!startRef.current) return;
    lastPosRef.current = { x, y };
    const startX = startRef.current.x;
    const startY = startRef.current.y;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      setState((prev) => {
        if (!prev.band) return prev;
        return { ...prev, band: { startX, startY, endX: x, endY: y } };
      });
    });

    const now = Date.now();
    if (now - lastUpdateTimeRef.current < THROTTLE_MS) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const indices = computeCollisions(x, y);
    const newSet = new Set(indices);

    if (!setsEqual(newSet, selectedIndicesRef.current)) {
      selectedIndicesRef.current = newSet;
      setState((prev) => ({ ...prev, intersectingIndices: indices }));
    }
  }, [computeCollisions]);

  const end = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const startPos = startRef.current;
    const lastPos = lastPosRef.current;
    const didDrag = Boolean(
      startPos &&
      lastPos &&
      (Math.abs(lastPos.x - startPos.x) > 5 || Math.abs(lastPos.y - startPos.y) > 5)
    );

    if (didDrag && startPos && lastPos) {
      const finalIndices = computeCollisions(lastPos.x, lastPos.y);
      onSelect(finalIndices, startPos.additive);
    }

    startRef.current = null;
    lastPosRef.current = null;
    elementPositionsRef.current = [];

    setState({
      active: false,
      band: null,
      justFinished: didDrag,
      intersectingIndices: []
    });

    if (didDrag) {
      if (justFinishedTimeoutRef.current) {
        clearTimeout(justFinishedTimeoutRef.current);
      }
      justFinishedTimeoutRef.current = window.setTimeout(() => {
        setState((prev) => ({ ...prev, justFinished: false }));
        justFinishedTimeoutRef.current = null;
      }, 120);
    }
  }, [computeCollisions, onSelect]);

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
