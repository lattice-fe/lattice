"use client";

import { useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar, type TabId } from "@/components/TopBar";
import { OverviewTab } from "@/components/OverviewTab";
import { DocumentsTab } from "@/components/DocumentsTab";
import { ViewerTab } from "@/components/ViewerTab";
import { AskTab } from "@/components/AskTab";
import { useCreateScope, useDocuments, usePointerIndex, useScopes } from "@/lib/queries";

const LAST_SCOPE_KEY = "index.lastScopeId";

export default function Home() {
  const { data: scopes, isLoading: scopesLoading } = useScopes();
  const createScope = useCreateScope();

  // When Lattice opens this UI for a single folder it passes ?ws=<scopeId>.
  // That id both preselects the workspace and puts the app in "focused" mode,
  // hiding the workspace switcher (the rest of the index is out of scope here).
  const focusedScopeId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("ws");
  }, []);

  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  // Focused mode starts collapsed (out of the way); standalone starts open.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!!focusedScopeId);

  // Derived on render rather than in an effect (React's documented pattern
  // for "initialize state from data that just arrived"): setState here is
  // conditional on !selectedScopeId, so it only fires once and then bails
  // out via Object.is on every render after.
  if (scopes && !selectedScopeId) {
    const focusMatch = focusedScopeId && scopes.find((s) => s.id === focusedScopeId);
    const remembered = localStorage.getItem(LAST_SCOPE_KEY);
    const match = remembered && scopes.find((s) => s.id === remembered);
    const next = focusMatch ? focusedScopeId : match ? match.id : (scopes[0]?.id ?? null);
    if (next) setSelectedScopeId(next);
  }

  // Only treat the session as focused if the requested workspace actually exists.
  const focused = !!(focusedScopeId && scopes?.some((s) => s.id === focusedScopeId));

  function selectScope(id: string) {
    setSelectedScopeId(id);
    setActiveTab("overview");
    setSelectedDocumentId(null);
    localStorage.setItem(LAST_SCOPE_KEY, id);
  }

  function openDocument(id: string) {
    setSelectedDocumentId(id);
    setActiveTab("viewer");
  }

  const { data: documents } = useDocuments(selectedScopeId);
  const { data: pointerIndex } = usePointerIndex(selectedScopeId);
  const scope = scopes?.find((s) => s.id === selectedScopeId);

  if (scopesLoading) {
    return <div className="flex h-screen items-center justify-center text-sm" style={{ color: "var(--color-muted)" }}>Loading…</div>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        scopes={scopes ?? []}
        selectedScopeId={selectedScopeId}
        onSelect={selectScope}
        creating={createScope.isPending}
        focused={focused}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCreate={(name) =>
          createScope.mutate(
            { name },
            { onSuccess: (created) => selectScope(created.id) },
          )
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {!scope ? (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: "var(--color-muted)" }}>
            Create a workspace to get started.
          </div>
        ) : (
          <>
            <TopBar
              scopeName={scope.name}
              memberCount={scope.member_count}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div className="flex-1 overflow-y-auto px-11 py-9">
              {activeTab === "overview" && (
                <OverviewTab
                  documents={documents ?? []}
                  pointerIndex={pointerIndex}
                  memberCount={scope.member_count}
                  onOpenDocument={openDocument}
                />
              )}
              {activeTab === "documents" && (
                <DocumentsTab scopeId={scope.id} documents={documents ?? []} onOpenDocument={openDocument} />
              )}
              {activeTab === "viewer" &&
                (selectedDocumentId ? (
                  <ViewerTab scopeId={scope.id} documentId={selectedDocumentId} scopeName={scope.name} />
                ) : (
                  <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                    Select a document from Overview or Documents to view it here.
                  </div>
                ))}
              {activeTab === "ask" && (
                <AskTab scopeId={scope.id} scopeName={scope.name} docCount={documents?.length ?? 0} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
