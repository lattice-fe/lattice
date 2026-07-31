import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useExplorer } from "./hooks/useExplorer";
import { useSearch } from "./hooks/useSearch";
import { useIndexer } from "./hooks/useIndexer";
import { IndexStatus } from "./components/IndexStatus";
import { Settings } from "./components/Settings";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { FileList } from "./components/FileList";
import { SearchResults } from "./components/SearchResults";
import { Inspector } from "./components/Inspector";
import { ContextMenu } from "./components/ContextMenu";
import { isTauri } from "./lib/api";
import "./lattice.css";

export default function App() {
  const ex = useExplorer();
  const s = useSearch();
  const ind = useIndexer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const exRef = useRef(ex);
  exRef.current = ex;

  // browsing to a new folder ends an active search
  useEffect(() => { s.clear(); }, [ex.path, s.clear]);

  // commands dispatched from the Spotlight window
  useEffect(() => {
    if (!isTauri) return;
    const subs = [
      listen<string>("spotlight:navigate", (e) => exRef.current.navigate(e.payload)),
      listen("spotlight:open-settings", () => setSettingsOpen(true)),
    ];
    return () => { subs.forEach((p) => p.then((u) => u())); };
  }, []);

  // global keyboard shortcuts (ignored while typing in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "f") { e.preventDefault(); document.querySelector<HTMLInputElement>(".search input")?.focus(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const only = ex.selectedEntries[0];
      if (ctrl && e.key === "a") { e.preventDefault(); ex.selectAll(); }
      else if (ctrl && e.key === "c") ex.copySel();
      else if (ctrl && e.key === "x") ex.cutSel();
      else if (ctrl && e.key === "v") ex.paste();
      else if (ctrl && e.key === "h") { e.preventDefault(); ex.toggleHidden(); }
      else if (e.key === "Enter" && only) ex.openEntry(only);
      else if (e.key === "F2" && ex.sel.size === 1 && only) ex.startRename(only.path);
      else if (e.key === "Delete" && ex.sel.size) ex.deleteSel();
      else if (e.key === "Backspace") ex.up();
      else if (e.altKey && e.key === "ArrowLeft") ex.back();
      else if (e.altKey && e.key === "ArrowRight") ex.forward();
      else if (e.key === "Escape") { setSettingsOpen(false); ex.closeContext(); ex.clearSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex]);

  return (
    <div className="app">
      <TopBar ex={ex} s={s} onSettings={() => setSettingsOpen(true)} />
      <div className="body">
        <Sidebar ex={ex} />
        {s.active ? <SearchResults s={s} ex={ex} /> : <FileList ex={ex} />}
        <Inspector ex={ex} />
      </div>
      <ContextMenu ex={ex} />
      <IndexStatus ind={ind} />
      {settingsOpen && <Settings ex={ex} ind={ind} onClose={() => setSettingsOpen(false)} />}
      {!isTauri && <div className="scaffold-note">preview · mock data — run <b style={{ color: "var(--paper-dim)" }}>npm run tauri dev</b> for live files</div>}
    </div>
  );
}
