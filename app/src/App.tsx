import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useExplorer } from "./hooks/useExplorer";
import { useSearch } from "./hooks/useSearch";
import { useIndexer } from "./hooks/useIndexer";
import { useTheme } from "./hooks/useTheme";
import { IndexStatus } from "./components/IndexStatus";
import { Settings, applyIconSize } from "./components/Settings";
import { TopBar } from "./components/TopBar";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { FileList } from "./components/FileList";
import { SearchResults } from "./components/SearchResults";
import { Inspector } from "./components/Inspector";
import { ContextMenu } from "./components/ContextMenu";
import { PdfViewer } from "./components/PdfViewer";
import { TextEditor } from "./components/TextEditor";
import { JupyterViewer } from "./components/JupyterViewer";
import { ImageViewer } from "./components/ImageViewer";
import { api, isTauri } from "./lib/api";
import { isFilePath, baseName } from "./lib/format";
import "./lattice.css";

const isImage = (filename: string) => /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i.test(filename);

export default function App() {
  const ex = useExplorer();
  const s = useSearch();
  const ind = useIndexer();
  const th = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const exRef = useRef(ex);
  exRef.current = ex;

  // apply persisted icon size on mount
  useEffect(() => {
    try {
      const val = parseInt(localStorage.getItem("lattice:icon-size") || "100", 10);
      applyIconSize(val);
    } catch { /* ignore */ }
  }, []);

  // browsing to a new folder ends an active search
  useEffect(() => { s.clear(); }, [ex.path, s.clear]);

  // Keep the current path's collection index fresh: reconcile on navigate + window
  // focus (external edits, our own edits), guarded to once/30s per collection so
  // idle polling can't loop it. Reuses the incremental reindex.
  // ponytail: full-root re-walk; scope to the current subtree if it stalls search.
  const indRef = useRef(ind);
  indRef.current = ind;
  const lastReconcile = useRef<Map<number, number>>(new Map());
  const reconcileNow = useCallback(() => {
    if (!isTauri) return;
    const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    const cur = norm(exRef.current.path);
    if (!cur) return;
    const col = indRef.current.collections.find((c) => { const r = norm(c.root); return cur === r || cur.startsWith(r + "/"); });
    if (!col || col.status === "indexing") return;
    if (Date.now() - (lastReconcile.current.get(col.id) ?? 0) < 30000) return;
    lastReconcile.current.set(col.id, Date.now());
    api.reindex(col.id);
  }, []);
  useEffect(() => { reconcileNow(); }, [ex.path, reconcileNow]); // navigate
  useEffect(() => { window.addEventListener("focus", reconcileNow); return () => window.removeEventListener("focus", reconcileNow); }, [reconcileNow]);

  // commands dispatched from the Spotlight window
  useEffect(() => {
    let unlistenNav: (() => void) | null = null;
    let unlistenOpen: (() => void) | null = null;

    const handleOpenDir = (path: string) => {
      ex.newTab(path);
    };

    listen<string>("spotlight:navigate", (ev) => handleOpenDir(ev.payload)).then((fn) => { unlistenNav = fn; });
    listen<string>("spotlight:open", (ev) => handleOpenDir(ev.payload)).then((fn) => { unlistenOpen = fn; });

    return () => {
      if (unlistenNav) unlistenNav();
      if (unlistenOpen) unlistenOpen();
    };
  }, [ex.newTab]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "f") { e.preventDefault(); document.querySelector<HTMLInputElement>(".search input")?.focus(); return; }
      if (ctrl && e.key === "t") { e.preventDefault(); ex.newTab(); return; }
      if (ctrl && e.key === "w") { e.preventDefault(); ex.closeTab(ex.activeTabId); return; }
      if (ctrl && e.key === "Tab" && ex.tabs.length > 1) {
        e.preventDefault();
        const i = ex.tabs.findIndex((t) => t.id === ex.activeTabId);
        const n = ex.tabs.length;
        ex.selectTab(ex.tabs[e.shiftKey ? (i - 1 + n) % n : (i + 1) % n].id);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const only = ex.selectedEntries[0];
      if (ctrl && e.key === "a") { e.preventDefault(); ex.selectAll(); }
      else if (ctrl && e.key === "c") ex.copySel();
      else if (ctrl && e.key === "x") ex.cutSel();
      else if (ctrl && e.key === "v") ex.paste();
      else if (ctrl && e.key === "h") { e.preventDefault(); ex.toggleHidden(); }
      else if (e.key === "Enter" && only) {
        e.preventDefault();
        if (e.shiftKey) ex.openItemSpecial(only);
        else ex.openEntry(only);
      }
      else if (e.key === "F2" && ex.sel.size === 1 && only) ex.startRename(only.path);
      else if (e.key === "Delete" && ex.sel.size) ex.deleteSel();
      else if (e.key === "Backspace") ex.up();
      else if (e.altKey && e.key === "ArrowLeft") ex.back();
      else if (e.altKey && e.key === "ArrowRight") ex.forward();
      else if (e.key === "Escape") {
        if (ex.splitItem) ex.closeSplitItem();
        else { setSettingsOpen(false); ex.closeContext(); ex.clearSel(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex]);

  // Global click handler to deselect when clicking outside file panel
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".panel, .context-menu, .modal, input, textarea, .split-panel-container")) return;
      if (exRef.current.sel.size > 0) {
        exRef.current.clearSel();
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const isFileTab = isFilePath(ex.path);
  const activePathLower = ex.path.toLowerCase();

  return (
    <div className="app">
      <TitleBar ex={ex} />
      <TopBar ex={ex} s={s} onSettings={() => setSettingsOpen(true)} />
      <div className={"body" + (ex.splitItem ? " split-active" : "") + (ex.previewCollapsed ? " no-preview" : "")}>
        {!ex.splitItem && <Sidebar ex={ex} />}
        {s.active ? (
          <SearchResults s={s} ex={ex} />
        ) : isFileTab ? (
          <div className="tab-file-panel">
            {activePathLower.endsWith(".pdf") ? (
              <PdfViewer
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "document", type_label: "PDF File", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : activePathLower.endsWith(".ipynb") ? (
              <JupyterViewer
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "code", type_label: "Jupyter Notebook", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : isImage(ex.path) ? (
              <ImageViewer
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "image", type_label: "Image File", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : (
              <TextEditor
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "code", type_label: "File", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            )}
          </div>
        ) : (
          <FileList ex={ex} />
        )}

        {ex.splitItem && (
          <div className="split-view-panel">
            {ex.splitItem.name.toLowerCase().endsWith(".pdf") ? (
              <PdfViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
            ) : ex.splitItem.name.toLowerCase().endsWith(".ipynb") ? (
              <JupyterViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
            ) : isImage(ex.splitItem.name) ? (
              <ImageViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
            ) : (
              <TextEditor entry={ex.splitItem} onClose={ex.closeSplitItem} onErrorToast={ex.showToast} />
            )}
          </div>
        )}
        {!ex.splitItem && !isFileTab && !ex.previewCollapsed && <Inspector ex={ex} onCollapse={() => ex.togglePreview()} />}
        {!ex.splitItem && !isFileTab && ex.previewCollapsed && (
          <button className="preview-reveal" onClick={() => ex.togglePreview()} title="Show preview pane">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
      </div>
      <ContextMenu ex={ex} />
      <IndexStatus ind={ind} />
      {ex.toast && (
        <div className="index-toast done" style={{ color: "var(--paper)", zIndex: 100 }}>
          <span style={{ color: "var(--terracotta)", fontWeight: 700 }}>ℹ</span>
          &nbsp;{ex.toast}
        </div>
      )}
      {settingsOpen && <Settings ex={ex} ind={ind} th={th} onClose={() => setSettingsOpen(false)} />}
      {!isTauri && <div className="scaffold-note">preview · mock data — run <b style={{ color: "var(--paper-dim)" }}>npm run tauri dev</b> for live files</div>}
    </div>
  );
}
