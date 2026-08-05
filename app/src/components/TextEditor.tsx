import { useEffect, useState, useRef, useMemo } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { api, Entry } from "../lib/api";

interface TextEditorProps {
  entry: Entry;
  onClose: () => void;
  onErrorToast?: (msg: string) => void;
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rs: "rust", json: "json", md: "markdown", html: "xml", htm: "xml", xml: "xml",
    css: "css", toml: "toml", c: "c", cpp: "cpp", h: "c", sh: "bash", yaml: "yaml", yml: "yaml",
  };
  return map[ext] || "";
}

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}

function parseTable(tableLines: string[], key: number): React.ReactNode {
  if (tableLines.length < 2) return null;
  const parseRow = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  const headerCells = parseRow(tableLines[0]);
  const hasSeparator = tableLines[1] && tableLines[1].includes("---");
  const dataLines = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);

  return (
    <div key={key} className="md-table-wrapper">
      <table className="md-table">
        <thead>
          <tr>
            {headerCells.map((cell, i) => (
              <th key={i}>{parseInline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataLines.map((rowLine, rIdx) => {
            const cells = parseRow(rowLine);
            return (
              <tr key={rIdx}>
                {cells.map((cell, cIdx) => (
                  <td key={cIdx}>{parseInline(cell)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let currentTableLines: string[] = [];

  const flushTable = (keyIndex: number) => {
    if (currentTableLines.length > 0) {
      const tableNode = parseTable(currentTableLines, keyIndex);
      if (tableNode) elements.push(tableNode);
      currentTableLines = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.trim().startsWith("```")) {
      flushTable(i);
      if (inCodeBlock) {
        inCodeBlock = false;
        const codeText = codeBlockLines.join("\n");
        codeBlockLines = [];
        let html = codeText;
        try { html = hljs.highlightAuto(codeText).value; } catch { /* ignore */ }
        elements.push(
          <pre key={i} className="md-code-block">
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        );
      } else {
        inCodeBlock = true;
        codeBlockLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    if (line.trim().startsWith("|") && line.trim().includes("|")) {
      currentTableLines.push(line);
      return;
    } else {
      flushTable(i);
    }

    if (line.startsWith("# ")) elements.push(<h1 key={i}>{parseInline(line.slice(2))}</h1>);
    else if (line.startsWith("## ")) elements.push(<h2 key={i}>{parseInline(line.slice(3))}</h2>);
    else if (line.startsWith("### ")) elements.push(<h3 key={i}>{parseInline(line.slice(4))}</h3>);
    else if (line.startsWith("#### ")) elements.push(<h4 key={i}>{parseInline(line.slice(5))}</h4>);
    else if (line.startsWith("- ") || line.startsWith("* ")) elements.push(<li key={i}>{parseInline(line.slice(2))}</li>);
    else if (line.startsWith("> ")) elements.push(<blockquote key={i}>{parseInline(line.slice(2))}</blockquote>);
    else if (!line.trim()) elements.push(<div key={i} style={{ height: "8px" }} />);
    else elements.push(<p key={i}>{parseInline(line)}</p>);
  });

  flushTable(lines.length);

  return <div className="md-preview-container">{elements}</div>;
}

export function TextEditor({ entry, onClose, onErrorToast }: TextEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  const isMarkdown = ext === "md";
  const isHtml = ext === "html" || ext === "htm";
  const canPreview = isMarkdown || isHtml;
  const modeKey = `lattice:editor-mode:${entry.path}`;
  const [mode, setModeState] = useState<"source" | "preview">(() => {
    try {
      const savedPathMode = localStorage.getItem(modeKey) as "source" | "preview";
      if (savedPathMode) return savedPathMode;
      const savedGlobalMode = localStorage.getItem("lattice:editor-mode") as "source" | "preview";
      if (savedGlobalMode) return savedGlobalMode;
    } catch { /* ignore */ }
    return "source";
  });

  const setMode = (m: "source" | "preview") => {
    setModeState(m);
    try {
      localStorage.setItem("lattice:editor-mode", m);
      localStorage.setItem(modeKey, m);
    } catch { /* ignore */ }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadText = async () => {
      setLoading(true);
      try {
        const text = await api.readFile(entry.path);
        if (isMounted) {
          setContent(text || "");
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          if (onErrorToast) {
            onErrorToast(`Cannot preview non-text file "${entry.name}" in split panel.`);
            onClose();
          } else {
            setError(String(err));
            setLoading(false);
          }
        }
      }
    };
    loadText();
    return () => { isMounted = false; };
  }, [entry.path, onErrorToast, onClose]);

  const highlightedCode = useMemo(() => {
    if (!content) return "";
    const lang = detectLanguage(entry.name);
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(content, { language: lang }).value;
      }
      return hljs.highlightAuto(content.slice(0, 15000)).value;
    } catch {
      return content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }, [content, entry.name]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.writeFile(entry.path, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    }
  };

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = top;
      highlightRef.current.scrollLeft = left;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = top;
    }
  };

  const lines = content.split("\n");

  return (
    <div className="split-panel-container">
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="name">{entry.name}</span>
          <span className="badge">{isMarkdown ? "MD" : isHtml ? "HTML" : detectLanguage(entry.name).toUpperCase() || "EDIT"}</span>
        </div>

        <div className="split-panel-actions">
          {canPreview && (
            <div className="md-toggle-group">
              <button
                type="button"
                className={`md-toggle-btn ${mode === "source" ? "active" : ""}`}
                onClick={() => setMode("source")}
              >
                Source
              </button>
              <button
                type="button"
                className={`md-toggle-btn ${mode === "preview" ? "active" : ""}`}
                onClick={() => setMode("preview")}
              >
                Preview
              </button>
            </div>
          )}
          {mode === "source" && (
            <button className={`btn-save ${saved ? "saved" : ""}`} onClick={handleSave} disabled={saving} type="button">
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save (Ctrl+S)"}
            </button>
          )}
          <button className="split-panel-close" onClick={onClose} title="Close editor (Esc)" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="split-panel-body editor-body">
        {loading ? (
          <div className="empty-note">Loading document...</div>
        ) : error ? (
          <div className="empty-note err">{error}</div>
        ) : mode === "preview" ? (
          isHtml ? (
            <iframe srcDoc={content} title="HTML Preview" className="html-preview-frame" sandbox="allow-same-origin allow-scripts" />
          ) : (
            <SimpleMarkdown text={content} />
          )
        ) : (
          <div className="editor-wrapper">
            <div className="line-numbers" ref={lineNumbersRef}>
              {lines.map((_, i) => (
                <div key={i} className="line-num">{i + 1}</div>
              ))}
            </div>
            <div className="editor-area">
              <pre
                ref={highlightRef}
                className="code-highlight-layer hljs"
                dangerouslySetInnerHTML={{ __html: highlightedCode + "\n" }}
              />
              <textarea
                ref={textareaRef}
                className="code-editor-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={syncScroll}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
