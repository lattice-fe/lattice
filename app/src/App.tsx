import { useEffect } from "react";
import { useExplorer } from "./hooks/useExplorer";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { FileList } from "./components/FileList";
import { Inspector } from "./components/Inspector";
import { ContextMenu } from "./components/ContextMenu";
import { isTauri } from "./lib/api";
import "./lattice.css";

export default function App() {
  const ex = useExplorer();

  // global keyboard shortcuts (ignored while typing in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
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
      else if (e.key === "Escape") { ex.closeContext(); ex.clearSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex]);

  return (
    <div className="app">
      <TopBar ex={ex} />
      <div className="body">
        <Sidebar ex={ex} />
        <FileList ex={ex} />
        <Inspector ex={ex} />
      </div>
      <ContextMenu ex={ex} />
      {!isTauri && <div className="scaffold-note">preview · mock data — run <b style={{ color: "var(--paper-dim)" }}>npm run tauri dev</b> for live files</div>}
    </div>
  );
}
