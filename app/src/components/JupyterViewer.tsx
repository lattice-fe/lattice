import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { api, Entry } from "../lib/api";

interface JupyterViewerProps {
  entry: Entry;
  onClose: () => void;
}

interface CellOutput {
  output_type: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
}

interface NotebookCell {
  cell_type: "markdown" | "code" | "raw";
  execution_count?: number | null;
  source: string | string[];
  outputs?: CellOutput[];
}

interface NotebookJson {
  cells?: NotebookCell[];
}

export function JupyterViewer({ entry, onClose }: JupyterViewerProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadNotebook = async () => {
      setLoading(true);
      try {
        const text = await api.readFile(entry.path);
        if (isMounted) {
          setContent(text || "");
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(String(err));
          setLoading(false);
        }
      }
    };
    loadNotebook();
    return () => { isMounted = false; };
  }, [entry.path]);

  const parsed: NotebookJson | null = useMemo(() => {
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  return (
    <div className="split-panel-container">
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--amber)" }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="name">{entry.name}</span>
          <span className="badge" style={{ color: "var(--amber)" }}>JUPYTER</span>
        </div>

        <div className="split-panel-actions">
          <button className="split-panel-close" onClick={onClose} title="Close viewer (Esc)" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="split-panel-body ipynb-body">
        {loading ? (
          <div className="empty-note">Loading Jupyter notebook...</div>
        ) : error || !parsed ? (
          <div className="empty-note err">{error || "Failed to parse Jupyter Notebook JSON"}</div>
        ) : (
          <div className="ipynb-cells">
            {parsed.cells?.map((cell, idx) => {
              const srcText = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
              if (cell.cell_type === "markdown") {
                return (
                  <div key={idx} className="ipynb-cell markdown-cell">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{srcText}</ReactMarkdown>
                  </div>
                );
              }
              if (cell.cell_type === "code") {
                let highlighted = srcText;
                try {
                  highlighted = hljs.highlight(srcText, { language: "python" }).value;
                } catch { /* ignore */ }

                return (
                  <div key={idx} className="ipynb-cell code-cell">
                    <div className="ipynb-code-prompt">In [{cell.execution_count ?? " "}]:</div>
                    <div className="ipynb-code-wrapper">
                      <pre className="ipynb-code-block hljs">
                        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                      </pre>
                      {cell.outputs && cell.outputs.length > 0 && (
                        <div className="ipynb-outputs">
                          {cell.outputs.map((out, oIdx) => {
                            const outText = Array.isArray(out.text) ? out.text.join("") : out.text || "";
                            const imgData = out.data?.["image/png"];
                            const imgSrc = Array.isArray(imgData) ? imgData.join("") : imgData;
                            return (
                              <div key={oIdx} className="ipynb-output">
                                {imgSrc ? (
                                  <img src={`data:image/png;base64,${imgSrc}`} alt="cell output" className="ipynb-out-img" />
                                ) : outText ? (
                                  <pre className="ipynb-out-text">{outText}</pre>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
