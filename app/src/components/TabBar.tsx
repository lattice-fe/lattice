import { Explorer } from "../hooks/useExplorer";
import { baseName } from "../lib/format";

function tabTitle(path: string): string {
  return baseName(path) || path.replace(/[\\/]+$/, "") || "This PC";
}

export function TabBar({ ex }: { ex: Explorer }) {
  return (
    <div className="tabbar">
      <div className="tabs">
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
              <button
                className="tab-x"
                title="Close tab"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); ex.closeTab(t.id); }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="tab-new" title="New tab (Ctrl+T)" onClick={() => ex.newTab()}>+</button>
    </div>
  );
}
