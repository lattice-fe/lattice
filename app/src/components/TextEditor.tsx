import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { api, Entry } from "../lib/api";
import { mdAssetComponents } from "../lib/markdown";

interface TextEditorProps {
  entry: Entry;
  onClose: () => void;
  onErrorToast?: (msg: string) => void;
  onOpenPath?: (path: string) => void;
  isFullTab?: boolean;
}

function getHighlightLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rs: "rust", json: "json", md: "markdown", markdown: "markdown",
    html: "xml", htm: "xml", xml: "xml", css: "css", scss: "scss",
    toml: "toml", c: "c", cpp: "cpp", h: "c", sh: "bash", yaml: "yaml", yml: "yaml",
    sql: "sql", go: "go", java: "java", kt: "kotlin",
  };
  return map[ext] || "";
}

function formatLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "JavaScript", jsx: "JavaScript (JSX)", ts: "TypeScript", tsx: "TypeScript (TSX)",
    py: "Python", rs: "Rust", json: "JSON", md: "Markdown", markdown: "Markdown", mdx: "MDX",
    html: "HTML", htm: "HTML", xml: "XML", css: "CSS", scss: "SCSS",
    toml: "TOML", c: "C", cpp: "C++", h: "C Header", sh: "Bash", yaml: "YAML", yml: "YAML",
    sql: "SQL", go: "Go", java: "Java", kt: "Kotlin", csv: "CSV", txt: "Plain Text",
  };
  return map[ext] || (ext ? ext.toUpperCase() : "Plain Text");
}

const SAMPLE_THEME_JSON = JSON.stringify({
  name: "Graphite copy",
  appearance: "dark",
  tokens: {
    bg: "#121212",
    surface: "#1e1e1e",
    surfaceHover: "#2a2a2a",
    border: "#333333",
    text: "#e0e0e0",
    textDim: "#9e9e9e",
    accent: "#5f6b78",
    accent2: "#6b7b89",
    accent3: "#4f5b68",
    danger: "#c0392b"
  },
  radius: 11,
  effects: {
    glow: "#5f6b78",
    glowStrength: 0.02,
    shadowStrength: 0.8
  },
  tiles: {
    rust: {
      bg: "#2a1f1a",
      fg: "#bcaaa4"
    },
    amber: {
      bg: "#2e261a",
      fg: "#d7ccc8"
    }
  }
}, null, 2);

export function TextEditor({ entry, onClose, onErrorToast, onOpenPath, isFullTab = false }: TextEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState<string | null>(null);

  // Refs for seamless auto-save on type, blur, unmount, or tab-switch
  const contentRef = useRef(content);
  contentRef.current = content;
  const entryPathRef = useRef(entry.path);
  entryPathRef.current = entry.path;
  const isDirtyRef = useRef(false);

  // File rename state in editor header
  const [currentName, setCurrentName] = useState(entry.name);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(entry.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentName(entry.name);
    setNameInput(entry.name);
  }, [entry.name, entry.path]);

  const ext = currentName.split(".").pop()?.toLowerCase() || "";
  const isMarkdown = ext === "md" || ext === "markdown" || ext === "mdx";
  const isHtml = ext === "html" || ext === "htm";
  const canPreview = isMarkdown || isHtml;
  const modeKey = `lattice:editor-mode:${entry.path}`;

  const [mode, setModeState] = useState<"source" | "split" | "preview">(() => {
    if (!canPreview) return "source";
    try {
      const savedPathMode = localStorage.getItem(modeKey) as "source" | "split" | "preview";
      if (savedPathMode) {
        if (!isFullTab && savedPathMode === "split") return "source";
        return savedPathMode;
      }
      const savedGlobalMode = localStorage.getItem("lattice:editor-mode") as "source" | "split" | "preview";
      if (savedGlobalMode) {
        if (!isFullTab && savedGlobalMode === "split") return "source";
        return savedGlobalMode;
      }
    } catch { /* ignore */ }
    return isFullTab ? "split" : "source";
  });

  const setMode = (m: "source" | "split" | "preview") => {
    setModeState(m);
    try {
      localStorage.setItem("lattice:editor-mode", m);
      localStorage.setItem(modeKey, m);
    } catch { /* ignore */ }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Auto-save executor
  const performSave = useCallback(async (targetPath: string, text: string) => {
    if (targetPath.startsWith("lattice://")) return;
    setSaveStatus("saving");
    try {
      await api.writeFile(targetPath, text);
      isDirtyRef.current = false;
      setSaveStatus("saved");
    } catch (err) {
      console.error("Auto-save error:", err);
      setSaveStatus("unsaved");
    }
  }, []);

  // Load document content
  useEffect(() => {
    let isMounted = true;
    const loadText = async () => {
      setLoading(true);
      if (entry.path === "lattice://sample-theme" || entry.path.includes("sample-theme")) {
        if (isMounted) {
          setContent(SAMPLE_THEME_JSON);
          contentRef.current = SAMPLE_THEME_JSON;
          isDirtyRef.current = false;
          setSaveStatus("saved");
          setLoading(false);
        }
        return;
      }
      try {
        const text = await api.readFile(entry.path);
        if (isMounted) {
          setContent(text || "");
          contentRef.current = text || "";
          isDirtyRef.current = false;
          setSaveStatus("saved");
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          if (onErrorToastRef.current) {
            onErrorToastRef.current(`Cannot preview non-text file "${entry.name}" in split panel.`);
            onCloseRef.current();
          } else {
            setError(String(err));
            setLoading(false);
          }
        }
      }
    };
    loadText();
    return () => {
      isMounted = false;
      // Auto-save on unmount when switching tabs or closing
      if (isDirtyRef.current) {
        api.writeFile(entryPathRef.current, contentRef.current).catch(() => {});
      }
    };
  }, [entry.path, entry.name]);

  // Debounced auto-save as user types (500ms)
  useEffect(() => {
    if (!isDirtyRef.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      performSave(entryPathRef.current, contentRef.current);
    }, 500);
    return () => clearTimeout(timer);
  }, [content, performSave]);

  // Window beforeunload auto-save
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        api.writeFile(entryPathRef.current, contentRef.current).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      const dot = nameInput.lastIndexOf(".");
      if (dot > 0) {
        nameInputRef.current?.setSelectionRange(0, dot);
      } else {
        nameInputRef.current?.select();
      }
    }
  }, [editingName]);

  const handleRename = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === currentName) {
      setEditingName(false);
      setNameInput(currentName);
      return;
    }
    try {
      await api.rename(entry.path, trimmed);
      setCurrentName(trimmed);
      setEditingName(false);
    } catch (err) {
      if (onErrorToastRef.current) {
        onErrorToastRef.current(`Failed to rename file: ${String(err)}`);
      }
      setEditingName(false);
      setNameInput(currentName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingName(false);
      setNameInput(currentName);
    }
  };

  const highlightedCode = useMemo(() => {
    if (!content) return "";
    const lang = getHighlightLanguage(currentName);
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(content, { language: lang }).value;
      }
      return hljs.highlightAuto(content.slice(0, 15000)).value;
    } catch {
      return content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }, [content, currentName]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    contentRef.current = val;
    isDirtyRef.current = true;
    setSaveStatus("saving");
  };

  const handleBlur = () => {
    if (isDirtyRef.current) {
      performSave(entryPathRef.current, contentRef.current);
    }
  };

  // Cursor position and selection tracking for Status Bar
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1, selLen: 0 });

  const updateCursorPos = (target: HTMLTextAreaElement) => {
    const textBefore = target.value.substring(0, target.selectionStart);
    const lineNum = textBefore.split("\n").length;
    const colNum = textBefore.length - textBefore.lastIndexOf("\n");
    const selLen = Math.abs(target.selectionEnd - target.selectionStart);
    setCursorPos({ line: lineNum, col: colNum, selLen });
  };

  // Find & Replace in-document state
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Compute all matches in document
  const matches = useMemo(() => {
    if (!findQuery) return [];
    const results: { start: number; end: number; line: number }[] = [];
    const text = matchCase ? content : content.toLowerCase();
    const query = matchCase ? findQuery : findQuery.toLowerCase();
    let idx = 0;
    while ((idx = text.indexOf(query, idx)) !== -1) {
      const line = content.substring(0, idx).split("\n").length;
      results.push({ start: idx, end: idx + query.length, line });
      idx += Math.max(1, query.length);
    }
    return results;
  }, [content, findQuery, matchCase]);

  // Jump to specific match
  const jumpToMatch = useCallback((idx: number) => {
    if (!matches.length || !textareaRef.current) return;
    const bounded = (idx + matches.length) % matches.length;
    setCurrentMatchIdx(bounded);
    const match = matches[bounded];
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(match.start, match.end);
    updateCursorPos(textareaRef.current);
    const lineHeight = 21;
    textareaRef.current.scrollTop = Math.max(0, (match.line - 5) * lineHeight);
  }, [matches]);

  const handleReplaceCurrent = () => {
    if (!matches.length || !textareaRef.current) return;
    const match = matches[currentMatchIdx];
    const before = content.substring(0, match.start);
    const after = content.substring(match.end);
    const nextContent = before + replaceQuery + after;
    setContent(nextContent);
    contentRef.current = nextContent;
    isDirtyRef.current = true;
    performSave(entryPathRef.current, nextContent);
  };

  const handleReplaceAll = () => {
    if (!matches.length || !findQuery) return;
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "g" : "gi");
    const nextContent = content.replace(regex, replaceQuery);
    setContent(nextContent);
    contentRef.current = nextContent;
    isDirtyRef.current = true;
    performSave(entryPathRef.current, nextContent);
  };

  // Global capture listener for in-editor Find & Replace (works even if textarea isn't focused)
  useEffect(() => {
    const handleGlobalFind = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(true);
        setShowReplace(false);
        const selected = window.getSelection()?.toString() || "";
        if (selected) setFindQuery(selected);
        setTimeout(() => findInputRef.current?.select(), 50);
        return;
      }
      if (ctrl && e.key.toLowerCase() === "h") {
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(true);
        setShowReplace(true);
        setTimeout(() => findInputRef.current?.select(), 50);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalFind, true);
    return () => window.removeEventListener("keydown", handleGlobalFind, true);
  }, []);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      setFindOpen(true);
      setShowReplace(false);
      const selected = window.getSelection()?.toString() || "";
      if (selected) setFindQuery(selected);
      setTimeout(() => findInputRef.current?.select(), 50);
      return;
    }
    if (ctrl && e.key.toLowerCase() === "h") {
      e.preventDefault();
      e.stopPropagation();
      setFindOpen(true);
      setShowReplace(true);
      setTimeout(() => findInputRef.current?.select(), 50);
      return;
    }
    if (ctrl && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      performSave(entryPathRef.current, contentRef.current);
    }
  };

  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    updateCursorPos(e.currentTarget);
  };

  const handleEditorSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    updateCursorPos(e.currentTarget);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    updateCursorPos(e.currentTarget);
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
  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const lineCount = lines.length;
  const lineEnding = content.includes("\r\n") ? "CRLF" : "LF";
  const languageLabel = formatLanguage(currentName);

  const renderPreview = () =>
    isHtml ? (
      <iframe srcDoc={content} title="HTML Preview" className="html-preview-frame" sandbox="allow-same-origin allow-scripts" />
    ) : (
      <div style={{ height: "100%", overflowY: "auto", width: "100%" }}>
        <div
          className="md-preview-container doc-content-body"
          style={{
            padding: isFullTab ? "32px 32px 80px" : "16px 24px",
            maxWidth: isFullTab ? "840px" : "100%",
            margin: isFullTab ? "0 auto" : undefined,
            width: "100%",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              ...mdAssetComponents(entry.path, onOpenPath),
              table: ({ children }) => <table className="doc-table">{children}</table>,
              code: ({ className, children }) => {
                const inline = !className;
                return inline ? (
                  <code className="doc-inline-code">{children}</code>
                ) : (
                  <pre className="doc-code"><code>{children}</code></pre>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );

  const renderEditor = () => (
    <div className="editor-wrapper" style={{ position: "relative" }}>
      {/* In-Editor Find & Replace Widget */}
      {findOpen && (
        <div className="editor-find-widget" onClick={(e) => e.stopPropagation()}>
          <div className="editor-find-row">
            <input
              ref={findInputRef}
              type="text"
              className="editor-find-input"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  jumpToMatch(e.shiftKey ? currentMatchIdx - 1 : currentMatchIdx + 1);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setFindOpen(false);
                  textareaRef.current?.focus();
                }
              }}
              placeholder="Find in document..."
            />
            <span className="editor-find-count">
              {matches.length > 0 ? `${currentMatchIdx + 1} of ${matches.length}` : findQuery ? "0 of 0" : "Find"}
            </span>
            <button
              type="button"
              className="editor-find-btn"
              onClick={() => jumpToMatch(currentMatchIdx - 1)}
              title="Previous match (Shift+Enter)"
              disabled={!matches.length}
            >
              ↑
            </button>
            <button
              type="button"
              className="editor-find-btn"
              onClick={() => jumpToMatch(currentMatchIdx + 1)}
              title="Next match (Enter)"
              disabled={!matches.length}
            >
              ↓
            </button>
            <button
              type="button"
              className={`editor-find-btn ${matchCase ? "active" : ""}`}
              onClick={() => setMatchCase(!matchCase)}
              title="Match case"
            >
              Aa
            </button>
            <button
              type="button"
              className={`editor-find-btn ${showReplace ? "active" : ""}`}
              onClick={() => setShowReplace(!showReplace)}
              title="Toggle replace"
            >
              ⇄
            </button>
            <button
              type="button"
              className="editor-find-btn"
              onClick={() => {
                setFindOpen(false);
                textareaRef.current?.focus();
              }}
              title="Close find (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Replace Row */}
          {showReplace && (
            <div className="editor-find-row" style={{ marginTop: "4px" }}>
              <input
                type="text"
                className="editor-find-input"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace with..."
              />
              <button
                type="button"
                className="editor-find-btn"
                onClick={handleReplaceCurrent}
                disabled={!matches.length}
                title="Replace current match"
              >
                Replace
              </button>
              <button
                type="button"
                className="editor-find-btn"
                onClick={handleReplaceAll}
                disabled={!matches.length}
                title="Replace all occurrences"
              >
                All
              </button>
            </div>
          )}
        </div>
      )}

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
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={handleEditorKeyUp}
          onSelect={handleEditorSelect}
          onClick={handleEditorClick}
          onScroll={syncScroll}
          spellCheck={false}
        />
      </div>
    </div>
  );

  return (
    <div className="split-panel-container" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleRename}
              style={{
                background: "var(--ink-2)",
                border: "1px solid var(--amber)",
                borderRadius: "var(--radius-sm)",
                color: "var(--paper)",
                fontSize: "13px",
                fontWeight: "600",
                padding: "2px 6px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <span
              className="name"
              onClick={() => setEditingName(true)}
              title="Click to rename file"
              style={{ cursor: "pointer" }}
            >
              {currentName}
            </span>
          )}
          <span className="badge" style={{ borderRadius: "9999px", padding: "2px 8px", textTransform: "none", fontWeight: "500" }}>{languageLabel}</span>
          <span style={{ fontSize: "11px", color: saveStatus === "saving" ? "var(--amber)" : "var(--dim-2)", fontFamily: "var(--mono)", marginLeft: "4px" }}>
            {saveStatus === "saving" ? "Saving..." : "Saved"}
          </span>
        </div>

        <div className="split-panel-actions">
          <button
            type="button"
            className={`editor-find-btn ${findOpen ? "active" : ""}`}
            onClick={() => {
              setFindOpen(!findOpen);
              if (!findOpen) setTimeout(() => findInputRef.current?.select(), 50);
            }}
            title="Find in document (Ctrl+F)"
            style={{ padding: "4px 8px", fontSize: "11.5px" }}
          >
            Find
          </button>

          {canPreview && (
            <div className="md-toggle-group">
              <button
                type="button"
                className={`md-toggle-btn ${mode === "source" ? "active" : ""}`}
                onClick={() => setMode("source")}
              >
                Source
              </button>
              {isFullTab && (
                <button
                  type="button"
                  className={`md-toggle-btn ${mode === "split" ? "active" : ""}`}
                  onClick={() => setMode("split")}
                >
                  Split
                </button>
              )}
              <button
                type="button"
                className={`md-toggle-btn ${mode === "preview" ? "active" : ""}`}
                onClick={() => setMode("preview")}
              >
                Preview
              </button>
            </div>
          )}
          <button className="split-panel-close" onClick={onClose} title="Close editor (Esc)" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="split-panel-body editor-body" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-note">Loading document...</div>
        ) : error ? (
          <div className="empty-note err">{error}</div>
        ) : isFullTab && mode === "split" && canPreview ? (
          <div className="editor-split-view" style={{ height: "100%" }}>
            <div className="editor-split-pane left">
              {renderEditor()}
            </div>
            <div className="editor-split-pane right">
              {renderPreview()}
            </div>
          </div>
        ) : mode === "preview" && canPreview ? (
          renderPreview()
        ) : (
          renderEditor()
        )}
      </div>

      {/* Editor Status Bar Footer */}
      <div className="editor-status-bar">
        <div className="editor-status-left">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          {cursorPos.selLen > 0 && <span style={{ color: "var(--amber)" }}>({cursorPos.selLen} selected)</span>}
          <span className="editor-status-sep">•</span>
          <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
          <span className="editor-status-sep">•</span>
          <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
        </div>

        <div className="editor-status-right">
          <span>UTF-8</span>
          <span className="editor-status-sep">•</span>
          <span>{lineEnding}</span>
          <span className="editor-status-sep">•</span>
          <span className="editor-status-badge" style={{ borderRadius: "9999px", padding: "1px 8px", textTransform: "none", fontWeight: "500" }}>{languageLabel}</span>
          <span className="editor-status-sep">•</span>
          <span style={{ color: saveStatus === "saving" ? "var(--amber)" : "var(--dim)", fontWeight: "500" }}>
            {saveStatus === "saving" ? "Saving..." : "Saved"}
          </span>
        </div>
      </div>
    </div>
  );
}
