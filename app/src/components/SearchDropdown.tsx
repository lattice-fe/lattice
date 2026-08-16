import { useState, useEffect, useRef, useMemo } from "react";
import { Search } from "../hooks/useSearch";
import { Explorer } from "../hooks/useExplorer";
import { baseName, parentOf } from "../lib/format";
import { Glyph, TONE, kindOf } from "../lib/icons";
import { Hit, SearchMode } from "../lib/api";

const MODES: SearchMode[] = ["name", "text", "semantic"];

interface SearchDropdownProps {
  s: Search;
  ex: Explorer;
}

export function SearchDropdown({ s, ex }: SearchDropdownProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = s.query.trim().toLowerCase();
    if (s.mode !== "name" || !q) return s.results;
    const live: Hit[] = ex.entries
      .filter((e) => e.name.toLowerCase().includes(q))
      .map((e) => ({ file_path: e.path, is_dir: e.is_dir, snippet: "", score: 1, char_start: 0 }));
    const seen = new Set(live.map((h) => h.file_path.toLowerCase()));
    return [...live, ...s.results.filter((h) => !seen.has(h.file_path.toLowerCase()))];
  }, [s.mode, s.query, s.results, ex.entries]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".search") || target?.closest(".search-dropdown-overlay")) {
        return;
      }
      s.clear();
    };

    window.addEventListener("mousedown", handleDocumentClick);
    return () => window.removeEventListener("mousedown", handleDocumentClick);
  }, [s]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!s.active) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : Math.max(0, results.length - 1)));
      } else if (e.key === "Enter") {
        if (results[selectedIdx]) {
          e.preventDefault();
          const target = results[selectedIdx];
          ex.newTab(target.file_path);
          s.clear();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        s.clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [s, ex, results, selectedIdx]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIdx] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  if (!s.active) return null;

  return (
    <div
      ref={dropdownRef}
      className="search-dropdown-overlay"
      style={{
        position: "absolute",
        top: "44px",
        right: "0",
        width: "390px",
        maxHeight: "440px",
        background: "var(--ink)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 18px 48px rgba(0, 0, 0, 0.65)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "fadein 0.15s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-soft)",
          background: "var(--ink-2)",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--dim)", fontFamily: "var(--mono)" }}>
          {s.searching ? "Searching..." : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={"mode-mini" + (s.mode === m ? " on" : "")}
              onClick={() => s.setMode(m)}
              style={{
                fontSize: "11px",
                padding: "2px 7px",
                borderRadius: "var(--radius-sm)",
                border: s.mode === m ? "1px solid var(--terracotta)" : "1px solid var(--border-soft)",
                background: s.mode === m ? "color-mix(in srgb, var(--terracotta) 20%, transparent)" : "transparent",
                color: s.mode === m ? "var(--paper)" : "var(--dim)",
                cursor: "pointer",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          maxHeight: "380px",
          padding: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {results.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--dim-2)", fontSize: "13px" }}>
            {s.searching ? "Searching index…" : `No matches for "${s.query.trim()}"`}
          </div>
        ) : (
          results.map((h, i) => {
            const name = baseName(h.file_path);
            const k = h.is_dir ? "folder" : kindOf(name);
            const t = TONE[k];
            const dir = parentOf(h.file_path);
            const snip = h.snippet && h.snippet.trim() && h.snippet.trim() !== name ? h.snippet.trim() : null;
            const isSelected = i === selectedIdx;

            return (
              <div
                key={h.file_path + i}
                onClick={() => {
                  ex.newTab(h.file_path);
                  s.clear();
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: isSelected ? "var(--ink-3)" : "transparent",
                  border: isSelected ? "1px solid var(--border)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "background 0.1s ease",
                }}
              >
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: t.fg,
                    flexShrink: 0,
                  }}
                >
                  <Glyph kind={k} />
                </span>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: isSelected ? "var(--paper)" : "var(--paper-dim)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                  {snip && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--dim)",
                        fontFamily: "var(--mono)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {snip}
                    </span>
                  )}
                  {dir && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--dim-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dir}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer shortcut hints */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderTop: "1px solid var(--border-soft)",
          background: "var(--ink-3)",
          fontSize: "11px",
          color: "var(--dim-2)",
        }}
      >
        <span>↑↓ navigate</span>
        <span>↵ open in tab</span>
        <span>esc close</span>
      </div>
    </div>
  );
}
