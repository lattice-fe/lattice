import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listen } from "@tauri-apps/api/event";
import { Explorer } from "../hooks/useExplorer";
import { isTauri } from "../lib/api";
import { Note, NoteColor, ChecklistItem } from "../lib/keep/types";
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  togglePin,
  toggleChecklistItem,
  setNoteColor,
  NOTES_EVENT,
} from "../lib/keep/store";
import { REMINDER_OPEN_EVENT, formatRemindAt } from "../lib/keep/reminders";

// ponytail: single draft key for instant tab navigation restoration & zero state loss
const KEEP_EDITOR_DRAFT_KEY = "lattice:keep_editor_draft";

export const NOTE_COLORS: { id: NoteColor; label: string; bg: string; border: string; strong: string }[] = [
  { id: "default", label: "Default", bg: "var(--card)", border: "var(--border)", strong: "var(--border)" },
  { id: "amber", label: "Amber", bg: "color-mix(in srgb, var(--amber) 14%, var(--card))", border: "color-mix(in srgb, var(--amber) 36%, var(--border))", strong: "var(--amber)" },
  { id: "terracotta", label: "Terracotta", bg: "color-mix(in srgb, var(--terracotta) 14%, var(--card))", border: "color-mix(in srgb, var(--terracotta) 36%, var(--border))", strong: "var(--terracotta)" },
  { id: "sage", label: "Sage", bg: "color-mix(in srgb, #7a9a7a 16%, var(--card))", border: "color-mix(in srgb, #7a9a7a 38%, var(--border))", strong: "#7a9a7a" },
  { id: "slate", label: "Slate", bg: "color-mix(in srgb, #5a6b9a 16%, var(--card))", border: "color-mix(in srgb, #5a6b9a 38%, var(--border))", strong: "#5a6b9a" },
  { id: "violet", label: "Violet", bg: "color-mix(in srgb, #8a7a9a 16%, var(--card))", border: "color-mix(in srgb, #8a7a9a 38%, var(--border))", strong: "#8a7a9a" },
  { id: "rose", label: "Rose", bg: "color-mix(in srgb, #b23320 14%, var(--card))", border: "color-mix(in srgb, #b23320 36%, var(--border))", strong: "#b23320" },
  { id: "sand", label: "Sand", bg: "color-mix(in srgb, #c7b090 16%, var(--card))", border: "color-mix(in srgb, #c7b090 38%, var(--border))", strong: "#c7b090" },
];

function getColorStyles(colorId: NoteColor) {
  const found = NOTE_COLORS.find((c) => c.id === colorId);
  return found || NOTE_COLORS[0];
}

const PaletteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const BellIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ChecklistIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const NoteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const PinIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
);

const PencilIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

interface KeepEditorDraft {
  paneOpen: boolean;
  activeNoteId: string | null;
  title: string;
  content: string;
  checklist: ChecklistItem[];
  color: NoteColor;
  pinned: boolean;
  type: "note" | "checklist";
  isEditing: boolean;
}

function loadInitialDraft(): KeepEditorDraft {
  try {
    const raw = localStorage.getItem(KEEP_EDITOR_DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.paneOpen === "boolean") {
        return parsed;
      }
    }
  } catch {}
  return {
    paneOpen: false,
    activeNoteId: null,
    title: "",
    content: "",
    checklist: [{ id: "c-1", text: "", done: false }],
    color: "default",
    pinned: false,
    type: "note",
    isEditing: false,
  };
}

export function KeepCanvas({ ex }: { ex?: Explorer }) {
  const [notes, setNotes] = useState<Note[]>(getNotes);
  const [search, setSearch] = useState("");

  const initialDraft = useRef(loadInitialDraft()).current;

  // Unified Right-Side Editor Pane State
  const [paneOpen, setPaneOpen] = useState(initialDraft.paneOpen);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(initialDraft.activeNoteId);
  const [isEditing, setIsEditing] = useState(initialDraft.isEditing);

  const [title, setTitle] = useState(initialDraft.title);
  const [content, setContent] = useState(initialDraft.content);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initialDraft.checklist && initialDraft.checklist.length > 0
      ? initialDraft.checklist
      : [{ id: "c-1", text: "", done: false }]
  );
  const [color, setColor] = useState<NoteColor>(initialDraft.color || "default");
  const [pinned, setPinned] = useState(initialDraft.pinned || false);
  const [type, setType] = useState<"note" | "checklist">(initialDraft.type || "note");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; note: Note } | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Reload notes store
  const refreshNotes = () => {
    setNotes(getNotes());
  };

  useEffect(() => {
    let unlisten: Promise<() => void> | null = null;
    if (isTauri) {
      unlisten = listen<Note[]>(NOTES_EVENT, (ev) => {
        if (ev.payload) setNotes(ev.payload);
      });
    }
    return () => {
      unlisten?.then((fn) => fn());
    };
  }, []);

  // Persist draft to localStorage on every change so tab switches NEVER lose edits or pane state
  useEffect(() => {
    if (paneOpen) {
      const draft: KeepEditorDraft = {
        paneOpen,
        activeNoteId,
        title,
        content,
        checklist,
        color,
        pinned,
        type,
        isEditing,
      };
      localStorage.setItem(KEEP_EDITOR_DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(KEEP_EDITOR_DRAFT_KEY);
    }
  }, [paneOpen, activeNoteId, title, content, checklist, color, pinned, type, isEditing]);

  // Reminder open listener
  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | null = null;
    listen<string>(REMINDER_OPEN_EVENT, ({ payload }) => {
      const n = getNotes().find((x) => x.id === payload);
      if (n) handleOpenNote(n);
    }).then((fn) => { un = fn; });
    return () => { un?.(); };
  }, []);

  // Real-time update active note in store as user types
  useEffect(() => {
    if (!paneOpen || !activeNoteId) return;
    updateNote(activeNoteId, {
      title,
      content,
      items: type === "checklist" ? checklist.filter((it) => it.text.trim()) : undefined,
      color,
      pinned,
    });
    setNotes(getNotes());
  }, [paneOpen, activeNoteId, title, content, checklist, color, pinned, type]);

  // Focus title input when entering edit mode
  useEffect(() => {
    if (paneOpen && isEditing) {
      setTimeout(() => titleRef.current?.focus(), 150);
    }
  }, [paneOpen, isEditing]);

  const handleNewNote = () => {
    setActiveNoteId(null);
    setTitle("");
    setContent("");
    setChecklist([{ id: "c-1", text: "", done: false }]);
    setColor("default");
    setPinned(false);
    setType("note");
    setIsEditing(true); // New note starts in edit mode
    setPaneOpen(true);
  };

  const handleOpenNote = (n: Note) => {
    setActiveNoteId(n.id);
    setTitle(n.title || "");
    setContent(n.content || "");
    setChecklist(n.items && n.items.length > 0 ? n.items : [{ id: "c-1", text: "", done: false }]);
    setColor(n.color || "default");
    setPinned(n.pinned || false);
    setType(n.type || "note");
    setIsEditing(false); // Existing note starts in preview mode!
    setPaneOpen(true);
  };

  const handleClosePane = () => {
    setPaneOpen(false);
    setActiveNoteId(null);
    localStorage.removeItem(KEEP_EDITOR_DRAFT_KEY);
    refreshNotes();
  };

  const handleSavePane = () => {
    if (activeNoteId) {
      updateNote(activeNoteId, {
        title,
        content,
        items: type === "checklist" ? checklist.filter((it) => it.text.trim()) : undefined,
        color,
        pinned,
      });
    } else {
      if (type === "note") {
        if (!title.trim() && !content.trim()) {
          handleClosePane();
          return;
        }
        createNote({ title, content, type: "note", color, pinned });
      } else {
        const validItems = checklist.filter((it) => it.text.trim());
        if (!title.trim() && validItems.length === 0) {
          handleClosePane();
          return;
        }
        createNote({ title, items: validItems, type: "checklist", color, pinned });
      }
    }
    handleClosePane();
  };

  const handleOpenInNewTab = (n: Note) => {
    ex?.newTab("lattice://keep/" + n.id);
    setCtxMenu(null);
  };

  const handleCopyMarkdown = (n: Note) => {
    const text = n.type === "checklist"
      ? (n.title ? `# ${n.title}\n\n` : "") + (n.items?.map((it) => `- [${it.done ? "x" : " "}] ${it.text}`).join("\n") || "")
      : (n.title ? `# ${n.title}\n\n` : "") + (n.content || "");
    navigator.clipboard.writeText(text);
    ex?.showToast("Copied note markdown to clipboard");
    setCtxMenu(null);
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklist((list) => list.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };

  const filteredNotes = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.items?.some((it) => it.text.toLowerCase().includes(q))
    );
  });

  const pinnedNotes = filteredNotes.filter((n) => n.pinned);
  const otherNotes = filteredNotes.filter((n) => !n.pinned);
  const paneColorStyle = getColorStyles(color);

  return (
    <div className={`keep-canvas ${paneOpen ? "pane-open" : ""}`}>
      {/* Main scrollable area (notes grid) */}
      <div className="keep-main">
        {/* Top Bar */}
        <div className="keep-topbar">
          <div className="keep-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--dim)" }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="keep-search-input"
            />
            {search && (
              <button className="keep-btn-icon" onClick={() => setSearch("")} title="Clear search">
                ✕
              </button>
            )}
          </div>

          <button
            className={`keep-btn-new-note ${paneOpen && !activeNoteId ? "active" : ""}`}
            onClick={paneOpen && !activeNoteId ? handleClosePane : handleNewNote}
            title={paneOpen && !activeNoteId ? "Close editor" : "Take a note"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="keep-content">
          {notes.length === 0 ? (
            <div className="keep-empty-state">
              <div className="keep-empty-icon">
                <NoteIcon />
              </div>
              <div className="keep-empty-title">Notes you add appear here</div>
              <div className="keep-empty-sub">Capture quick ideas, to-do lists, or ask watson from Spotlight (! note...)</div>
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div className="keep-section">
                  <div className="keep-section-label">PINNED</div>
                  <div className="keep-grid">
                    {pinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={() => handleOpenNote(note)}
                        onContextMenu={(x, y, n) => setCtxMenu({ x, y, note: n })}
                        onRefresh={refreshNotes}
                      />
                    ))}
                  </div>
                </div>
              )}

              {otherNotes.length > 0 && (
                <div className="keep-section">
                  {pinnedNotes.length > 0 && <div className="keep-section-label">OTHERS</div>}
                  <div className="keep-grid">
                    {otherNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={() => handleOpenNote(note)}
                        onContextMenu={(x, y, n) => setCtxMenu({ x, y, note: n })}
                        onRefresh={refreshNotes}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right-side Editor Pane (Smooth GPU Overlay) */}
      <div className={`keep-editor-pane ${paneOpen ? "open" : ""}`}>
        <div className="keep-editor-pane-inner" style={{ borderColor: paneColorStyle.border }}>
          {/* Pane Header */}
          <div className="keep-editor-header">
            <span className="keep-editor-heading">
              {activeNoteId ? (isEditing ? "EDIT NOTE" : "NOTE PREVIEW") : "NEW NOTE"}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                className={`keep-btn-icon ${isEditing ? "active" : ""}`}
                onClick={() => setIsEditing(!isEditing)}
                title={isEditing ? "Switch to preview mode" : "Edit note"}
              >
                <PencilIcon />
              </button>
              <button className="keep-btn-icon" onClick={handleClosePane} title="Collapse">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title Area */}
          {isEditing ? (
            <input
              ref={titleRef}
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="keep-editor-title"
            />
          ) : (
            <div
              className="keep-editor-preview-title"
              onClick={() => setIsEditing(true)}
              title="Click to edit title"
            >
              {title || "Untitled Note"}
            </div>
          )}

          {/* Body Content Area: Preview Mode vs Edit Mode */}
          {type === "note" ? (
            isEditing ? (
              <textarea
                placeholder="Take a note..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="keep-editor-textarea"
                rows={10}
              />
            ) : (
              <div
                className="keep-editor-preview-body keep-card-markdown"
                onClick={() => setIsEditing(true)}
                title="Click to edit content"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || "*(No content. Click pencil to edit)*"}
                </ReactMarkdown>
              </div>
            )
          ) : (
            isEditing ? (
              <div className="keep-editor-checklist">
                {checklist.map((item) => (
                  <div key={item.id} className="keep-checklist-input-row">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklistItem(item.id)}
                      className="keep-checkbox"
                    />
                    <input
                      type="text"
                      placeholder="List item"
                      value={item.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChecklist((list) =>
                          list.map((it) => (it.id === item.id ? { ...it, text: val } : it))
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const newId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
                          setChecklist((list) => [...list, { id: newId, text: "", done: false }]);
                        } else if (e.key === "Backspace" && !item.text && checklist.length > 1) {
                          e.preventDefault();
                          setChecklist((list) => list.filter((it) => it.id !== item.id));
                        }
                      }}
                      className={`keep-checklist-input ${item.done ? "checked" : ""}`}
                    />
                  </div>
                ))}
                <button
                  className="keep-btn-add-item"
                  onClick={() =>
                    setChecklist((list) => [
                      ...list,
                      { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text: "", done: false },
                    ])
                  }
                >
                  + List item
                </button>
              </div>
            ) : (
              <div className="keep-editor-preview-body">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`keep-card-check-row ${item.done ? "checked" : ""}`}
                    onClick={() => handleToggleChecklistItem(item.id)}
                    style={{ padding: "6px 0", cursor: "pointer" }}
                  >
                    <input type="checkbox" checked={item.done} readOnly className="keep-checkbox" />
                    <span className="keep-check-text">{item.text || "(Empty item)"}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Footer Toolbar */}
          <div className="keep-editor-toolbar">
            <div className="keep-editor-toolbar-left">
              <button
                className={`keep-btn-toggle ${type === "checklist" ? "active" : ""}`}
                onClick={() => setType(type === "note" ? "checklist" : "note")}
                title={type === "note" ? "Switch to checklist" : "Switch to note"}
              >
                {type === "note" ? <ChecklistIcon /> : <NoteIcon />}
                <span>{type === "note" ? "Checklist" : "Note"}</span>
              </button>

              <div className="keep-color-palette-wrap">
                <button className="keep-btn-icon" onClick={() => setShowColorPicker(!showColorPicker)} title="Color">
                  <PaletteIcon />
                </button>
                {showColorPicker && (
                  <div className="keep-palette-popover">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        className={`keep-palette-dot ${color === c.id ? "active" : ""}`}
                        style={{ backgroundColor: c.strong, borderColor: c.strong }}
                        onClick={() => { setColor(c.id); setShowColorPicker(false); }}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                className={`keep-btn-icon ${pinned ? "active" : ""}`}
                onClick={() => setPinned(!pinned)}
                title={pinned ? "Unpin" : "Pin"}
              >
                <PinIcon filled={pinned} />
              </button>
            </div>

            <button className="keep-btn-save" onClick={handleSavePane}>
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Note Context Menu */}
      {ctxMenu && (
        <div
          className="menu-backdrop"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
        >
          <div
            className="menu"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 220),
              top: Math.min(ctxMenu.y, window.innerHeight - 240),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="menu-item" onClick={() => handleOpenInNewTab(ctxMenu.note)}>
              <span>Open in new tab</span>
            </button>
            <button className="menu-item" onClick={() => { handleOpenNote(ctxMenu.note); setCtxMenu(null); }}>
              <span>Edit note</span>
            </button>
            <button className="menu-item" onClick={() => { togglePin(ctxMenu.note.id); refreshNotes(); setCtxMenu(null); }}>
              <span>{ctxMenu.note.pinned ? "Unpin note" : "Pin note"}</span>
            </button>
            <button className="menu-item" onClick={() => handleCopyMarkdown(ctxMenu.note)}>
              <span>Copy markdown</span>
            </button>
            <div className="menu-sep" />
            <button className="menu-item danger" onClick={() => { deleteNote(ctxMenu.note.id); refreshNotes(); setCtxMenu(null); }}>
              <span>Delete note</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onEdit,
  onContextMenu,
  onRefresh,
}: {
  note: Note;
  onEdit: () => void;
  onContextMenu: (x: number, y: number, note: Note) => void;
  onRefresh: () => void;
}) {
  const [showPalette, setShowPalette] = useState(false);
  const colorStyle = getColorStyles(note.color);

  const handleToggleCheck = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleChecklistItem(note.id, itemId);
    onRefresh();
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePin(note.id);
    onRefresh();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNote(note.id);
    onRefresh();
  };

  return (
    <div
      className="keep-card"
      style={{ backgroundColor: "var(--card)", borderColor: colorStyle.strong, borderWidth: "2px" }}
      onClick={onEdit}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY, note);
      }}
    >
      <div className="keep-card-top-actions" onClick={(e) => e.stopPropagation()}>
        <div className="keep-color-palette-wrap">
          <button className="keep-btn-icon keep-card-action-btn" onClick={() => setShowPalette(!showPalette)} title="Change color">
            <PaletteIcon />
          </button>
          {showPalette && (
            <div className="keep-palette-popover">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  className={`keep-palette-dot ${note.color === c.id ? "active" : ""}`}
                  style={{ backgroundColor: c.strong, borderColor: c.strong }}
                  onClick={() => {
                    setNoteColor(note.id, c.id);
                    setShowPalette(false);
                    onRefresh();
                  }}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>

        <button
          className={`keep-btn-icon keep-card-action-btn ${note.pinned ? "active" : ""}`}
          onClick={handleTogglePin}
          title={note.pinned ? "Unpin" : "Pin"}
        >
          <PinIcon filled={note.pinned} />
        </button>
      </div>

      {note.title && <div className="keep-card-title">{note.title}</div>}

      {note.remindAt && (
        <div className={"keep-reminder-badge" + (note.remindAt <= Date.now() ? " past" : "")} title="Reminder set">
          <BellIcon size={11} /> {formatRemindAt(note.remindAt)}
        </div>
      )}

      {note.type === "checklist" && note.items && note.items.length > 0 ? (
        <div className="keep-card-checklist">
          {note.items.slice(0, 8).map((it) => (
            <div
              key={it.id}
              className={`keep-card-check-row ${it.done ? "checked" : ""}`}
              onClick={(e) => handleToggleCheck(it.id, e)}
            >
              <input type="checkbox" checked={it.done} readOnly className="keep-checkbox" />
              <span className="keep-check-text">{it.text}</span>
            </div>
          ))}
          {note.items.length > 8 && (
            <div className="keep-card-more">+{note.items.length - 8} more items</div>
          )}
        </div>
      ) : (
        note.content && (
          <div className="keep-card-body keep-card-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {note.content.length > 280 ? `${note.content.slice(0, 280)}...` : note.content}
            </ReactMarkdown>
          </div>
        )
      )}

      {/* Card Footer */}
      <div className="keep-card-footer" onClick={(e) => e.stopPropagation()}>
        <div>
          {note.author === "watson" && (
            <div className="keep-watson-pill" title="Created by watson">
              <span className="keep-watson-sparkle">✦</span>
              <span className="keep-watson-sig">watson</span>
            </div>
          )}
        </div>

        <button className="keep-btn-icon keep-btn-delete keep-card-action-btn" onClick={handleDelete} title="Delete note">
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
