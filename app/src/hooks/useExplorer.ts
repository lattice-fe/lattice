import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Drive, Entry, Shortcut } from "../lib/api";
import { Sort, SortCol, sortEntries } from "../lib/sort";
import { parentOf } from "../lib/format";

export interface Clipboard { paths: string[]; mode: "copy" | "cut"; }
export interface Ctx { x: number; y: number; index: number | null; }
// Each tab owns its own navigation stack; selection, entries and view
// preferences follow the active tab.
interface Tab { id: number; history: string[]; hi: number; }

export function useExplorer() {
  const [raw, setRaw] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState(-1);
  const nextId = useRef(1);
  const homeRef = useRef("");
  const activeTab = tabs.find((t) => t.id === activeId);
  const history = activeTab?.history ?? [];
  const hi = activeTab?.hi ?? -1;
  const path = hi >= 0 ? history[hi] : "";

  const patchActive = useCallback((fn: (t: Tab) => Tab) => {
    setTabs((ts) => ts.map((t) => (t.id === activeId ? fn(t) : t)));
  }, [activeId]);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const anchor = useRef<number | null>(null);
  const [sort, setSortState] = useState<Sort>({ col: "name", dir: "asc" });
  const [showHidden, setShowHidden] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);

  const [drives, setDrives] = useState<Drive[]>([]);
  const [quick, setQuick] = useState<Shortcut[]>([]);

  const entries = useMemo(() => sortEntries(raw, sort), [raw, sort]);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      setRaw(await api.listDir(p, showHidden));
    } catch (e) {
      setError(String(e));
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  // reload when path or hidden-toggle changes
  useEffect(() => { if (path) load(path); }, [path, showHidden, load]);

  // initial: drives + quick access + home (as the first tab)
  useEffect(() => {
    api.drives().then(setDrives).catch(() => {});
    api.quickAccess().then(setQuick).catch(() => {});
    api.homeDir().then((h) => {
      homeRef.current = h;
      const id = nextId.current++;
      setTabs([{ id, history: [h], hi: 0 }]);
      setActiveId(id);
    });
  }, []);

  const navigate = useCallback((p: string) => {
    setSel(new Set());
    setCtx(null);
    patchActive((t) => {
      const trimmed = t.history.slice(0, t.hi + 1);
      if (trimmed[trimmed.length - 1] === p) return t;
      const next = [...trimmed, p];
      return { ...t, history: next, hi: next.length - 1 };
    });
  }, [patchActive]);

  const back = useCallback(() => { setSel(new Set()); patchActive((t) => (t.hi > 0 ? { ...t, hi: t.hi - 1 } : t)); }, [patchActive]);
  const forward = useCallback(() => { setSel(new Set()); patchActive((t) => (t.hi < t.history.length - 1 ? { ...t, hi: t.hi + 1 } : t)); }, [patchActive]);

  // --- tabs ---
  const newTab = useCallback((p?: string) => {
    const start = p || path || homeRef.current;
    if (!start) return;
    const id = nextId.current++;
    setTabs((ts) => [...ts, { id, history: [start], hi: 0 }]);
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, [path]);

  const selectTab = useCallback((id: number) => {
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, []);

  const closeTab = useCallback((id: number) => {
    if (tabs.length <= 1) return; // always keep one tab
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (id === activeId) {
      setActiveId(next[Math.min(idx, next.length - 1)].id);
      setSel(new Set());
      setCtx(null);
    }
  }, [tabs, activeId]);

  const tabList = useMemo(() => tabs.map((t) => ({ id: t.id, path: t.history[t.hi] ?? "" })), [tabs]);
  const up = useCallback(() => { const par = parentOf(path); if (par) navigate(par); }, [path, navigate]);
  const refresh = useCallback(() => load(path), [path, load]);

  const selectAt = useCallback((i: number, mods: { ctrl: boolean; shift: boolean }) => {
    setCtx(null);
    setSel((prev) => {
      const next = new Set(prev);
      if (mods.shift && anchor.current != null) {
        const [a, b] = [anchor.current, i].sort((x, y) => x - y);
        next.clear();
        for (let k = a; k <= b; k++) if (entries[k]) next.add(entries[k].path);
      } else if (mods.ctrl) {
        const p = entries[i].path;
        next.has(p) ? next.delete(p) : next.add(p);
        anchor.current = i;
      } else {
        next.clear();
        next.add(entries[i].path);
        anchor.current = i;
      }
      return next;
    });
  }, [entries]);

  const clearSel = useCallback(() => { setSel(new Set()); setCtx(null); }, []);
  const selectAll = useCallback(() => setSel(new Set(entries.map((e) => e.path))), [entries]);

  const openEntry = useCallback((e: Entry) => {
    if (e.is_dir) navigate(e.path);
    else api.openPath(e.path);
  }, [navigate]);

  const setSort = useCallback((col: SortCol) => {
    setSortState((s) => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" });
  }, []);

  const selectedEntries = useMemo(() => entries.filter((e) => sel.has(e.path)), [entries, sel]);

  const startRename = useCallback((p: string) => { setRenaming(p); setSel(new Set([p])); setCtx(null); }, []);
  const cancelRename = useCallback(() => setRenaming(null), []);
  const commitRename = useCallback(async (p: string, name: string) => {
    setRenaming(null);
    const trimmed = name.trim();
    const cur = entries.find((e) => e.path === p);
    if (!trimmed || !cur || trimmed === cur.name) return;
    try { await api.rename(p, trimmed); await refresh(); } catch (e) { setError(String(e)); }
  }, [entries, refresh]);

  const newFolder = useCallback(async () => {
    setCtx(null);
    try {
      const created = await api.newFolder(path);
      await refresh();
      startRename(created);
    } catch (e) { setError(String(e)); }
  }, [path, refresh, startRename]);

  const copySel = useCallback(() => { if (sel.size) { setClipboard({ paths: [...sel], mode: "copy" }); setCtx(null); } }, [sel]);
  const cutSel = useCallback(() => { if (sel.size) { setClipboard({ paths: [...sel], mode: "cut" }); setCtx(null); } }, [sel]);
  const paste = useCallback(async () => {
    setCtx(null);
    if (!clipboard) return;
    try {
      if (clipboard.mode === "copy") await api.copyItems(clipboard.paths, path);
      else { await api.moveItems(clipboard.paths, path); setClipboard(null); }
      await refresh();
    } catch (e) { setError(String(e)); }
  }, [clipboard, path, refresh]);

  const deleteSel = useCallback(async () => {
    setCtx(null);
    if (!sel.size) return;
    try { await api.deleteItems([...sel]); setSel(new Set()); await refresh(); } catch (e) { setError(String(e)); }
  }, [sel, refresh]);

  const reveal = useCallback((p: string) => api.reveal(p), []);

  return {
    path, entries, loading, error, drives, quick,
    canBack: hi > 0, canForward: hi < history.length - 1, canUp: !!parentOf(path),
    sel, selectedEntries, sort, view, showHidden, clipboard, renaming, ctx,
    tabs: tabList, activeTabId: activeId, newTab, closeTab, selectTab,
    navigate, back, forward, up, refresh,
    selectAt, clearSel, selectAll, openEntry, setSort,
    toggleView: () => setView((v) => (v === "list" ? "grid" : "list")),
    toggleHidden: () => setShowHidden((h) => !h),
    startRename, cancelRename, commitRename,
    newFolder, copySel, cutSel, paste, deleteSel, reveal,
    openContext: (x: number, y: number, index: number | null) => setCtx({ x, y, index }),
    closeContext: () => setCtx(null),
  };
}
export type Explorer = ReturnType<typeof useExplorer>;
