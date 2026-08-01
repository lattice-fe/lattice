import { useCallback, useRef, useState } from "react";
import { api, Entry, Preview } from "../lib/api";

// How long the pointer must rest on a file before its preview appears. The
// original sketch said 3–4s; that's long enough to feel broken, so this is
// tuned to the usual "intentional hover" threshold. Bump it if you want lazier.
const HOVER_DELAY_MS = 550;

// Only text-like kinds are worth reading a gist from.
const PREVIEWABLE = new Set(["code", "document"]);

export interface HoverState {
  path: string;
  name: string;
  rect: DOMRect;
  data: Preview | null;
  loading: boolean;
}

export interface HoverPreviewApi {
  preview: HoverState | null;
  onEnter: (e: Entry, el: HTMLElement) => void;
  onLeave: () => void;
}

export function useHoverPreview(): HoverPreviewApi {
  const [preview, setPreview] = useState<HoverState | null>(null);
  const timer = useRef<number | null>(null);
  const reqId = useRef(0);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onLeave = useCallback(() => {
    cancelTimer();
    reqId.current++; // invalidate any in-flight request
    setPreview(null);
  }, [cancelTimer]);

  const onEnter = useCallback(
    (e: Entry, el: HTMLElement) => {
      cancelTimer();
      if (e.is_dir || !PREVIEWABLE.has(e.kind)) {
        setPreview(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      timer.current = window.setTimeout(async () => {
        const id = ++reqId.current;
        setPreview({ path: e.path, name: e.name, rect, data: null, loading: true });
        try {
          const data = await api.previewFile(e.path);
          if (reqId.current === id) {
            setPreview({ path: e.path, name: e.name, rect, data, loading: false });
          }
        } catch {
          // Not readable as text (binary, gone, permission) — show nothing.
          if (reqId.current === id) setPreview(null);
        }
      }, HOVER_DELAY_MS);
    },
    [cancelTimer]
  );

  return { preview, onEnter, onLeave };
}
