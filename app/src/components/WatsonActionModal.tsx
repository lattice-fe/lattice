import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ThinkingOrb } from "thinking-orbs";
import { Entry, api } from "../lib/api";
import { getAssistantConfig } from "../lib/assistant/config";
import { askAssistant } from "../lib/assistant/client";
import { createNote } from "../lib/keep/store";
import { baseName } from "../lib/format";

export interface WatsonActionRequest {
  action: "summarize";
  entry: Entry;
}

interface WatsonActionModalProps {
  request: WatsonActionRequest;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export function WatsonActionModal({ request, onClose, onToast }: WatsonActionModalProps) {
  const { entry } = request;
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const title = `Summarize "${entry.name}"`;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        const config = getAssistantConfig();
        let contextText = "";

        if (entry.is_dir) {
          const files = await api.listDir(entry.path, false).catch(() => []);
          const listStr = files.slice(0, 40).map((f) => `- ${f.name} (${f.is_dir ? "folder" : `${f.size} bytes`})`).join("\n");
          contextText = `Folder path: ${entry.path}\nContained items (${files.length} total):\n${listStr}`;
        } else {
          const content = await api.readFile(entry.path).catch(() => "");
          const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n\n[...content truncated for brevity]" : content;
          contextText = `File path: ${entry.path}\nFile content:\n\`\`\`\n${truncated}\n\`\`\``;
        }

        const prompt = `Please provide a concise, structured executive summary of this file, highlighting its main purpose and key sections:\n\n${contextText}`;

        const answer = await askAssistant(prompt, config);
        if (!cancelled) {
          setResponse(answer);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to get Watson response.");
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [request]);

  const handleCopy = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToKeep = () => {
    if (!response) return;
    createNote({
      title: `Summary: ${baseName(entry.path)}`,
      content: `> **Source:** \`${entry.path}\`\n\n${response}`,
      color: "amber",
      author: "watson",
      pinned: true,
    });
    setSavedNote(true);
    if (onToast) onToast(`Saved summary to Keep notes`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ width: "660px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-soft)",
            background: "var(--ink-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontFamily: "'Syne Mono', monospace, var(--mono)",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--paper)",
                border: "1px solid var(--amber)",
                borderRadius: "9999px",
                padding: "2px 8px",
                lineHeight: "1.2",
              }}
            >
              Watson
            </span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--paper)" }}>
              {title}
            </span>
          </div>
          <button
            className="iconbtn"
            onClick={onClose}
            title="Close (Esc)"
            style={{ width: "28px", height: "28px" }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 22px",
            fontSize: "14px",
            lineHeight: "1.65",
            color: "var(--paper)",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "14px", color: "var(--dim)" }}>
              <ThinkingOrb state="composing" size={64} theme={document.documentElement.getAttribute("data-appearance") === "light" ? "light" : "dark"} />
              <span style={{ fontSize: "13px" }}>Watson is analyzing {entry.name}…</span>
            </div>
          ) : error ? (
            <div style={{ padding: "16px", background: "color-mix(in srgb, var(--terracotta) 12%, transparent)", border: "1px solid var(--terracotta)", borderRadius: "var(--radius)", color: "var(--paper)" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--terracotta)" }}>Watson Error</div>
              <div style={{ fontSize: "13px", color: "var(--dim)" }}>{error}</div>
            </div>
          ) : (
            <div className="doc-content-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {response || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && !error && response && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderTop: "1px solid var(--border-soft)",
              background: "var(--ink-2)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--dim-2)", fontFamily: "var(--mono)" }}>
              {entry.path}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn"
                onClick={handleCopy}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--paper)",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSaveToKeep}
                disabled={savedNote}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: "600",
                  borderRadius: "var(--radius-sm)",
                  background: savedNote ? "var(--sage)" : "var(--amber)",
                  border: "none",
                  color: "var(--ink)",
                  cursor: savedNote ? "default" : "pointer",
                }}
              >
                {savedNote ? "Saved to Keep" : "Save to Keep"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
