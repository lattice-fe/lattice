import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!isTauri) return;
    api.collections().then(setCollections).catch(() => {});
    const subs = [
      listen<IndexProgress>("index:progress", (e) => {
        lastTotal.current = e.payload.total;
        setDone(null);
        setProgress(e.payload);
      }),
      listen<number>("index:indexed", () => {
        setProgress(null);
        setDone({ total: lastTotal.current });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(null), 3500);
      }),
      listen<string | null>("index:status", (e) => setStatus(e.payload)),
      listen<string>("index:error", (e) => setStatus("Indexing error: " + e.payload)),
      listen<Collection[]>("index:collections", (e) => setCollections(e.payload)),
    ];
    return () => { subs.forEach((s) => s.then((u) => u())); clearTimeout(timer.current); };
  }, []);

  return { progress, status, collections, done };
}
export type Indexer = ReturnType<typeof useIndexer>;
