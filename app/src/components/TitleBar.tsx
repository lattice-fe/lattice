import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Explorer } from "../hooks/useExplorer";
import { baseName } from "../lib/format";
import { Mark } from "../lib/icons";
import { isTauri } from "../lib/api";

function tabTitle(path: string): string {
  return baseName(path) || path.replace(/[\\/]+$/, "") || "This PC";
}

const win = () => getCurrentWindow();

// Window-control glyphs (10×10, stroked so they inherit the theme colour).
const MinIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11"><line x1="1.5" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.1" /></svg>);
const MaxIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1"><rect x="1.7" y="1.7" width="7.6" height="7.6" rx="1.2" /></svg>);
const RestoreIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1"><rect x="1.4" y="3.1" width="6.1" height="6.1" rx="1" /><path d="M3.5 3.1 V1.5 H9.5 V7.5 H7.6" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="14" height="14" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M2.2 2.2 L8.8 8.8 M8.8 2.2 L2.2 8.8" /></svg>);

export function TitleBar({ ex }: { ex: Explorer }) {
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    const w = win();
    w.isMaximized().then(setMaxed).catch(() => {});
    const un = w.onResized(() => w.isMaximized().then(setMaxed).catch(() => {}));
    return () => { un.then((f) => f()).catch(() => {}); };
  }, []);

  const minimize = () => { if (isTauri) win().minimize(); };
  const toggleMax = () => { if (isTauri) win().toggleMaximize(); };
  const close = () => { if (isTauri) win().close(); }; // → CloseRequested → hides to tray

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-logo" data-tauri-drag-region title="Lattice"><Mark /></div>
      <div className="titlebar-tabs">
        {ex.tabs.map((t) => (
          <div
            key={t.id}
            className={"tab" + (t.id === ex.activeTabId ? " active" : "")}
            title={t.path}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); ex.closeTab(t.id); } else if (e.button === 0) ex.selectTab(t.id); }}
          >
            <span className="tab-dot" />
            <span className="tab-title">{tabTitle(t.path)}</span>
            {ex.tabs.length > 1 && (
              <button className="tab-x" title="Close tab" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); ex.closeTab(t.id); }}>×</button>
            )}
          </div>
        ))}
        <button className="tab-new" title="New tab (Ctrl+T)" onClick={() => ex.newTab()}>+</button>
      </div>

      <div className="titlebar-drag" data-tauri-drag-region onDoubleClick={toggleMax} />

      <div className="winctrls">
        <button className="winctrl" title="Minimize" onClick={minimize}><MinIcon /></button>
        <button className="winctrl" title={maxed ? "Restore" : "Maximize"} onClick={toggleMax}>{maxed ? <RestoreIcon /> : <MaxIcon />}</button>
        <button className="winctrl close" title="Close" onClick={close}><CloseIcon /></button>
      </div>
    </div>
  );
}
