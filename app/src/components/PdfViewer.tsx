import { convertFileSrc } from "@tauri-apps/api/core";
import { Entry, isTauri } from "../lib/api";

interface PdfViewerProps {
  entry: Entry;
  onClose: () => void;
}

export function PdfViewer({ entry, onClose }: PdfViewerProps) {
  const assetSrc = isTauri ? convertFileSrc(entry.path) : entry.path;

  return (
    <div className="split-panel-container">
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--terracotta)" }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="name">{entry.name}</span>
          <span className="badge">PDF</span>
        </div>
        <button className="split-panel-close" onClick={onClose} title="Close split view (Esc)" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="split-panel-body pdf-body">
        <object data={`${assetSrc}#toolbar=1&navpanes=0`} type="application/pdf" className="pdf-frame">
          <embed src={assetSrc} type="application/pdf" className="pdf-frame" />
        </object>
      </div>
    </div>
  );
}
