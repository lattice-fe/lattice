import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Collection, api, isTauri } from "../lib/api";

export interface IndexProgress { collection: number; done: number; total: number; current: string; }

export function useIndexer() {
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [done, setDone] = useState<{ total: number } | null>(null); // brief "indexed" flash
  const lastTotal = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(() => {
    if (isTauri) api.collections().then(setCollections).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    refresh();
    // Poll as a robust fallback so the collections list stays correct even if an
    // index:collections event is missed.
    const poll = setInterval(refresh, 2000);
    const subs = [
      listen<IndexProgress>("index:progress", (e) => {
        console.debug("[idx] progress", e.payload);
        lastTotal.current = e.payload.total;
        setDone(null);
        setProgress(e.payload);
      }),
      listen<number>("index:indexed", () => {
        console.debug("[idx] indexed");
        setProgress(null);
        setDone({ total: lastTotal.current });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(null), 3500);
      }),
      listen<string | null>("index:status", (e) => { console.debug("[idx] status", e.payload); setStatus(e.payload); }),
      listen<string>("index:error", (e) => setStatus("Indexing error: " + e.payload)),
      listen<Collection[]>("index:collections", (e) => { console.debug("[idx] collections", e.payload); setCollections(e.payload); }),
    ];
    return () => { clearInterval(poll); subs.forEach((s) => s.then((u) => u())); clearTimeout(timer.current); };
  }, [refresh]);

  // Fallback: a collection currently indexing (derived from polled status) so the
  // toast still shows even if progress events don't arrive.
  const indexing = collections.find((c) => c.status === "indexing") ?? null;

  return { progress, status, collections, done, indexing, refresh };
}
export type Indexer = ReturnType<typeof useIndexer>;
