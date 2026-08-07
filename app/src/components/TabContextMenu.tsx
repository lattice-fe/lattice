import { useState, useRef, useLayoutEffect } from "react";
import { Explorer } from "../hooks/useExplorer";

const GROUP_COLORS: { name: string; hex: string }[] = [
  { name: "Amber", hex: "var(--amber)" },
  { name: "Teal", hex: "var(--teal)" },
  { name: "Terracotta", hex: "var(--terracotta)" },
  { name: "Purple", hex: "#a78bfa" },
  { name: "Blue", hex: "#60a5fa" },
];

export interface TabCtxState {
  x: number;
  y: number;
  tabId: number;
  path: string;
}

export function TabContextMenu({
  ex,
  ctx,
  onClose,
}: {
  ex: Explorer;
  ctx: TabCtxState | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: ctx?.x ?? 0, top: ctx?.y ?? 0 });
  const [showGroupSub, setShowGroupSub] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isNamingGroup, setIsNamingGroup] = useState(false);

  useLayoutEffect(() => {
    if (!ctx || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    setPos({
      left: Math.max(8, Math.min(ctx.x, maxX)),
      top: Math.max(8, Math.min(ctx.y, maxY)),
    });
  }, [ctx]);

  if (!ctx) return null;

  const currentGroup = ex.groups.find((g) => g.tabIds.includes(ctx.tabId));

  const Item = ({
    label,
    on,
    danger,
    kbd,
  }: {
    label: string;
    on: () => void;
    danger?: boolean;
    kbd?: string;
  }) => (
    <button
      type="button"
      className={"menu-item" + (danger ? " danger" : "")}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        on();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        on();
      }}
    >
      <span>{label}</span>
      {kbd && <span className="menu-kbd">{kbd}</span>}
    </button>
  );

  const Sep = () => <div className="menu-sep" />;

  return (
    <div
      className="menu-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className="menu"
        style={{
          left: pos.left,
          top: pos.top,
          maxHeight: "calc(100vh - 20px)",
          overflowY: "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Item
          label="Close tab"
          on={() => {
            ex.closeTab(ctx.tabId);
            onClose();
          }}
          kbd="Ctrl W"
        />
        {ex.tabs.length > 1 && (
          <>
            <Item
              label="Close other tabs"
              on={() => {
                ex.closeOtherTabs(ctx.tabId);
                onClose();
              }}
            />
            <Item
              label="Close tabs to the right"
              on={() => {
                ex.closeTabsToRight(ctx.tabId);
                onClose();
              }}
            />
          </>
        )}
        <Item
          label="Duplicate tab"
          on={() => {
            ex.duplicateTab(ctx.tabId);
            onClose();
          }}
        />
        <Item
          label="Copy path"
          on={() => {
            navigator.clipboard.writeText(ctx.path).catch(() => {});
            onClose();
          }}
        />

        <Sep />

        {/* Tab Groups Actions */}
        {currentGroup ? (
          <>
            <Item
              label={`Remove from "${currentGroup.name}"`}
              on={() => {
                ex.removeTabFromGroup(ctx.tabId);
                onClose();
              }}
            />
            <Item
              label={`Close "${currentGroup.name}" group`}
              on={() => {
                ex.closeGroupTabs(currentGroup.id);
                onClose();
              }}
              danger
            />
          </>
        ) : (
          <>
            {!isNamingGroup ? (
              <Item
                label="Add to new group..."
                on={() => setIsNamingGroup(true)}
              />
            ) : (
              <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const name = newGroupName.trim() || "Group";
                      ex.createGroup(name, "var(--amber)", [ctx.tabId]);
                      onClose();
                    } else if (e.key === "Escape") {
                      setIsNamingGroup(false);
                    }
                  }}
                  placeholder="Group name..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "var(--ink-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--paper)",
                    fontSize: "12px",
                    padding: "4px 6px",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                  {GROUP_COLORS.map((col) => (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => {
                        const name = newGroupName.trim() || "Group";
                        ex.createGroup(name, col.hex, [ctx.tabId]);
                        onClose();
                      }}
                      title={col.name}
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: col.hex,
                        border: "2px solid transparent",
                        cursor: "pointer",
                        transition: "border-color 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--paper)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                    />
                  ))}
                </div>
              </div>
            )}

            {ex.groups.length > 0 && (
              <>
                <Item
                  label="Add to existing group"
                  on={() => setShowGroupSub(!showGroupSub)}
                />
                {showGroupSub && (
                  <div style={{ paddingLeft: "10px" }}>
                    {ex.groups.map((g) => (
                      <Item
                        key={g.id}
                        label={`• ${g.name}`}
                        on={() => {
                          ex.addTabToGroup(g.id, ctx.tabId);
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
