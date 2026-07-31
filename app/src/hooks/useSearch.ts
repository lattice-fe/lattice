import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Hit, SearchMode, api, isTauri, mockSearch } from "../lib/api";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("name");
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Unique per window instance so the main + spotlight searches never collide
  // on the shared worker's echoed seq.
  const seq = useRef(Math.floor(Math.random() * 1e9));
  const active = query.trim().length > 0;

  // watchdog: never let the "Searching…" state hang if a result never arrives
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => setSearching(false), 4000);
    return () => clearTimeout(t);
  }, [searching]);

  // subscribe to worker events (Tauri only)
  useEffect(() => {
    if (!isTauri) return;
    const subs = [
      listen<{ seq: number; hits: Hit[] }>("index:results", (e) => {
        if (e.payload.seq === seq.current) { setResults(e.payload.hits); setSearching(false); }
      }),
      listen<string | null>("index:status", (e) => setStatus(e.payload)),
      listen<string>("index:error", (e) => setStatus(e.payload)),
    ];
    return () => { subs.forEach((s) => s.then((un) => un())); };
  }, []);

  const run = useCallback(async (q: string, m: SearchMode) => {
    if (!q.trim()) { setResults([]); setSearching(false); return; }
    const id = ++seq.current;
    setSearching(true);
    if (!isTauri) { setResults(mockSearch(q)); setSearching(false); return; }
    try {
      await api.search(id, q, m);
    } catch (e) {
      if (id === seq.current) { setSearching(false); setStatus(String(e)); }
    }
  }, []);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => run(query, mode), 200);
    return () => clearTimeout(t);
  }, [query, mode, run]);

  const clear = useCallback(() => { setQuery(""); setResults([]); setSearching(false); }, []);

  return useMemo(() => ({
    query, setQuery, mode, setMode, results, searching, status, active, clear,
  }), [query, mode, results, searching, status, active, clear]);
}
export type Search = ReturnType<typeof useSearch>;
