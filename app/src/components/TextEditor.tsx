import { useEffect, useState, useRef, useCallback } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { api, Entry, isTauri } from "../lib/api";
import { baseName, parentOf } from "../lib/format";
import { logActivity } from "../lib/activity";
import { mdAssetComponents, resolveRelativePath, cleanHref, isExternalUrl } from "../lib/markdown";

interface TextEditorProps {
  entry: Entry;
  onClose: () => void;
  onErrorToast?: (msg: string) => void;
  onOpenPath?: (path: string) => void;
  isFullTab?: boolean;
}

// Monaco language ID map
const LANG_MAP: Record<string, { monaco: string; label: string }> = {
  js:       { monaco: "javascript",  label: "JavaScript" },
  jsx:      { monaco: "javascript",  label: "JavaScript (JSX)" },
  ts:       { monaco: "typescript",  label: "TypeScript" },
  tsx:      { monaco: "typescript",  label: "TypeScript (TSX)" },
  py:       { monaco: "python",      label: "Python" },
  rs:       { monaco: "rust",        label: "Rust" },
  json:     { monaco: "json",        label: "JSON" },
  md:       { monaco: "markdown",    label: "Markdown" },
  markdown: { monaco: "markdown",    label: "Markdown" },
  mdx:      { monaco: "markdown",    label: "MDX" },
  html:     { monaco: "html",        label: "HTML" },
  htm:      { monaco: "html",        label: "HTML" },
  xml:      { monaco: "xml",         label: "XML" },
  css:      { monaco: "css",         label: "CSS" },
  scss:     { monaco: "scss",        label: "SCSS" },
  toml:     { monaco: "ini",         label: "TOML" },
  c:        { monaco: "c",           label: "C" },
  cpp:      { monaco: "cpp",         label: "C++" },
  h:        { monaco: "c",           label: "C Header" },
  sh:       { monaco: "shell",       label: "Bash" },
  yaml:     { monaco: "yaml",        label: "YAML" },
  yml:      { monaco: "yaml",        label: "YAML" },
  sql:      { monaco: "sql",         label: "SQL" },
  go:       { monaco: "go",          label: "Go" },
  java:     { monaco: "java",        label: "Java" },
  kt:       { monaco: "kotlin",      label: "Kotlin" },
  csv:      { monaco: "plaintext",   label: "CSV" },
  txt:      { monaco: "plaintext",   label: "Plain Text" },
};

function getLang(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return LANG_MAP[ext] ?? { monaco: "plaintext", label: ext ? ext.toUpperCase() : "Plain Text" };
}

export function TextEditor({ entry, onClose, onErrorToast, onOpenPath, isFullTab = false }: TextEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1, selLen: 0 });

  const contentRef = useRef(content);
  contentRef.current = content;
  const entryPathRef = useRef(entry.path);
  entryPathRef.current = entry.path;
  const isDirtyRef = useRef(false);

  // File rename state
  const [currentName, setCurrentName] = useState(entry.name);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(entry.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentName(entry.name);
    setNameInput(entry.name);
  }, [entry.name, entry.path]);

  const { monaco: monacoLang, label: languageLabel } = getLang(currentName);

  const ext = currentName.split(".").pop()?.toLowerCase() || "";
  const isMarkdown = ext === "md" || ext === "markdown" || ext === "mdx";
  const isHtml = ext === "html" || ext === "htm";
  const canPreview = isMarkdown || isHtml;
  const modeKey = `lattice:editor-mode:${entry.path}`;

  const [mode, setModeState] = useState<"source" | "split" | "preview">(() => {
    if (!canPreview) return "source";
    try {
      const saved = localStorage.getItem(modeKey) as "source" | "split" | "preview";
      if (saved) return (!isFullTab && saved === "split") ? "source" : saved;
      const global = localStorage.getItem("lattice:editor-mode") as "source" | "split" | "preview";
      if (global) return (!isFullTab && global === "split") ? "source" : global;
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

  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Follow the app's light/dark appearance with Monaco's built-in themes.
  // applyTheme() sets data-appearance on <html> and dispatches "lattice-theme".
  const [monacoTheme, setMonacoTheme] = useState(
    () => (document.documentElement.getAttribute("data-appearance") === "light" ? "vs" : "vs-dark"),
  );
  useEffect(() => {
    const sync = () =>
      setMonacoTheme(document.documentElement.getAttribute("data-appearance") === "light" ? "vs" : "vs-dark");
    window.addEventListener("lattice-theme", sync);
    return () => window.removeEventListener("lattice-theme", sync);
  }, []);

  // Auto-save
  const performSave = useCallback(async (targetPath: string, text: string) => {
    if (targetPath.startsWith("lattice://")) return;
    setSaveStatus("saving");
    try {
      await api.writeFile(targetPath, text);
      isDirtyRef.current = false;
      setSaveStatus("saved");
      logActivity({ type: "edit", title: `Edited ${baseName(targetPath)}`, sub: parentOf(targetPath) ?? "", path: targetPath });
    } catch (err) {
      console.error("Auto-save error:", err);
      setSaveStatus("unsaved");
      onErrorToastRef.current?.(`Couldn't save "${baseName(targetPath)}" — changes are unsaved.`);
    }
  }, []);

  // Load file
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const text = await api.readFile(entry.path);
        if (isMounted) { const t = text || ""; setContent(t); contentRef.current = t; isDirtyRef.current = false; setSaveStatus("saved"); setLoading(false); }
      } catch (err) {
        if (isMounted) {
          if (onErrorToastRef.current) { onErrorToastRef.current(`Cannot preview "${entry.name}" in split panel.`); onCloseRef.current(); }
          else { setError(String(err)); setLoading(false); }
        }
      }
    };
    load();
    return () => {
      isMounted = false;
      if (isDirtyRef.current) api.writeFile(entryPathRef.current, contentRef.current).catch(() => {});
    };
  }, [entry.path, entry.name]);

  // Debounced auto-save on content change
  useEffect(() => {
    if (!isDirtyRef.current) return;
    setSaveStatus("saving");
    const t = setTimeout(() => performSave(entryPathRef.current, contentRef.current), 500);
    return () => clearTimeout(t);
  }, [content, performSave]);

  // beforeunload save
  useEffect(() => {
    const handler = () => { if (isDirtyRef.current) api.writeFile(entryPathRef.current, contentRef.current).catch(() => {}); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Rename focus
  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      const dot = nameInput.lastIndexOf(".");
      dot > 0 ? nameInputRef.current?.setSelectionRange(0, dot) : nameInputRef.current?.select();
    }
  }, [editingName]);

  const handleRename = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === currentName) { setEditingName(false); setNameInput(currentName); return; }
    try {
      await api.rename(entry.path, trimmed);
      setCurrentName(trimmed);
      setEditingName(false);
    } catch (err) {
      if (onErrorToastRef.current) onErrorToastRef.current(`Failed to rename: ${String(err)}`);
      setEditingName(false);
      setNameInput(currentName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleRename(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditingName(false); setNameInput(currentName); }
  };

  // Monaco editor mount
  const handleEditorMount = useCallback((ed: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = ed;

    // Cursor position → status bar
    ed.onDidChangeCursorPosition((e) => {
      const sel = ed.getSelection();
      const selLen = sel ? ed.getModel()?.getValueLengthInRange(sel) ?? 0 : 0;
      setCursorPos({ line: e.position.lineNumber, col: e.position.column, selLen });
    });
    // Ctrl+S is bound in the effect below, once the monaco instance is available.
  }, []);

  // Add Ctrl+S keybinding once monaco is ready
  useEffect(() => {
    if (!monaco || !editorRef.current) return;
    editorRef.current.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => performSave(entryPathRef.current, contentRef.current),
    );
    // Free F1 for the app's global docs shortcut; move the command palette to Ctrl+Shift+P.
    monaco.editor.addKeybindingRules([
      { keybinding: monaco.KeyCode.F1, command: null },
      { keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, command: "editor.action.quickCommand" },
    ]);
    // addCommand returns a string ID, not a disposable — no cleanup needed
  }, [monaco, performSave]);

  const handleEditorChange = useCallback((val: string | undefined) => {
    const v = val ?? "";
    setContent(v);
    contentRef.current = v;
    isDirtyRef.current = true;
    setSaveStatus("saving");
  }, []);

  // Markdown preview helpers
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
    if (!link) return;
    const raw = link.getAttribute("href") || link.href;
    const cleaned = cleanHref(raw);
    if (!cleaned || cleaned.startsWith("#")) return;
    e.preventDefault(); e.stopPropagation();
    if (isExternalUrl(cleaned)) { if (isTauri) api.openUrl(cleaned); else window.open(cleaned, "_blank", "noopener,noreferrer"); }
    else if (onOpenPath) onOpenPath(resolveRelativePath(entry.path, cleaned));
  };

  const renderPreview = () =>
    isHtml ? (
      <iframe srcDoc={content} title="HTML Preview" className="html-preview-frame" sandbox="allow-same-origin allow-scripts" />
    ) : (
      <div style={{ height: "100%", overflowY: "auto", width: "100%" }}>
        <div className="md-preview-container doc-content-body" onClick={handlePreviewClick}
          style={{ padding: isFullTab ? "32px 32px 80px" : "16px 24px", maxWidth: isFullTab ? "840px" : "100%", margin: isFullTab ? "0 auto" : undefined, width: "100%" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
            components={{
              ...mdAssetComponents(entry.path, onOpenPath),
              table: ({ children }) => <table className="doc-table">{children}</table>,
              code: ({ className, children }) => {
                const inline = !className;
                return inline ? <code className="doc-inline-code">{children}</code> : <pre className="doc-code"><code>{children}</code></pre>;
              },
            }}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );

  // Monaco editor options
  const editorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
    fontSize: 13.5,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    lineHeight: 21,
    minimap: { enabled: true, scale: 1 },
    scrollBeyondLastLine: false,
    wordWrap: "off",
    tabSize: 2,
    insertSpaces: true,
    renderLineHighlight: "gutter",
    smoothScrolling: true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    padding: { top: 12, bottom: 12 },
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    renderWhitespace: "selection",
    bracketPairColorization: { enabled: true },
    suggest: { showIcons: true, showStatusBar: true },
    quickSuggestions: { other: true, comments: false, strings: false },
    automaticLayout: true,
  };

  const renderEditor = () => (
    <div style={{ height: "100%", width: "100%" }}>
      <Editor
        height="100%"
        language={monacoLang}
        value={content}
        theme={monacoTheme}
        options={editorOptions}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        loading={<div className="empty-note">Loading editor...</div>}
      />
    </div>
  );

  // doc stats for status bar
  const lineCount = content.split("\n").length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineEnding = content.includes("\r\n") ? "CRLF" : "LF";
  const saveLabel = saveStatus === "saving" ? "Saving..." : saveStatus === "unsaved" ? "Unsaved" : "Saved";
  const saveColor = saveStatus === "saving" ? "var(--amber)" : saveStatus === "unsaved" ? "var(--terracotta)" : "var(--dim)";

  return (
    <div className="split-panel-container" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {editingName ? (
            <input ref={nameInputRef} type="text" value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleNameKeyDown} onBlur={handleRename}
              style={{ background: "var(--ink-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius-sm)", color: "var(--paper)", fontSize: "13px", fontWeight: "600", padding: "2px 6px", outline: "none", fontFamily: "inherit" }} />
          ) : (
            <span className="name" onClick={() => setEditingName(true)} title="Click to rename file" style={{ cursor: "pointer" }}>{currentName}</span>
          )}
          <span className="badge" style={{ borderRadius: "9999px", padding: "2px 8px", textTransform: "none", fontWeight: "500" }}>{languageLabel}</span>
          <span style={{ fontSize: "11px", color: saveColor, fontFamily: "var(--mono)", marginLeft: "4px" }}>
            {saveLabel}
          </span>
        </div>

        <div className="split-panel-actions">
          {canPreview && (
            <div className="md-toggle-group">
              <button type="button" className={`md-toggle-btn ${mode === "source" ? "active" : ""}`} onClick={() => setMode("source")}>Source</button>
              {isFullTab && <button type="button" className={`md-toggle-btn ${mode === "split" ? "active" : ""}`} onClick={() => setMode("split")}>Split</button>}
              <button type="button" className={`md-toggle-btn ${mode === "preview" ? "active" : ""}`} onClick={() => setMode("preview")}>Preview</button>
            </div>
          )}
          <button className="split-panel-close" onClick={onClose} title="Close editor (Esc)" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="split-panel-body editor-body" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty-note">Loading document...</div>
        ) : error ? (
          <div className="empty-note err">{error}</div>
        ) : isFullTab && mode === "split" && canPreview ? (
          <div className="editor-split-view" style={{ height: "100%" }}>
            <div className="editor-split-pane left">{renderEditor()}</div>
            <div className="editor-split-pane right">{renderPreview()}</div>
          </div>
        ) : mode === "preview" && canPreview ? (
          renderPreview()
        ) : (
          renderEditor()
        )}
      </div>

      {/* Status Bar */}
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
          <span style={{ color: saveColor, fontWeight: "500" }}>
            {saveLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
