import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Hit, SearchMode, api, isTauri, mockSearch } from "../lib/api";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("name");
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const seq = useRef(0);
  const active = query.trim().length > 0;

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
    if (isTauri) await api.search(id, q, m);
    else { setResults(mockSearch(q)); setSearching(false); }
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
