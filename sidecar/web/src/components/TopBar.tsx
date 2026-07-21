"use client";

export type TabId = "overview" | "documents" | "viewer" | "ask";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "viewer", label: "Viewer" },
  { id: "ask", label: "Ask" },
];

export function TopBar({
  scopeName,
  memberCount,
  activeTab,
  onTabChange,
}: {
  scopeName: string;
  memberCount: number;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div
      className="flex flex-none flex-col gap-4 border-b px-11 pt-5.5"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {scopeName}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-dim)" }}
        >
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex gap-6.5">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="cursor-pointer pb-3 text-sm font-semibold"
              style={{
                color: active ? "var(--color-ink)" : "var(--color-muted)",
                borderBottom: `2px solid ${active ? "var(--color-accent)" : "transparent"}`,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
