import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Drive, Entry, Shortcut } from "../lib/api";
import { Sort, SortCol, sortEntries } from "../lib/sort";
import { parentOf, baseName, isFilePath } from "../lib/format";
import { logActivity } from "../lib/activity";
import { extOf } from "../lib/preview/registry";

export interface Clipboard { paths: string[]; mode: "copy" | "cut"; }
export interface Ctx { x: number; y: number; index: number | null; customEntry?: Entry | null; }

export interface TabGroup {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
  tabIds: number[];
}

interface Tab {
  id: number;
  history: string[];
  hi: number;
  splitItem?: Entry | null;
  chatOpen?: boolean;
}

const PINNED_KEY = "lattice:pinned-folders";
const QUICK_HIDDEN_KEY = "lattice:quick-hidden";
const HOME_DIR_KEY = "lattice:home-dir";
const SESSION_KEY = "lattice:session-state";
const GROUPS_KEY = "lattice:tab-groups";

const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "wma", "aiff"]);
const VIDEO_EXTS = new Set(["mp4", "mkv", "avi", "mov", "webm", "wmv", "flv"]);
const BINARY_EXTS = new Set(["exe", "dll", "zip", "tar", "gz", "7z", "iso", "bin", "dat", "sys", "dmg", "pkg", "rar", "msi"]);

function loadPinned(): Shortcut[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePinned(items: Shortcut[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(items));
}

function loadHiddenQuick(): string[] {
  try {
    const raw = localStorage.getItem(QUICK_HIDDEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHiddenQuick(items: string[]) {
  localStorage.setItem(QUICK_HIDDEN_KEY, JSON.stringify(items));
}

function getSavedHomeDir(): string {
  try {
    return localStorage.getItem(HOME_DIR_KEY) || "";
  } catch { return ""; }
}

interface SavedSession {
  tabs: Tab[];
  activeId: number;
  openMode?: "split" | "tab";
}

function loadSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

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
  const splitItem = activeTab?.splitItem ?? null;

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Stable ref so patchActive doesn't need activeId as a dep (avoids callback cascade on tab switch)
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const patchActive = useCallback((fn: (t: Tab) => Tab) => {
    setTabs((ts) => ts.map((t) => (t.id === activeIdRef.current ? fn(t) : t)));
  }, []); // stable — never recreated

  const [sel, setSel] = useState<Set<string>>(new Set());
  const anchor = useRef<number | null>(null);
  const [sort, setSortState] = useState<Sort>({ col: "name", dir: "asc" });
  const [showHidden, setShowHidden] = useState(false);
  const [view, setView] = useState<"list" | "grid" | "cards">("list");
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  const [homeDir, setHomeDirState] = useState<string>(getSavedHomeDir);
  const setHomeDir = useCallback((path: string) => {
    setHomeDirState(path);
    localStorage.setItem(HOME_DIR_KEY, path);
  }, []);

  const [openMode, setOpenModeState] = useState<"split" | "tab">(() => {
    try { return (localStorage.getItem("lattice:open-mode") as "split" | "tab") || "split"; } catch { return "split"; }
  });

  const setOpenMode = useCallback((mode: "split" | "tab") => {
    setOpenModeState(mode);
    localStorage.setItem("lattice:open-mode", mode);
  }, []);

  const closeSplitItem = useCallback(() => {
    patchActive((t) => ({ ...t, splitItem: null }));
  }, [patchActive]);

  const [drives, setDrives] = useState<Drive[]>([]);
  const [quick, setQuick] = useState<Shortcut[]>([]);
  const [pinned, setPinned] = useState<Shortcut[]>(loadPinned);
  const [hiddenQuick, setHiddenQuick] = useState<string[]>(loadHiddenQuick);

  const allQuick = useMemo(() => {
    const pinnedPaths = new Set(pinned.map((p) => p.path.toLowerCase()));
    const hidden = new Set(hiddenQuick.map((h) => h.toLowerCase()));
    const filtered = quick.filter((q) => !pinnedPaths.has(q.path.toLowerCase()) && !hidden.has(q.path.toLowerCase()));
    return [...pinned, ...filtered];
  }, [pinned, quick, hiddenQuick]);

  const hideQuick = useCallback((path: string) => {
    setHiddenQuick((prev) => {
      const p = path.toLowerCase();
      if (prev.includes(p)) return prev;
      const next = [...prev, p];
      saveHiddenQuick(next);
      return next;
    });
  }, []);
  const showQuick = useCallback((path: string) => {
    setHiddenQuick((prev) => {
      const next = prev.filter((h) => h !== path.toLowerCase());
      saveHiddenQuick(next);
      return next;
    });
  }, []);

  const pinFolder = useCallback((label: string, path: string) => {
    setPinned((prev) => {
      if (prev.some((p) => p.path.toLowerCase() === path.toLowerCase())) return prev;
      const next = [...prev, { label, path }];
      savePinned(next);
      return next;
    });
  }, []);

  const unpinFolder = useCallback((path: string) => {
    setPinned((prev) => {
      const next = prev.filter((p) => p.path.toLowerCase() !== path.toLowerCase());
      savePinned(next);
      return next;
    });
  }, []);

  const isPinned = useCallback((path: string) => {
    return pinned.some((p) => p.path.toLowerCase() === path.toLowerCase());
  }, [pinned]);

  const isDownloads = useMemo(() => {
    const p = path.toLowerCase();
    return p.endsWith("/downloads") || p.endsWith("\\downloads");
  }, [path]);

  const entries = useMemo(() => sortEntries(raw, sort, isDownloads), [raw, sort, isDownloads]);

  const load = useCallback(async (p: string) => {
    if (p.startsWith("lattice://") || isFilePath(p)) {
      setLoading(false);
      setError(null);
      setRaw([]);
      return;
    }
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

  useEffect(() => { if (path) load(path); }, [path, showHidden, load]);

  // Load initial drives, quick access, and restore saved session or start at home
  useEffect(() => {
    api.drives().then(setDrives).catch(() => {});
    api.quickAccess().then(setQuick).catch(() => {});
    api.homeDir().then((h) => {
      homeRef.current = h;
      const saved = loadSavedSession();
      if (saved && saved.tabs && saved.tabs.length > 0) {
        setTabs(saved.tabs);
        setActiveId(saved.activeId);
        const maxId = Math.max(...saved.tabs.map((t) => t.id), 0);
        nextId.current = maxId + 1;
        if (saved.openMode) setOpenModeState(saved.openMode);
      } else {
        const id = nextId.current++;
        setTabs([{ id, history: [getSavedHomeDir() || "lattice://home"], hi: 0 }]);
        setActiveId(id);
      }
    });
  }, []);

  // Debounced session persist — at most one write per 500ms instead of every state change
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tabs.length === 0 || activeId === -1) return;
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ tabs, activeId, openMode }));
      } catch { /* ignore */ }
    }, 500);
  }, [tabs, activeId, openMode]);

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

  const newTab = useCallback((p?: string) => {
    const start = p || getSavedHomeDir() || "lattice://home";
    if (!start) return;
    const id = nextId.current++;
    setTabs((ts) => [...ts, { id, history: [start], hi: 0 }]);
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, []);

  const selectTab = useCallback((id: number) => {
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, []);

  const openDocTab = useCallback(() => {
    const DOC_PATH = "lattice://docs";
    const existing = tabs.find((t) => (t.history[t.hi] || "").toLowerCase() === DOC_PATH);
    if (existing) {
      setActiveId(existing.id);
      setSel(new Set());
      setCtx(null);
      return;
    }
    const id = nextId.current++;
    setTabs((ts) => [...ts, { id, history: [DOC_PATH], hi: 0 }]);
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, [tabs]);

  const openKeepTab = useCallback(() => {
    const KEEP_PATH = "lattice://keep";
    const existing = tabs.find((t) => (t.history[t.hi] || "").toLowerCase() === KEEP_PATH);
    if (existing) {
      setActiveId(existing.id);
      setSel(new Set());
      setCtx(null);
      return;
    }
    const id = nextId.current++;
    setTabs((ts) => [...ts, { id, history: [KEEP_PATH], hi: 0 }]);
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, [tabs]);

  const closeTab = useCallback((id: number) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (id === activeId) {
      setActiveId(next[Math.min(idx, next.length - 1)].id);
      setSel(new Set());
      setCtx(null);
    }
  }, [tabs, activeId]);

  // Tab reordering via drag-and-drop
  const reorderTabs = useCallback((sourceId: number, targetId: number) => {
    setTabs((prev) => {
      const srcIdx = prev.findIndex((t) => t.id === sourceId);
      const tgtIdx = prev.findIndex((t) => t.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved);
      return next;
    });
  }, []);

  const closeOtherTabs = useCallback((id: number) => {
    setTabs((prev) => prev.filter((t) => t.id === id));
    setActiveId(id);
    setSel(new Set());
    setCtx(null);
  }, []);

  const closeTabsToRight = useCallback((id: number) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.slice(0, idx + 1);
      if (!next.some((t) => t.id === activeId)) {
        setActiveId(id);
      }
      return next;
    });
    setSel(new Set());
    setCtx(null);
  }, [activeId]);

  const duplicateTab = useCallback((id: number) => {
    const target = tabs.find((t) => t.id === id);
    if (!target) return;
    const newId = nextId.current++;
    const currentPath = target.history[target.hi] || "~";
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, { id: newId, history: [currentPath], hi: 0 });
      return next;
    });
    setActiveId(newId);
  }, [tabs]);

  // Tab Groups state & operations
  const [groups, setGroupsState] = useState<TabGroup[]>(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const saveGroups = useCallback((items: TabGroup[]) => {
    setGroupsState(items);
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, []);

  const createGroup = useCallback((name: string, color: string, tabIds: number[]) => {
    const id = "grp_" + Date.now().toString(36);
    const newGrp: TabGroup = { id, name, color, tabIds, collapsed: false };
    saveGroups([...groups, newGrp]);
    return id;
  }, [groups, saveGroups]);

  const addTabToGroup = useCallback((groupId: string, tabId: number) => {
    saveGroups(groups.map((g) => {
      if (g.id === groupId) {
        if (g.tabIds.includes(tabId)) return g;
        return { ...g, tabIds: [...g.tabIds, tabId] };
      }
      return { ...g, tabIds: g.tabIds.filter((tid) => tid !== tabId) };
    }));
  }, [groups, saveGroups]);

  const removeTabFromGroup = useCallback((tabId: number) => {
    saveGroups(groups.map((g) => ({ ...g, tabIds: g.tabIds.filter((tid) => tid !== tabId) })).filter((g) => g.tabIds.length > 0));
  }, [groups, saveGroups]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    saveGroups(groups.map((g) => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g));
  }, [groups, saveGroups]);

  const renameGroup = useCallback((groupId: string, name: string) => {
    saveGroups(groups.map((g) => g.id === groupId ? { ...g, name } : g));
  }, [groups, saveGroups]);

  const setGroupColor = useCallback((groupId: string, color: string) => {
    saveGroups(groups.map((g) => g.id === groupId ? { ...g, color } : g));
  }, [groups, saveGroups]);

  const deleteGroup = useCallback((groupId: string) => {
    saveGroups(groups.filter((g) => g.id !== groupId));
  }, [groups, saveGroups]);

  const closeGroupTabs = useCallback((groupId: string) => {
    const grp = groups.find((g) => g.id === groupId);
    if (!grp) return;
    const removeSet = new Set(grp.tabIds);
    const remaining = tabs.filter((t) => !removeSet.has(t.id));
    if (remaining.length > 0) {
      setTabs(remaining);
      if (removeSet.has(activeId)) {
        setActiveId(remaining[0].id);
      }
    }
    deleteGroup(groupId);
  }, [groups, tabs, activeId, deleteGroup]);

  const tabList = useMemo(() => tabs.map((t) => ({
    id: t.id,
    path: t.history[t.hi] ?? "",
    splitPath: t.splitItem?.path ?? null,
  })), [tabs]);
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
  const selectSet = useCallback((paths: Set<string>) => { setSel(paths); setCtx(null); }, []);

  const openEntry = useCallback((e: Entry) => {
    if (e.is_dir) navigate(e.path);
    else {
      logActivity({ type: "open", title: `Opened ${e.name}`, sub: parentOf(e.path) ?? "", path: e.path });
      api.openPath(e.path);
    }
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
      logActivity({ type: "create", title: `Created ${baseName(created)}`, sub: path, path: created });
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

  const openItemSpecial = useCallback((entry: Entry) => {
    if (entry.is_dir) {
      navigate(entry.path);
      return;
    }
    const ext = extOf(entry.name);
    if (AUDIO_EXTS.has(ext)) {
      showToast("Audio files open in the side Inspector panel.");
      return;
    }
    if (VIDEO_EXTS.has(ext) || BINARY_EXTS.has(ext)) {
      showToast(`Cannot preview ${ext ? ext.toUpperCase() : "binary"} files in split panel.`);
      return;
    }

    const isCompact = window.innerWidth < 768;
    if (openMode === "tab" || isCompact) {
      if (isCompact && openMode === "split") {
        showToast("Opened in new tab for compact display.");
      }
      newTab(entry.path);
    } else {
      patchActive((t) => ({ ...t, splitItem: entry }));
    }
  }, [navigate, newTab, openMode, patchActive, showToast]);

  const chatOpen = activeTab?.chatOpen ?? false;
  const toggleChat = useCallback(() => {
    patchActive((t) => ({ ...t, chatOpen: !t.chatOpen }));
  }, [patchActive]);
  const setChatOpen = useCallback((open: boolean) => {
    patchActive((t) => ({ ...t, chatOpen: open }));
  }, [patchActive]);

  return {
    path, entries, loading, error, drives, quick: allQuick,
    canBack: hi > 0, canForward: hi < history.length - 1, canUp: !!parentOf(path),
    sel, selectedEntries, sort, view, showHidden, clipboard, renaming, ctx,
    tabs: tabList, activeTabId: activeId, newTab, closeTab, selectTab, openDocTab, openKeepTab,
    reorderTabs, closeOtherTabs, closeTabsToRight, duplicateTab,
    groups, createGroup, addTabToGroup, removeTabFromGroup, toggleGroupCollapse, renameGroup, setGroupColor, deleteGroup, closeGroupTabs,
    navigate, back, forward, up, refresh,
    selectAt, clearSel, selectAll, selectSet, openEntry, setSort,
    toggleView: () => setView((v) => (v === "list" ? "grid" : "list")),
    setView,
    toggleHidden: () => setShowHidden((h) => !h),
    setShowHidden,
    startRename, cancelRename, commitRename,
    newFolder, copySel, cutSel, paste, deleteSel, reveal,
    openContext: (x: number, y: number, index: number | null, customEntry?: Entry | null) => setCtx({ x, y, index, customEntry }),
    closeContext: () => setCtx(null),
    pinFolder, unpinFolder, isPinned,
    quickDefaults: quick, pinnedQuick: pinned, hiddenQuick, hideQuick, showQuick,
    previewCollapsed,
    togglePreview: () => setPreviewCollapsed((prev) => !prev),
    openMode, setOpenMode, splitItem, closeSplitItem, openItemSpecial,
    chatOpen, toggleChat, setChatOpen,
    homeDir, setHomeDir, toast, showToast,
  };
}
export type Explorer = ReturnType<typeof useExplorer>;
