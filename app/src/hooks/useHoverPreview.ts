import { useCallback, useRef, useState } from "react";
import { Entry } from "../lib/api";
import { pickStrategy, PreviewStrategy } from "../lib/preview/registry";
import "../lib/preview/strategies"; // side-effect: registers the built-in strategies

// localStorage keys for hover preview settings
const HOVER_DELAY_KEY = "lattice:hover-delay";
const PERSISTENCE_KEY = "lattice:preview-persistence";

function getHoverDelay(): number {
  try { return parseInt(localStorage.getItem(HOVER_DELAY_KEY) || "550", 10); } catch { return 550; }
}
function getPersistence(): number {
  try { return parseInt(localStorage.getItem(PERSISTENCE_KEY) || "250", 10); } catch { return 250; }
}

export interface HoverState {
  entry: Entry;
  strategy: PreviewStrategy;
  x: number; // cursor anchor at the moment the preview fired
  y: number;
  data: unknown | null;
  loading: boolean;
}

export interface HoverPreviewApi {
  preview: HoverState | null;
  onEnter: (e: Entry, ev: React.MouseEvent) => void;
  onMove: (ev: React.MouseEvent) => void;
  onLeave: () => void;
}

export function useHoverPreview(): HoverPreviewApi {
  const [preview, setPreview] = useState<HoverState | null>(null);
  const timer = useRef<number | null>(null);
  const persistTimer = useRef<number | null>(null);
  const reqId = useRef(0);
  const pos = useRef({ x: 0, y: 0 });

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const cancelPersistTimer = useCallback(() => {
    if (persistTimer.current !== null) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
  }, []);

  const onMove = useCallback((ev: React.MouseEvent) => {
    pos.current = { x: ev.clientX, y: ev.clientY };
  }, []);

  const onLeave = useCallback(() => {
    cancelTimer();
    cancelPersistTimer();
    reqId.current++; // invalidate any in-flight load

    // Delay clearing preview by persistence duration
    const persistMs = getPersistence();
    persistTimer.current = window.setTimeout(() => {
      setPreview(null);
    }, persistMs);
  }, [cancelTimer, cancelPersistTimer]);

  const onEnter = useCallback(
    (e: Entry, ev: React.MouseEvent) => {
      cancelTimer();
      cancelPersistTimer(); // Cancel any pending clear
      pos.current = { x: ev.clientX, y: ev.clientY };
      const strategy = pickStrategy(e);
      if (!strategy || strategy.disableHover) {
        setPreview(null);
        return;
      }
      const delayMs = getHoverDelay();
      timer.current = window.setTimeout(async () => {
        const id = ++reqId.current;
        const { x, y } = pos.current;
        setPreview({ entry: e, strategy, x, y, data: null, loading: true });
        try {
          const data = await strategy.load(e);
          if (reqId.current === id) setPreview({ entry: e, strategy, x, y, data, loading: false });
        } catch {
          // Not previewable (binary, gone, permission) — show nothing.
          if (reqId.current === id) setPreview(null);
        }
      }, delayMs);
    },
    [cancelTimer, cancelPersistTimer]
  );

  return { preview, onEnter, onMove, onLeave };
}
