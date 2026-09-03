import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { Inspector } from "./components/Inspector";
import { ContextMenu } from "./components/ContextMenu";
import { PdfViewer } from "./components/PdfViewer";
import { TextEditor } from "./components/TextEditor";
import { JupyterViewer } from "./components/JupyterViewer";
import { ImageViewer } from "./components/ImageViewer";
import { SpreadsheetViewer } from "./components/SpreadsheetViewer";
import { getNote } from "./lib/keep/store";
import { DocumentationViewer } from "./components/DocumentationViewer";
import { KeepCanvas } from "./components/KeepCanvas";
import { HomePage } from "./components/HomePage";
import { Onboarding } from "./components/Onboarding";
import { WatsonActionModal, WatsonActionRequest } from "./components/WatsonActionModal";
import { WatsonChatPane } from "./components/WatsonChatPane";
import { NewFileModal } from "./components/NewFileModal";
import { api, isTauri } from "./lib/api";
import { isFilePath, baseName } from "./lib/format";
import { getAssistantConfig, ASSISTANT_DOM_EVENT } from "./lib/assistant/config";
import { updateNote } from "./lib/keep/store";
import { checkDueReminders, REMINDER_ACTION_EVENT, REMINDER_OPEN_EVENT, SNOOZE_MS, type ReminderAction } from "./lib/keep/reminders";
import "./lattice.css";

function isSpreadsheet(path: string): boolean {
  const l = path.toLowerCase();
  return l.endsWith(".csv") || l.endsWith(".tsv") || l.endsWith(".xlsx") || l.endsWith(".xls") || l.endsWith(".ods");
}

function isImage(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"].includes(ext);
}

export default function App() {
  const ex = useExplorer();
  const s = useSearch();
  const ind = useIndexer();
  const th = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newFileFolder, setNewFileFolder] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(() => { try { return localStorage.getItem("lattice:onboarded") === "true"; } catch { return true; } });
  const [watsonModalReq, setWatsonModalReq] = useState<WatsonActionRequest | null>(null);
  const [fileTabSidebarOpen, setFileTabSidebarOpen] = useState(false);
  const [aiMode, setAiMode] = useState(() => getAssistantConfig().aiMode);
  const aiPaneEnabled = aiMode === "full";
  const exRef = useRef(ex);
  exRef.current = ex;

  // React to AI-features setting changes (Settings dispatches this on save).
  useEffect(() => {
    const sync = () => setAiMode(getAssistantConfig().aiMode);
    window.addEventListener(ASSISTANT_DOM_EVENT, sync);
    return () => window.removeEventListener(ASSISTANT_DOM_EVENT, sync);
  }, []);

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
    if (/^[a-z]:$/.test(norm(col.root))) return; // skip drive-root collections (e.g. D:\) — too big to auto-walk
    if (col.file_count > 20000) return; // and any collection large enough to stall the single-threaded worker
    if (Date.now() - (lastReconcile.current.get(col.id) ?? 0) < 30000) return;
    lastReconcile.current.set(col.id, Date.now());
    api.reindex(col.id);
  }, []);
  useEffect(() => { reconcileNow(); }, [ex.path, reconcileNow]); // navigate
  useEffect(() => { window.addEventListener("focus", reconcileNow); return () => window.removeEventListener("focus", reconcileNow); }, [reconcileNow]);

  // Local reminders: poll for due notes and hand them to the toast window.
  // (Fires only while the app is running — the known ceiling of a local, no-OS
  // reminder; a future connector/plugin can schedule at the OS level.)
  useEffect(() => {
    if (!isTauri) return;
    checkDueReminders();
    const id = setInterval(() => checkDueReminders(), 5000); // ≤5s late; swap to per-reminder setTimeout if exactness ever matters
    return () => clearInterval(id);
  }, []);

  // Toast → main: Snooze reschedules; Open brings the main window forward,
  // navigates to Keep, and asks the Keep view to open that note's editor.
  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | null = null;
    listen<ReminderAction>(REMINDER_ACTION_EVENT, ({ payload }) => {
      if (payload.action === "snooze") {
        updateNote(payload.id, { remindAt: Date.now() + SNOOZE_MS, reminderDone: false });
      } else if (payload.action === "open") {
        exRef.current.navigate("lattice://keep");
        const w = getCurrentWindow();
        // unminimize + show before focus, or a minimized window never comes forward
        (async () => { try { await w.unminimize(); await w.show(); await w.setFocus(); } catch { /* not tauri */ } })();
        emit(REMINDER_OPEN_EVENT, payload.id).catch(() => {});
      }
    }).then((fn) => { un = fn; });
    return () => { un?.(); };
  }, []);

  // commands dispatched from the Spotlight window (deduplicated & checks existing tab)
  const lastNavRef = useRef<{ path: string; time: number }>({ path: "", time: 0 });

  useEffect(() => {
    let unlistenNav: (() => void) | null = null;
    let unlistenOpen: (() => void) | null = null;

    const handleOpenDir = (targetPath: string) => {
      if (!targetPath) return;
      const now = Date.now();
      const norm = targetPath.toLowerCase().replace(/[\\/]+$/, "");
      if (lastNavRef.current.path === norm && now - lastNavRef.current.time < 500) {
        return; // ignore duplicate event dispatched within 500ms
      }
      lastNavRef.current = { path: norm, time: now };

      // If a tab with this path already exists, switch to it instead of creating duplicates
      const existing = ex.tabs.find((t) => (t.path || "").toLowerCase().replace(/[\\/]+$/, "") === norm);
      if (existing) {
        ex.selectTab(existing.id);
      } else {
        ex.newTab(targetPath);
      }
    };

    listen<string>("spotlight:navigate", (ev) => handleOpenDir(ev.payload)).then((fn) => { unlistenNav = fn; });
    listen<string>("spotlight:open", (ev) => handleOpenDir(ev.payload)).then((fn) => { unlistenOpen = fn; });

    return () => {
      if (unlistenNav) unlistenNav();
      if (unlistenOpen) unlistenOpen();
    };
  }, [ex.tabs, ex.selectTab, ex.newTab]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ex = exRef.current; // fresh explorer state (effect deps are [])
      if (e.key === "F1") { e.preventDefault(); ex.openDocTab(); return; }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        ex.newFolder();
        return;
      }
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNewFileFolder(ex.path);
        return;
      }
      if (ctrl && e.key.toLowerCase() === "f") {
        if (document.querySelector(".editor-wrapper")) return;
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "l") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("lattice-edit-path"));
        return;
      }
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
  }, []); // stable — reads exRef.current, not ex directly

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

  // Gracefully fade out and remove initial cold-boot splash screen.
  // Hold at least one full lettermark cycle from page load (fast prod builds
  // mount before the animation gets going), unless startup animation is off.
  useEffect(() => {
    const splash = document.getElementById("app-splash");
    if (splash) {
      if (document.documentElement.classList.contains("no-splash")) { splash.remove(); return; }
      const SPLASH_MIN_MS = 2000; // ~one reveal cycle of the wordmark draw
      const t0 = (window as unknown as { __splashT0?: number }).__splashT0 ?? Date.now();
      const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - t0));
      const timer = setTimeout(() => {
        splash.classList.add("splash-hidden");
        document.documentElement.setAttribute("data-revealed", ""); // app settles in behind the fading splash
        setTimeout(() => splash.remove(), 400);
      }, wait);
      return () => clearTimeout(timer);
    }
  }, []);

  const isFileTab = isFilePath(ex.path);
  const activePathLower = ex.path.toLowerCase();
  const isDocTab = activePathLower === "lattice://docs";
  const isKeepTab = activePathLower === "lattice://keep";
  const isKeepNoteTab = activePathLower.startsWith("lattice://keep/");
  const isHomeTab = activePathLower === "lattice://home";
  // Watson chat pane, available on every page (docs/keep/home included) when enabled.
  const watson = ex.chatOpen && aiPaneEnabled ? <WatsonChatPane ex={ex} onClose={() => ex.setChatOpen(false)} /> : null;

  return (
    <div className="app">
      <TitleBar ex={ex} />
      <TopBar
        ex={ex}
        s={s}
        onSettings={() => setSettingsOpen(true)}
        onToggleSidebar={isFileTab ? () => setFileTabSidebarOpen(!fileTabSidebarOpen) : undefined}
        sidebarOpen={fileTabSidebarOpen}
        onToggleChat={() => {
          if (ex.previewCollapsed) ex.togglePreview();
          ex.toggleChat();
        }}
        chatOpen={ex.chatOpen && !ex.previewCollapsed}
        aiPaneEnabled={aiPaneEnabled}
      />
      {isDocTab ? (
        <div className="body" style={{ gridTemplateColumns: watson ? "1fr 320px" : "1fr" }}>
          <DocumentationViewer />
          {watson}
        </div>
      ) : isHomeTab ? (
        <div className="body" style={{ gridTemplateColumns: watson ? "232px 1fr 320px" : "232px 1fr" }}>
          <Sidebar ex={ex} />
          <HomePage ex={ex} />
          {watson}
        </div>
      ) : isKeepTab ? (
        <div className="body" style={{ gridTemplateColumns: watson ? "232px 1fr 320px" : "232px 1fr" }}>
          <Sidebar ex={ex} />
          <KeepCanvas ex={ex} />
          {watson}
        </div>
      ) : isKeepNoteTab ? (
        <div className="body" style={{ gridTemplateColumns: `${fileTabSidebarOpen ? "232px " : ""}1fr${watson ? " 320px" : ""}` }}>
          {fileTabSidebarOpen && <Sidebar ex={ex} />}
          <div className="tab-file-panel isolated">
            <TextEditor
              key={ex.activeTabId + ":" + ex.path}
              entry={{
                name: (getNote(ex.path.slice("lattice://keep/".length))?.title || "Note") + ".md",
                path: ex.path,
                is_dir: false,
                size: 0,
                modified: null,
                kind: "code",
                type_label: "Keep Note",
                hidden: false,
              }}
              onClose={() => ex.closeTab(ex.activeTabId)}
              onOpenPath={(targetPath) => { ex.newTab(targetPath); }}
              isFullTab={true}
            />
          </div>
          {watson}
        </div>
      ) : isFileTab ? (
        <div className="body" style={{ gridTemplateColumns: `${fileTabSidebarOpen ? "232px " : ""}1fr${watson ? " 320px" : ""}` }}>
          {fileTabSidebarOpen && <Sidebar ex={ex} />}
          <div className="tab-file-panel isolated">
            {activePathLower.endsWith(".pdf") ? (
              <PdfViewer
                key={ex.activeTabId + ":" + ex.path}
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "document", type_label: "PDF File", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : activePathLower.endsWith(".ipynb") ? (
              <JupyterViewer
                key={ex.activeTabId + ":" + ex.path}
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "code", type_label: "Jupyter Notebook", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : isSpreadsheet(ex.path) ? (
              <SpreadsheetViewer
                key={ex.activeTabId + ":" + ex.path}
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "document", type_label: "Spreadsheet", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : isImage(ex.path) ? (
              <ImageViewer
                key={ex.activeTabId + ":" + ex.path}
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "image", type_label: "Image File", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
              />
            ) : (
              <TextEditor
                key={ex.activeTabId + ":" + ex.path}
                entry={{ name: baseName(ex.path), path: ex.path, is_dir: false, size: 0, modified: null, kind: "code", type_label: "File", hidden: false }}
                onClose={() => ex.closeTab(ex.activeTabId)}
                onOpenPath={(targetPath) => { ex.newTab(targetPath); }}
                isFullTab={true}
              />
            )}
          </div>
          {watson}
        </div>
      ) : (
        <div className={"body" + (ex.splitItem ? " split-active" : "") + (ex.splitItem && watson ? " with-watson" : "") + (ex.previewCollapsed ? " no-preview" : "")}>
          {!ex.splitItem && <Sidebar ex={ex} />}
          <FileList ex={ex} />

          {ex.splitItem && (
            <div className="split-view-panel">
              {ex.splitItem.name.toLowerCase().endsWith(".pdf") ? (
                <PdfViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
              ) : ex.splitItem.name.toLowerCase().endsWith(".ipynb") ? (
                <JupyterViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
              ) : isSpreadsheet(ex.splitItem.name) ? (
                <SpreadsheetViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
              ) : isImage(ex.splitItem.name) ? (
                <ImageViewer entry={ex.splitItem} onClose={ex.closeSplitItem} />
              ) : (
                <TextEditor entry={ex.splitItem} onClose={ex.closeSplitItem} onErrorToast={ex.showToast} onOpenPath={(targetPath) => { ex.newTab(targetPath); }} isFullTab={false} />
              )}
            </div>
          )}
          {ex.splitItem && watson}
          {!ex.splitItem && !ex.previewCollapsed && (
            ex.chatOpen && aiPaneEnabled ? (
              <WatsonChatPane ex={ex} onClose={() => ex.setChatOpen(false)} />
            ) : (
              <Inspector
                ex={ex}
                onCollapse={() => ex.togglePreview()}
              />
            )
          )}
          {!ex.splitItem && ex.previewCollapsed && (
            <button className="preview-reveal" onClick={() => ex.togglePreview()} title="Show preview pane">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
        </div>
      )}
      <ContextMenu
        ex={ex}
        onNewFile={(folderPath) => setNewFileFolder(folderPath)}
        onWatsonAction={aiPaneEnabled ? (req) => setWatsonModalReq(req) : undefined}
      />
      {watsonModalReq && (
        <WatsonActionModal
          request={watsonModalReq}
          onClose={() => setWatsonModalReq(null)}
          onToast={ex.showToast}
        />
      )}
      {newFileFolder && (
        <NewFileModal
          folderPath={newFileFolder}
          onClose={() => setNewFileFolder(null)}
          onCreated={(newPath) => {
            ex.refresh();
            ex.newTab(newPath);
          }}
        />
      )}
      <IndexStatus ind={ind} />
      {ex.toast && (
        <div className="index-toast done" style={{ color: "var(--paper)", zIndex: 100 }}>
          <span style={{ color: "var(--terracotta)", fontWeight: 700 }}>ℹ</span>
          &nbsp;{ex.toast}
        </div>
      )}
      {settingsOpen && <Settings ex={ex} ind={ind} th={th} onClose={() => setSettingsOpen(false)} />}
      {!onboarded && <Onboarding th={th} onDone={() => setOnboarded(true)} />}
      {!isTauri && <div className="scaffold-note">preview · mock data — run <b style={{ color: "var(--paper-dim)" }}>npm run tauri dev</b> for live files</div>}
    </div>
  );
}
