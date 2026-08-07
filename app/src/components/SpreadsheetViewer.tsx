import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, Entry, isTauri } from "../lib/api";

interface SpreadsheetViewerProps {
  entry: Entry;
  onClose: () => void;
}

// Convert 0-indexed column index to Excel column name (0 -> A, 1 -> B, ..., 26 -> AA)
function getColumnName(colIdx: number): string {
  let name = "";
  let i = colIdx;
  while (i >= 0) {
    name = String.fromCharCode((i % 26) + 65) + name;
    i = Math.floor(i / 26) - 1;
  }
  return name;
}

export function SpreadsheetViewer({ entry, onClose }: SpreadsheetViewerProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  const isBinaryExcel = ext === "xlsx" || ext === "xls" || ext === "ods";

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isBinaryExcel) {
          const src = isTauri ? convertFileSrc(entry.path) : entry.path;
          const res = await fetch(src);
          const buffer = await res.arrayBuffer();
          if (!isMounted) return;
          const wb = XLSX.read(buffer, { type: "array" });
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            setActiveSheet(wb.SheetNames[0]);
          }
        } else {
          // CSV / TSV text file
          const text = await api.readFile(entry.path);
          if (!isMounted) return;
          const wb = XLSX.read(text, { type: "string" });
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            setActiveSheet(wb.SheetNames[0]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(String(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [entry.path, isBinaryExcel]);

  // Parse active worksheet into 2D array matrix of strings
  const sheetData = useMemo<string[][]>(() => {
    if (!workbook || !activeSheet || !workbook.Sheets[activeSheet]) return [];
    const worksheet = workbook.Sheets[activeSheet];
    const rawData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: false, defval: "" });
    return rawData.map((row) => (Array.isArray(row) ? row.map((val) => String(val ?? "")) : []));
  }, [workbook, activeSheet]);

  // Filter rows based on search input
  const filteredRows = useMemo(() => {
    if (!filter || !filter.trim()) return sheetData;
    const q = filter.toLowerCase().trim();
    return sheetData.filter((row, idx) => {
      if (idx === 0) return true; // keep header row
      return row.some((cell) => cell.toLowerCase().includes(q));
    });
  }, [sheetData, filter]);

  // Determine max column count
  const maxCols = useMemo(() => {
    let max = 0;
    for (const row of sheetData) {
      if (row.length > max) max = row.length;
    }
    return max;
  }, [sheetData]);

  const hasMultipleSheets = (workbook?.SheetNames.length ?? 0) > 1;

  return (
    <div className="split-panel-container">
      {/* Header Bar */}
      <div className="split-panel-header">
        <div className="split-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--teal)" }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <span className="name">{entry.name}</span>
          <span className="badge" style={{ color: "var(--teal)" }}>
            {ext.toUpperCase() || "DATA"}
          </span>
        </div>

        <div className="split-panel-actions">
          {/* Quick row search */}
          <input
            type="text"
            className="sheet-search-input"
            placeholder="Filter rows..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--radius-sm)",
              color: "var(--paper)",
              fontSize: "12px",
              padding: "4px 10px",
              width: "140px",
              outline: "none",
            }}
          />

          <button className="split-panel-close" onClick={onClose} title="Close viewer (Esc)" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="split-panel-body sheet-body" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {loading ? (
          <div className="empty-note">Loading spreadsheet data...</div>
        ) : error ? (
          <div className="empty-note err">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-note">No tabular data found in sheet.</div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <table className="sheet-table">
              <thead>
                <tr>
                  {/* Top-left corner cell */}
                  <th className="sheet-corner-cell">#</th>
                  {Array.from({ length: maxCols }).map((_, colIdx) => (
                    <th key={colIdx} className="sheet-col-header">
                      {getColumnName(colIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx === 0 ? "sheet-header-row" : "sheet-data-row"}>
                    <td className="sheet-row-header">{rIdx + 1}</td>
                    {Array.from({ length: maxCols }).map((_, cIdx) => (
                      <td key={cIdx} className={"sheet-cell" + (rIdx === 0 ? " header-cell" : "")}>
                        {row[cIdx] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Worksheet Tabs Footer (for multi-sheet Excel workbooks) */}
        {hasMultipleSheets && workbook && (
          <div className="sheet-tabs-bar">
            {workbook.SheetNames.map((sheet) => (
              <button
                key={sheet}
                className={"sheet-tab-btn" + (sheet === activeSheet ? " active" : "")}
                onClick={() => setActiveSheet(sheet)}
                type="button"
              >
                {sheet}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
