"use client";

import { useState } from "react";
import type { Scope } from "@/lib/api";
import { Avatar } from "./Badge";
import { PRINCIPAL_ID } from "@/lib/api";
import { initials } from "@/lib/format";

export function Sidebar({
  scopes,
  selectedScopeId,
  onSelect,
  onCreate,
  creating,
  focused,
  collapsed,
  onToggleCollapse,
}: {
  scopes: Scope[];
  selectedScopeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  creating: boolean;
  // Opened from Lattice for a single folder — hide the workspace switcher so
  // the full index's other workspaces don't distract from the one in focus.
  focused: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const selected = scopes.find((s) => s.id === selectedScopeId);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    onCreate(trimmed);
    setName("");
    setAdding(false);
  }

  // Collapsed rail: just the brand, an expand affordance, and the avatar.
  if (collapsed) {
    return (
      <div
        className="flex w-[52px] flex-none flex-col items-center gap-6 border-r py-7"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--color-accent)" }} />
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[15px]"
          style={{ color: "var(--color-muted)" }}
        >
          »
        </button>
        <div className="mt-auto">
          <Avatar label={initials(PRINCIPAL_ID)} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-[260px] flex-none flex-col gap-7 border-r px-5 py-7"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--color-accent)" }} />
          <div className="font-serif text-[21px] font-semibold tracking-tight">Index</div>
        </div>
        <button
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[15px]"
          style={{ color: "var(--color-muted)" }}
        >
          «
        </button>
      </div>

      {focused ? (
        // Single-folder focus: show only the workspace in view, no switcher.
        <div className="flex flex-col gap-1">
          <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--color-muted)" }}>
            Workspace
          </div>
          <div
            className="flex items-center gap-2 rounded-md px-2 py-2 text-[13.5px]"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-ink-soft)", fontWeight: 600 }}
          >
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--color-accent)" }} />
            <span className="min-w-0 flex-1 truncate">{selected?.name ?? "…"}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--color-muted)" }}>
            Workspaces
          </div>

          {scopes.map((scope) => {
            const active = scope.id === selectedScopeId;
            return (
              <button
                key={scope.id}
                onClick={() => onSelect(scope.id)}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-[13.5px] cursor-pointer"
                style={{
                  background: active ? "var(--color-accent-soft)" : "transparent",
                  color: active ? "var(--color-ink-soft)" : "var(--color-dim)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span
                  className="h-1.5 w-1.5 flex-none rounded-full"
                  style={{ background: active ? "var(--color-accent)" : "var(--color-border)" }}
                />
                <span className="min-w-0 flex-1 truncate">{scope.name}</span>
              </button>
            );
          })}

          {adding ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                }
              }}
              placeholder="Workspace name…"
              className="mt-1 rounded-md border px-2 py-2 text-[13.5px] outline-none"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              disabled={creating}
              className="mt-1 rounded-md px-2 py-2 text-left text-[13px] cursor-pointer"
              style={{ color: "var(--color-muted)" }}
            >
              + New workspace
            </button>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2.5 border-t pt-4" style={{ borderColor: "var(--color-border-soft)" }}>
        <Avatar label={initials(PRINCIPAL_ID)} />
        <div className="text-[12.5px]" style={{ color: "var(--color-dim)" }}>
          {PRINCIPAL_ID}
        </div>
      </div>
    </div>
  );
}
