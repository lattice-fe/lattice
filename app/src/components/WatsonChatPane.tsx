import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Explorer } from "../hooks/useExplorer";
import { streamAssistant, ToolStep, ModelMessage } from "../lib/assistant/client";
import { getAssistantConfig } from "../lib/assistant/config";
import { createNote } from "../lib/keep/store";
import { baseName, isFilePath, parentOf } from "../lib/format";
import { api, Entry, searchOnce } from "../lib/api";
import { Glyph, TONE, kindOf } from "../lib/icons";
import { ThinkingIndicator } from "./ThinkingIndicator";

type Attach = { name: string; path: string; isDir: boolean };

interface WatsonChatPaneProps {
  ex: Explorer;
  onClose: () => void;
}

// In-memory tab-isolated conversation store (full model messages incl. tool turns).
const tabConversationsMap = new Map<number, ModelMessage[]>();

// Short verb per tool, used when we can show the target (path / query / title).
const TOOL_VERB: Record<string, string> = {
  read_file_preview: "Reading", list_directory: "Reading folder",
  search: "Searching", search_files: "Searching", search_notes: "Searching notes",
  read_skill: "Reading skill", get_note: "Reading note", create_note: "Creating note",
  update_note: "Updating note", append_to_note: "Appending to note", delete_note: "Deleting note",
  toggle_checklist_item: "Checking off in",
};
// Fallback labels when there's no target to show.
const TOOL_LABEL: Record<string, string> = {
  read_skill: "Reading skill",
  create_note: "Creating note", search_notes: "Searching notes", list_notes: "Listing notes",
  get_note: "Reading note", update_note: "Updating note", append_to_note: "Appending to note",
  toggle_checklist_item: "Updating checklist", delete_note: "Deleting note",
  search: "Searching", search_files: "Searching files", list_directory: "Reading folder",
  read_file_preview: "Reading file",
};
const labelFor = (n: string) => TOOL_LABEL[n] || n.replace(/_/g, " ");

// The one arg worth showing (path/query/title) out of a tool-call part.
function argDetail(inp: any): string | undefined {
  const v = inp?.path ?? inp?.query ?? inp?.title ?? inp?.name ?? inp?.skill_name;
  return typeof v === "string" && v.trim() ? v : undefined;
}
// A path relative to the active dir → "./sub/file"; outside cwd → basename.
function relativize(p: string, cwd: string): string {
  const a = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const c = (cwd || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (c && a.toLowerCase() === c.toLowerCase()) return "./";
  if (c && a.toLowerCase().startsWith(c.toLowerCase() + "/")) return "./" + a.slice(c.length + 1);
  return baseName(a);
}
// Verb (top line) + target (below): { "Reading", "./README.md" } / { "Searching", '"auth"' }.
function stepParts(name: string, detail: string | undefined, cwd: string): { verb: string; target: string } {
  if (!detail) return { verb: labelFor(name), target: "" };
  const looksPath = /[\\/]/.test(detail) || /^[A-Za-z]:/.test(detail);
  return { verb: TOOL_VERB[name] ?? labelFor(name), target: looksPath ? relativize(detail, cwd) : `"${detail}"` };
}

// Pull rendered text / tool-call steps out of a model message's content.
function textOf(m: ModelMessage): string {
  const c = m.content as any;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((p) => p.type === "text").map((p) => p.text).join("");
  return "";
}
function toolStepsOf(m: ModelMessage): { name: string; detail?: string }[] {
  const c = m.content as any;
  if (Array.isArray(c)) return c.filter((p) => p.type === "tool-call").map((p) => ({ name: p.toolName, detail: argDetail(p.input ?? p.args) }));
  return [];
}

// A tool-call rendered as a pill: scan-line while running, ✓ (teal) done, ✕ error.
// Live pills always show the scan for at least SCAN_MIN_MS so a fast tool call
// (which flips running→done in a few ms) still animates visibly.
const SCAN_MIN_MS = 750;
function StepPill({ verb, target, status, live }: { verb: string; target: string; status: ToolStep["status"]; live?: boolean }) {
  const mountRef = useRef(Date.now());
  const [display, setDisplay] = useState<ToolStep["status"]>(live ? "running" : status);
  useEffect(() => {
    if (!live) { setDisplay(status); return; }          // persisted → instant, no forced scan
    if (status === "running") { setDisplay("running"); return; }
    const wait = Math.max(0, SCAN_MIN_MS - (Date.now() - mountRef.current)); // hold the scan a beat
    const t = setTimeout(() => setDisplay(status), wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, live]);
  return (
    <div className="wp-pill">
      <span className="wp-pill-icon">
        {display === "running" ? (
          <span className="wp-scan-box"><span className="wp-scan-line" /></span>
        ) : display === "error" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        )}
      </span>
      <span className="wp-pill-text">
        <span className="wp-pill-verb">{verb}</span>
        {target && <span className="wp-pill-target">{target}</span>}
      </span>
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

  // @-mention file attachments (pills) + live completion dropdown.
  const [attached, setAttached] = useState<Attach[]>([]);
  const [mQuery, setMQuery] = useState<string | null>(null); // text after "@" being completed; null = inactive
  const [sug, setSug] = useState<Attach[]>([]);
  const [sugIdx, setSugIdx] = useState(0);

  // Dir the @-completion lists: the folder itself, or a file tab's parent folder.
  const compDir = isFilePath(ex.path) ? (parentOf(ex.path) ?? "") : ex.path;
  // The file currently open in this tab, auto-attached so Watson has its context.
  const seedAttach = (): Attach[] => (isFilePath(ex.path) ? [{ name: baseName(ex.path), path: ex.path, isDir: false }] : []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(tabConversationsMap.get(tabId) || []);
    setInput(""); setStreamText(""); setReasoning(""); setLiveSteps([]);
    setMQuery(null); setSug([]); setAttached(seedAttach());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  // Live file suggestions for the active "@" token, debounced (mirrors the path bar).
  useEffect(() => {
    if (mQuery === null) { setSug([]); return; }
    let cancelled = false;
    const id = setTimeout(async () => {
      const p = mQuery.toLowerCase();
      let items: Attach[] = [];
      if (/^([A-Za-z]:|[/\\]|~)/.test(compDir)) {
        // real folder → list it and prefix-match, like the path bar
        let list: Entry[] = [];
        try { list = await api.listDir(compDir, ex.showHidden); } catch { /* gone */ }
        items = list
          .filter((e) => e.name.toLowerCase().startsWith(p))
          .sort((a, b) => (a.is_dir === b.is_dir ? a.name.localeCompare(b.name) : a.is_dir ? -1 : 1))
          .slice(0, 10)
          .map((e) => ({ name: e.name, path: e.path, isDir: e.is_dir }));
      } else if (p) {
        // virtual tab (home / keep / docs) has no folder → search the whole index
        const hits = await searchOnce(mQuery, "name");
        items = hits.slice(0, 10).map((h) => ({ name: baseName(h.file_path), path: h.file_path, isDir: h.is_dir }));
      }
      if (!cancelled) { setSug(items); setSugIdx(0); }
    }, 120);
    return () => { cancelled = true; clearTimeout(id); };
  }, [mQuery, compDir, ex.showHidden]);

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

    // Attached files → an "@name" line in the shown bubble, and their real paths
    // in a preamble Watson can act on with its read/list tools.
    const mentionLine = attached.length ? attached.map((a) => `@${a.name}`).join(" ") : "";
    const displayText = mentionLine ? `${mentionLine}\n${text}` : text;
    const attachBlock = attached.length
      ? `Attached ${attached.length === 1 ? "item" : "items"} (read with your tools if relevant):\n${attached.map((a) => a.path).join("\n")}\n\n`
      : "";

    const next: ModelMessage[] = [...messages, { role: "user", content: displayText }];
    updateConversation(next);
    setInput("");
    setMQuery(null); setSug([]);
    setAttached(seedAttach()); // clear ad-hoc mentions; keep the tab's open file
    setLoading(true);
    setStreamText(""); setReasoning(""); setLiveSteps([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const config = getAssistantConfig();
      const selected = ex.selectedEntries.map((e) => e.path).join(", ");
      const context = `The user's current directory is ${ex.path}. Resolve "here", "this folder", and relative paths against it — even if earlier turns referenced a different directory.${selected ? `\nSelected items: ${selected}` : ""}`;

      // Re-state the directory on this turn too, so navigating mid-conversation
      // overrides the older folder still present in the history.
      const toSend: ModelMessage[] = [...messages, { role: "user", content: `(current directory: ${ex.path})\n${attachBlock}${text}` }];

      const { messages: responseMsgs } = await streamAssistant(toSend, config, {
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
        updateConversation([...next, { role: "assistant", content: `Error: ${err?.message || "Failed to get response from watson."}` }]);
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
      title: `watson note (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
      content: text,
      color: "amber",
      author: "watson",
      pinned: true,
    });
    setSavedIdx(idx);
    ex.showToast("Saved conversation turn to Keep notes");
    setTimeout(() => setSavedIdx(null), 3000);
  };

  // Detect the "@token" immediately left of the caret and open completion for it.
  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setInput(v);
    const upto = v.slice(0, e.target.selectionStart);
    const m = upto.match(/(?:^|\s)@([^\s@]*)$/);
    setMQuery(m ? m[1] : null);
  };

  const pickMention = (item: Attach) => {
    const el = inputRef.current;
    const caret = el ? el.selectionStart : input.length;
    const upto = input.slice(0, caret).replace(/@[^\s@]*$/, ""); // drop the "@query" token
    const rest = input.slice(caret);
    setInput(upto + rest);
    setAttached((prev) => (prev.some((a) => a.path === item.path) ? prev : [...prev, item]));
    setMQuery(null); setSug([]);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(upto.length, upto.length); });
  };

  const removeAttached = (path: string) => setAttached((prev) => prev.filter((a) => a.path !== path));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mQuery !== null && sug.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugIdx((i) => (i + 1) % sug.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugIdx((i) => (i - 1 + sug.length) % sug.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(sug[sugIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMQuery(null); setSug([]); return; }
    }
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
    setMQuery(null); setSug([]); setAttached(seedAttach());
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
          <span style={{ fontFamily: "'Syne Mono', monospace, var(--mono)", fontSize: "12px", fontWeight: "600", color: "var(--amber)", borderRadius: "9999px", padding: "2px 2px", lineHeight: "1.2" }}>
            watson
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
            <div style={{ fontFamily: "'Syne Mono', monospace, var(--mono)", fontSize: "22px", fontWeight: 600, color: "var(--amber)", lineHeight: 1 }}>
              watson
            </div>
            <div style={{ fontSize: "13px", color: "var(--dim)", lineHeight: "1.5" }}>
              Ask watson about files, search notes, or manage your workspace.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", maxWidth: "260px" }}>
              {["What is in this folder?", "List my pinned notes", "Create a checklist for today"].map((suggestion) => (
                <button
                  key={suggestion} type="button" onClick={() => handleSend(suggestion)}
                  style={{ fontSize: "12px", padding: "7px 10px", background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", color: "var(--paper-dim)", textAlign: "left", cursor: "pointer", transition: "all 0.1s ease" }}
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
            const steps = isUser ? [] : toolStepsOf(msg);
            if (!isUser && !body.trim() && steps.length === 0) return null;

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: isUser ? "88%" : "100%", width: isUser ? "auto" : "100%" }}>
                {/* Tool step trace (completed) */}
                {steps.length > 0 && (
                  <div className="wp-pill-stack" style={{ marginBottom: body.trim() ? "8px" : "0" }}>
                    {steps.map((t, i) => { const p = stepParts(t.name, t.detail, ex.path); return <StepPill key={i} verb={p.verb} target={p.target} status="done" live={false} />; })}
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
                {/* Turn actions — only on the final answer, not intermediate "let me check…" steps */}
                {!isUser && body.trim() && steps.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                    <button type="button" onClick={() => handleCopy(idx, body)} style={{ background: "transparent", border: "none", fontSize: "11px", color: "var(--dim)", cursor: "pointer", padding: "2px 4px" }}>
                      {copiedIdx === idx ? "Copied" : "Copy"}
                    </button>
                    <span style={{ color: "var(--dim-2)", fontSize: "11px" }}>·</span>
                    <button type="button" onClick={() => handleSaveToKeep(idx, body)} style={{ background: "transparent", border: "none", fontSize: "11px", color: savedIdx === idx ? "var(--sage)" : "var(--amber)", cursor: "pointer", padding: "2px 4px" }}>
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
              <div className="wp-pill-stack">
                {liveSteps.map((s) => { const p = stepParts(s.name, s.detail, ex.path); return <StepPill key={s.id} verb={p.verb} target={p.target} status={s.status} live />; })}
              </div>
            )}
            {reasoning.trim() && (
              <div style={{ fontSize: "12px", fontStyle: "italic", color: "var(--dim-2)", lineHeight: 1.5, borderLeft: "2px solid var(--border)", paddingLeft: "8px", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}>
                {reasoning}
              </div>
            )}
            {streamText.trim() ? (
              <div className="doc-content-body" style={{ fontSize: "13px", lineHeight: "1.55", color: "var(--paper)", padding: "4px 2px" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
              </div>
            ) : liveSteps.some((s) => s.status === "running") ? null : (
              // A tool call surfaced (or reasoning) but the next content hasn't
              // started — keep the orb visible so it doesn't look stuck.
              <div style={{ padding: "4px 2px" }}>
                <ThinkingIndicator label="watson is thinking…" />
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div style={{ position: "relative", padding: "10px 12px", borderTop: "1px solid var(--border-soft)", background: "var(--ink-2)", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
        {/* @-mention completion — same dropdown as the path bar, opening upward */}
        {mQuery !== null && sug.length > 0 && (
          <div className="crumb-suggest" style={{ top: "auto", bottom: "calc(100% - 6px)", left: "12px", right: "12px", maxWidth: "none" }}>
            {sug.map((s, i) => {
              const k = s.isDir ? "folder" : kindOf(s.name);
              const t = TONE[k];
              return (
                <button
                  key={s.path} type="button"
                  className={"crumb-suggest-item" + (s.isDir ? "" : " file") + (i === sugIdx ? " active" : "")}
                  onMouseDown={(e) => { e.preventDefault(); pickMention(s); }}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: t.fg, flexShrink: 0 }}>
                    <Glyph kind={k} />
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}{s.isDir ? "/" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {/* Attached-file pills */}
        {attached.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {attached.map((a) => {
              const k = a.isDir ? "folder" : kindOf(a.name);
              return (
                <span key={a.path} className="wp-attach-pill" title={a.path}>
                  <span style={{ width: "13px", height: "13px", display: "flex", alignItems: "center", justifyContent: "center", color: TONE[k].fg, flexShrink: 0 }}><Glyph kind={k} /></span>
                  <span className="nm">{a.name}</span>
                  <button type="button" onClick={() => removeAttached(a.path)} title="Remove">×</button>
                </span>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef} rows={1} value={input}
            onChange={onInputChange} onKeyDown={handleKeyDown}
            placeholder="Ask watson  ·  @ to attach a file"
            style={{ flex: 1, background: "var(--ink)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--paper)", fontSize: "13px", padding: "7px 9px", resize: "none", maxHeight: "80px", minHeight: "32px", outline: "none", fontFamily: "inherit", lineHeight: "1.4" }}
          />
          <button
            type="button"
            onClick={() => (loading ? handleStop() : handleSend())}
            disabled={!loading && !input.trim()}
            title={loading ? "Stop" : "Send"}
            style={{ height: "32px", padding: "0 10px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-sm)", background: loading ? "var(--ink-3)" : "var(--terracotta)", border: loading ? "1px solid var(--border)" : "none", color: loading ? "var(--paper)" : "var(--on-accent)", cursor: !loading && !input.trim() ? "default" : "pointer", opacity: !loading && !input.trim() ? 0.5 : 1, flexShrink: 0 }}
          >
            {loading ? "Stop" : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}
