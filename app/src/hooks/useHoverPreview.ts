import { useCallback, useRef, useState } from "react";
import { Entry } from "../lib/api";
import { pickStrategy, PreviewStrategy } from "../lib/preview/registry";
import "../lib/preview/strategies"; // side-effect: registers the built-in strategies

// How long the pointer must rest on a file before its preview appears. The
// original sketch said 3–4s; that's long enough to feel broken, so this is
// tuned to the usual "intentional hover" threshold. Bump it if you want lazier.
const HOVER_DELAY_MS = 550;

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
  const reqId = useRef(0);
  const pos = useRef({ x: 0, y: 0 });

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onMove = useCallback((ev: React.MouseEvent) => {
    pos.current = { x: ev.clientX, y: ev.clientY };
  }, []);

  const onLeave = useCallback(() => {
    cancelTimer();
    reqId.current++; // invalidate any in-flight load
    setPreview(null);
  }, [cancelTimer]);

  const onEnter = useCallback(
    (e: Entry, ev: React.MouseEvent) => {
      cancelTimer();
      pos.current = { x: ev.clientX, y: ev.clientY };
      const strategy = pickStrategy(e);
      if (!strategy) {
        setPreview(null);
        return;
      }
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
      }, HOVER_DELAY_MS);
    },
    [cancelTimer]
  );

  return { preview, onEnter, onMove, onLeave };
}
