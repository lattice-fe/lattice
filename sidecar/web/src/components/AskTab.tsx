"use client";

import { useState } from "react";
import { Markdown } from "./Markdown";
import {
  useCreateSession,
  useDeleteSession,
  useSendMessage,
  useSession,
  useSessions,
} from "@/lib/queries";
import { relativeTime } from "@/lib/format";

function sessionStorageKey(scopeId: string) {
  return `index.lastSessionId.${scopeId}`;
}

export function AskTab({ scopeId, scopeName, docCount }: { scopeId: string; scopeName: string; docCount: number }) {
  const { data: sessions } = useSessions(scopeId);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { data: activeSession } = useSession(scopeId, activeSessionId);
  const createSession = useCreateSession(scopeId);
  const deleteSession = useDeleteSession(scopeId);
  const sendMessage = useSendMessage(scopeId);
  const [question, setQuestion] = useState("");
  const [listCollapsed, setListCollapsed] = useState(false);

  // Restore the last-used session for this workspace, falling back to the
  // most recently active one once sessions load. Derived on render (React's
  // documented pattern) rather than in an effect: gated on !activeSessionId
  // so it fires once, then bails out via Object.is on later renders.
  if (sessions && !activeSessionId) {
    const remembered = localStorage.getItem(sessionStorageKey(scopeId));
    const match = remembered && sessions.find((s) => s.id === remembered);
    const next = match ? match.id : (sessions[0]?.id ?? null);
    if (next) setActiveSessionId(next);
  }

  function selectSession(id: string) {
    setActiveSessionId(id);
    localStorage.setItem(sessionStorageKey(scopeId), id);
  }

  async function startNewConversation() {
    const created = await createSession.mutateAsync(undefined);
    selectSession(created.id);
  }

  async function removeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteSession.mutateAsync(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      localStorage.removeItem(sessionStorageKey(scopeId));
    }
  }

  async function send() {
    const q = question.trim();
    if (!q || sendMessage.isPending) return;
    setQuestion("");
    sendMessage.reset();

    let sessionId = activeSessionId;
    if (!sessionId) {
      const created = await createSession.mutateAsync(undefined);
      sessionId = created.id;
      selectSession(sessionId);
    }
    try {
      await sendMessage.mutateAsync({ sessionId, question: q });
    } catch {
      // sendMessage.isError renders the failure banner below.
    }
  }

  const messages = activeSession?.messages ?? [];

  return (
    <div className="flex h-full max-w-[980px] gap-9">
      {listCollapsed ? (
        <div className="flex w-[44px] flex-none flex-col items-center gap-3">
          <button
            onClick={() => setListCollapsed(false)}
            title="Show conversations"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[15px]"
            style={{ color: "var(--color-muted)" }}
          >
            »
          </button>
          <button
            onClick={startNewConversation}
            title="New conversation"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border text-[16px]"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-accent-ink)" }}
          >
            +
          </button>
        </div>
      ) : (
      <div className="flex w-[220px] flex-none flex-col gap-1">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={startNewConversation}
            className="flex-1 cursor-pointer rounded-md border px-3 py-2 text-left text-[12.5px] font-medium"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-accent-ink)" }}
          >
            + New conversation
          </button>
          <button
            onClick={() => setListCollapsed(true)}
            title="Hide conversations"
            className="flex h-8 w-7 flex-none cursor-pointer items-center justify-center rounded-md text-[15px]"
            style={{ color: "var(--color-muted)" }}
          >
            «
          </button>
        </div>
        {(sessions ?? []).map((s) => {
          const active = s.id === activeSessionId;
          return (
            <button
              key={s.id}
              onClick={() => selectSession(s.id)}
              className="group flex items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-[12.5px] cursor-pointer"
              style={{
                background: active ? "var(--color-accent-soft)" : "transparent",
                color: active ? "var(--color-ink-soft)" : "var(--color-dim)",
              }}
            >
              <span className="min-w-0 flex-1 truncate">{s.title ?? "New conversation"}</span>
              <span
                onClick={(e) => removeSession(s.id, e)}
                className="flex-none opacity-0 group-hover:opacity-100"
                style={{ color: "var(--color-muted)" }}
              >
                ×
              </span>
            </button>
          );
        })}
        {sessions?.length === 0 && (
          <div className="px-2.5 py-2 text-[12px]" style={{ color: "var(--color-muted)" }}>
            No conversations yet.
          </div>
        )}
      </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-7 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--color-muted)" }}>
          Answering using {docCount} document{docCount === 1 ? "" : "s"} in {scopeName} only
        </div>

        <div className="flex flex-1 flex-col gap-8.5 overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-sm" style={{ color: "var(--color-muted)" }}>
              Ask anything about the documents in this workspace.
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="font-serif text-[17px] italic" style={{ color: "var(--color-ink-soft)" }}>
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-3 -mt-5">
                <div className="text-[15px] leading-[1.7]" style={{ color: "var(--color-ink-soft)" }}>
                  <Markdown>{m.content}</Markdown>
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {dedupe(m.sources.map((s) => s.external_ref)).map((ref, j) => (
                      <span
                        key={j}
                        className="rounded-full px-2.5 py-1 text-[11.5px]"
                        style={{ background: "var(--color-neutral-soft)", color: "var(--color-neutral-ink)" }}
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                  {relativeTime(m.created_at)}
                </div>
              </div>
            ),
          )}
          {sendMessage.isPending && (
            <div className="text-sm" style={{ color: "var(--color-muted)" }}>
              Thinking…
            </div>
          )}
          {sendMessage.isError && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "var(--color-error-soft)", color: "var(--color-error-ink)" }}
            >
              Something went wrong answering that — try asking again.
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2.5 pt-6.5">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Ask about this workspace…"
            className="flex-1 rounded-full border px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}
          />
          <button
            onClick={send}
            disabled={sendMessage.isPending}
            className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full text-lg disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-surface)" }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
