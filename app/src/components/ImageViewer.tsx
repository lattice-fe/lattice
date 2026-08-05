import { useState, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Entry, isTauri } from "../lib/api";
import { fmtSize, fmtWhen } from "../lib/format";

interface ImageViewerProps {
  entry: Entry;
  onClose: () => void;
}

export function ImageViewer({ entry, onClose }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const src = isTauri ? convertFileSrc(entry.path) : entry.path;
  const ext = entry.name.split(".").pop()?.toUpperCase() || "IMAGE";

  const handleZoomIn = () => { setFit(false); setZoom((z) => Math.min(z + 0.25, 5)); };
  const handleZoomOut = () => { setFit(false); setZoom((z) => Math.max(z - 0.25, 0.25)); };
  const handleResetZoom = () => { setFit(true); setZoom(1); };

  return (
    <div className="split-panel-container" style={{ position: "relative" }}>
      {/* Header Toolbar */}
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--teal)" }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="name">{entry.name}</span>
          <span className="badge" style={{ color: "var(--teal)" }}>{ext}</span>
        </div>

        <div className="split-panel-actions" style={{ gap: "4px" }}>
          <button className="iconbtn" onClick={handleZoomOut} title="Zoom out (-)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
          <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--paper-dim)", minWidth: "36px", textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="iconbtn" onClick={handleZoomIn} title="Zoom in (+)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>

          <button className={"iconbtn" + (fit ? " on" : "")} onClick={handleResetZoom} title="Reset fit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          </button>

          <button
            className={"iconbtn" + (showInfo ? " on" : "")}
            onClick={() => setShowInfo((v) => !v)}
            title="Image details & metadata"
            style={{ color: showInfo ? "var(--amber)" : "var(--dim)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </button>

          <div style={{ width: "1px", height: "16px", background: "var(--border)", margin: "0 4px" }} />

          <button className="split-panel-close" onClick={onClose} title="Close viewer (Esc)" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image Stage Body */}
      <div
        className="split-panel-body"
        style={{
          background: "var(--ink-3)",
          display: "grid",
          placeItems: "center",
          overflow: "auto",
          position: "relative",
          userSelect: "none",
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={entry.name}
          onLoad={(e) => {
            const el = e.currentTarget;
            setDim({ w: el.naturalWidth, h: el.naturalHeight });
          }}
          style={{
            maxWidth: fit ? "90%" : "none",
            maxHeight: fit ? "90%" : "none",
            transform: `scale(${zoom})`,
            transition: "transform 0.15s ease-out",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow)",
            objectFit: "contain",
          }}
        />

        {/* Floating Metadata Modal */}
        {showInfo && (
          <div
            className="img-meta-modal"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "280px",
              background: "var(--card-hi)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "14px 16px",
              zIndex: 30,
              fontSize: "12.5px",
              color: "var(--paper)",
              animation: "fadein 0.18s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <b style={{ fontSize: "13px", color: "var(--amber)" }}>Image Metadata</b>
              <button
                className="iconbtn"
                style={{ width: "20px", height: "20px" }}
                onClick={() => setShowInfo(false)}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--dim)" }}>Dimensions:</span>
                <b style={{ fontFamily: "var(--mono)" }}>{dim ? `${dim.w} × ${dim.h} px` : "Loading…"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--dim)" }}>File Size:</span>
                <b style={{ fontFamily: "var(--mono)" }}>{fmtSize(entry.size)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--dim)" }}>Format:</span>
                <b style={{ fontFamily: "var(--mono)" }}>{ext}</b>
              </div>
              {entry.modified && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--dim)" }}>Modified:</span>
                  <span>{fmtWhen(entry.modified)}</span>
                </div>
              )}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "2px" }}>
                <span style={{ color: "var(--dim)", display: "block", marginBottom: "3px" }}>Path:</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--paper-dim)", wordBreak: "break-all" }}>
                  {entry.path}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
