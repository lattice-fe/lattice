import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { Glyph } from "../lib/icons";

interface NewFileModalProps {
  folderPath: string;
  onClose: () => void;
  onCreated: (newFilePath: string) => void;
}

export function NewFileModal({ folderPath, onClose, onCreated }: NewFileModalProps) {
  const [fileName, setFileName] = useState("untitled.md");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Select base filename before extension
    const dotIdx = fileName.lastIndexOf(".");
    if (dotIdx > 0 && inputRef.current) {
      inputRef.current.setSelectionRange(0, dotIdx);
    } else {
      inputRef.current?.select();
    }
  }, []);

  const handleCreate = async () => {
    const raw = fileName.trim();
    if (!raw) {
      setError("File name cannot be empty");
      return;
    }

    const cleanName = raw.replace(/[/\\]/g, "_");
    const fullPath = `${folderPath.replace(/[/\\]$/, "")}/${cleanName}`;

    setCreating(true);
    setError(null);

    try {
      // Create empty file on disk
      await api.writeFile(fullPath, "");
      onCreated(fullPath);
      onClose();
    } catch (err) {
      setError(String(err));
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const folderBase = folderPath.replace(/[/\\]$/, "").split(/[/\\]/).pop() || folderPath;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "grid",
        placeItems: "center",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="modal"
        style={{
          maxWidth: "490px",
          width: "92%",
          padding: "16px 20px",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.75)",
          margin: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--paper)" }}>New File</div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: "14px", padding: "2px 6px" }}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Single Row: Location Prefix on Left + Filename Input on Right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--ink-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            marginBottom: error ? "10px" : "14px",
          }}
        >
          {/* Location prefix */}
          <div
            title={folderPath}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 10px",
              background: "var(--ink-2)",
              borderRight: "1px solid var(--border-soft)",
              color: "var(--paper-dim)",
              fontSize: "12.5px",
              maxWidth: "180px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            <span style={{ display: "grid", placeItems: "center", width: "13px", height: "13px", color: "var(--amber)", flexShrink: 0 }}>
              <Glyph kind="folder" />
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{folderBase}</span>
            <span style={{ color: "var(--dim-2)" }}>/</span>
          </div>

          {/* Editable File Name */}
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="filename.ext (e.g. notes.md)"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              color: "var(--paper)",
              fontSize: "13px",
              padding: "7px 10px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{ color: "var(--terracotta)", fontSize: "11.5px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="btn-ghost2" onClick={onClose} type="button" style={{ padding: "4px 12px", fontSize: "12px" }}>
            Cancel
          </button>
          <button
            className="btn-soft primary"
            onClick={handleCreate}
            disabled={creating}
            type="button"
            style={{ padding: "4px 14px", fontSize: "12px", background: "var(--amber)", color: "var(--ink)", fontWeight: "600", borderColor: "var(--amber)" }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
