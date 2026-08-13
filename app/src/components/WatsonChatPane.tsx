import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Explorer } from "../hooks/useExplorer";
import { streamAssistant, ToolStep, ModelMessage } from "../lib/assistant/client";
import { getAssistantConfig } from "../lib/assistant/config";
import { createNote } from "../lib/keep/store";
import { baseName } from "../lib/format";

interface WatsonChatPaneProps {
  ex: Explorer;
  onClose: () => void;
}

// In-memory tab-isolated conversation store (full model messages incl. tool turns).
const tabConversationsMap = new Map<number, ModelMessage[]>();

// Friendly labels for tool steps shown in the trace.
const TOOL_LABEL: Record<string, string> = {
  read_skill: "Reading skill",
  create_note: "Creating note", search_notes: "Searching notes", list_notes: "Listing notes",
  get_note: "Reading note", update_note: "Updating note", append_to_note: "Appending to note",
  toggle_checklist_item: "Updating checklist", delete_note: "Deleting note",
  search: "Searching", search_files: "Searching files", list_directory: "Reading folder",
  read_file_preview: "Reading file",
};
const labelFor = (n: string) => TOOL_LABEL[n] || n.replace(/_/g, " ");

// Pull rendered text / tool-call names out of a model message's content.
function textOf(m: ModelMessage): string {
  const c = m.content as any;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((p) => p.type === "text").map((p) => p.text).join("");
  return "";
}
function toolNamesOf(m: ModelMessage): string[] {
  const c = m.content as any;
  if (Array.isArray(c)) return c.filter((p) => p.type === "tool-call").map((p) => p.toolName);
  return [];
}

function StepRow({ label, status }: { label: string; status: ToolStep["status"] }) {
  const mark =
    status === "done" ? { ch: "✓", color: "var(--sage)" }
      : status === "error" ? { ch: "✕", color: "var(--terracotta)" }
        : { ch: "", color: "var(--amber)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11.5px", color: "var(--dim)", fontFamily: "var(--mono)", lineHeight: 1.8 }}>
      {status === "running" ? (
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--amber)", display: "inline-block", animation: "pulse 1.2s infinite", flexShrink: 0 }} />
      ) : (
        <span style={{ width: "6px", textAlign: "center", color: mark.color, fontSize: "10px", flexShrink: 0 }}>{mark.ch}</span>
      )}
      <span>{label}{status === "running" ? "…" : ""}</span>
    </div>
  );
}

export function WatsonChatPane({ ex, onClose }: WatsonChatPaneProps) {
  const tabId = ex.activeTabId;
  const [messages, setMessages] = useState<ModelMessage[]>(() => tabConversationsMap.get(tabId) || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");        // live assistant answer
  const [reasoning, setReasoning] = useState("");          // live thinking tokens (if the model emits them)
  const [liveSteps, setLiveSteps] = useState<ToolStep[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(tabConversationsMap.get(tabId) || []);
    setInput(""); setStreamText(""); setReasoning(""); setLiveSteps([]);
  }, [tabId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamText, reasoning, liveSteps]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const updateConversation = (next: ModelMessage[]) => {
    tabConversationsMap.set(tabId, next);
    setMessages(next);
  };

  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt ?? input).trim();
    if (!text || loading) return;

    const next: ModelMessage[] = [...messages, { role: "user", content: text }];
    updateConversation(next);
    setInput("");
    setLoading(true);
    setStreamText(""); setReasoning(""); setLiveSteps([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const config = getAssistantConfig();
      const selected = ex.selectedEntries.map((e) => e.path).join(", ");
      const context = `Active directory: ${ex.path}${selected ? `\nSelected items: ${selected}` : ""}`;

      const { messages: responseMsgs } = await streamAssistant(next, config, {
        systemContext: context,
        signal: controller.signal,
        onText: (d) => setStreamText((t) => t + d),
        onReasoning: (d) => setReasoning((t) => t + d),
        onStep: (s) => setLiveSteps((prev) => {
          const i = prev.findIndex((p) => p.id === s.id);
          if (i === -1) return [...prev, s];
          const copy = prev.slice();
          copy[i] = s;
          return copy;
        }),
      });

      updateConversation([...next, ...responseMsgs]);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        updateConversation([...next, { role: "assistant", content: `Error: ${err?.message || "Failed to get response from Watson."}` }]);
      }
    } finally {
      setLoading(false);
      setStreamText(""); setReasoning(""); setLiveSteps([]);
      abortRef.current = null;
    }
  };

  const handleStop = () => abortRef.current?.abort();

  const handleCopy = async (idx: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSaveToKeep = (idx: number, text: string) => {
    createNote({
      title: `Watson Note (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
      content: text,
      color: "amber",
      author: "watson",
      pinned: true,
    });
    setSavedIdx(idx);
    ex.showToast("Saved conversation turn to Keep notes");
    setTimeout(() => setSavedIdx(null), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    tabConversationsMap.delete(tabId);
    setMessages([]);
    setInput(""); setStreamText(""); setReasoning(""); setLiveSteps([]);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <aside
      className="inspector watson-chat-pane"
      style={{
        display: "flex", flexDirection: "column", height: "100%", padding: "0",
        background: "var(--ink)", borderLeft: "1px solid var(--border-soft)", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--ink-2)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'Syne Mono', monospace, var(--mono)", fontSize: "12px", fontWeight: "600", color: "var(--paper)", border: "1px solid var(--amber)", borderRadius: "9999px", padding: "2px 8px", lineHeight: "1.2" }}>
            Watson
          </span>
          <span style={{ fontSize: "12px", color: "var(--dim)", fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }} title={ex.path}>
            {baseName(ex.path) || "Workspace"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button type="button" className="iconbtn" onClick={handleNewChat} title="New Conversation" style={{ width: "26px", height: "26px", fontSize: "11px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
            </svg>
          </button>
          <button type="button" className="iconbtn" onClick={onClose} title="Close Chat Pane" style={{ width: "26px", height: "26px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {isEmpty ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "20px 10px", gap: "14px" }}>
            <div style={{ fontSize: "13px", color: "var(--dim)", lineHeight: "1.5" }}>
              Ask Watson about files, search notes, or manage your workspace.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", maxWidth: "260px" }}>
              {["What is in this folder?", "List my pinned notes", "Create a checklist for today"].map((suggestion) => (
                <button
                  key={suggestion} type="button" onClick={() => handleSend(suggestion)}
                  style={{ fontSize: "11.5px", padding: "7px 10px", background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", color: "var(--paper-dim)", textAlign: "left", cursor: "pointer", transition: "all 0.1s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--amber)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-soft)")}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role !== "user" && msg.role !== "assistant") return null; // hide tool/system turns
            const isUser = msg.role === "user";
            const body = textOf(msg);
            const steps = isUser ? [] : toolNamesOf(msg);
            if (!isUser && !body.trim() && steps.length === 0) return null;

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: isUser ? "88%" : "100%", width: isUser ? "auto" : "100%" }}>
                {/* Tool step trace (completed) */}
                {steps.length > 0 && (
                  <div style={{ marginBottom: body.trim() ? "6px" : "0", paddingLeft: "2px" }}>
                    {steps.map((n, i) => <StepRow key={i} label={labelFor(n)} status="done" />)}
                  </div>
                )}
                {/* Bubble */}
                {(isUser || body.trim()) && (
                  <div
                    style={{ background: isUser ? "var(--ink-2)" : "transparent", border: isUser ? "1px solid var(--border)" : "none", borderRadius: "var(--radius)", padding: isUser ? "8px 12px" : "4px 2px", fontSize: "13px", lineHeight: "1.55", color: "var(--paper)", wordBreak: "break-word" }}
                    className={!isUser ? "doc-content-body" : undefined}
                  >
                    {isUser ? <span>{body}</span> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>}
                  </div>
                )}
                {/* Turn actions */}
                {!isUser && body.trim() && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                    <button type="button" onClick={() => handleCopy(idx, body)} style={{ background: "transparent", border: "none", fontSize: "10.5px", color: "var(--dim)", cursor: "pointer", padding: "2px 4px" }}>
                      {copiedIdx === idx ? "Copied" : "Copy"}
                    </button>
                    <span style={{ color: "var(--dim-2)", fontSize: "10px" }}>·</span>
                    <button type="button" onClick={() => handleSaveToKeep(idx, body)} style={{ background: "transparent", border: "none", fontSize: "10.5px", color: savedIdx === idx ? "var(--sage)" : "var(--amber)", cursor: "pointer", padding: "2px 4px" }}>
                      {savedIdx === idx ? "Saved to Keep" : "Save to Keep"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Live in-progress turn */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignSelf: "flex-start", width: "100%" }}>
            {liveSteps.length > 0 && (
              <div style={{ paddingLeft: "2px" }}>
                {liveSteps.map((s) => <StepRow key={s.id} label={labelFor(s.name)} status={s.status} />)}
              </div>
            )}
            {reasoning.trim() && (
              <div style={{ fontSize: "11.5px", fontStyle: "italic", color: "var(--dim-2)", lineHeight: 1.5, borderLeft: "2px solid var(--border)", paddingLeft: "8px", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}>
                {reasoning}
              </div>
            )}
            {streamText.trim() ? (
              <div className="doc-content-body" style={{ fontSize: "13px", lineHeight: "1.55", color: "var(--paper)", padding: "4px 2px" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
              </div>
            ) : liveSteps.length === 0 && !reasoning.trim() ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 2px", color: "var(--dim)", fontSize: "12.5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--amber)", display: "inline-block", animation: "pulse 1.2s infinite" }} />
                <span>Watson is thinking…</span>
              </div>
            ) : null}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-soft)", background: "var(--ink-2)", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef} rows={1} value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask Watson (Enter to send)..."
            style={{ flex: 1, background: "var(--ink)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--paper)", fontSize: "12.5px", padding: "7px 9px", resize: "none", maxHeight: "80px", minHeight: "32px", outline: "none", fontFamily: "inherit", lineHeight: "1.4" }}
          />
          <button
            type="button"
            onClick={() => (loading ? handleStop() : handleSend())}
            disabled={!loading && !input.trim()}
            title={loading ? "Stop" : "Send"}
            style={{ height: "32px", padding: "0 10px", fontSize: "11.5px", fontWeight: 600, borderRadius: "var(--radius-sm)", background: loading ? "var(--ink-3)" : "var(--amber)", border: loading ? "1px solid var(--border)" : "none", color: loading ? "var(--paper)" : "var(--ink)", cursor: !loading && !input.trim() ? "default" : "pointer", opacity: !loading && !input.trim() ? 0.5 : 1, flexShrink: 0 }}
          >
            {loading ? "Stop" : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}
