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
import { REMINDER_OPEN_EVENT, formatRemindAt, tsToLocalInput, localInputToTs } from "../lib/keep/reminders";

// `strong` is the saturated colour used for the heavy border experiment (card
// stays neutral, the colour lives entirely in a thick border).
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

const PinIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
);

export function KeepCanvas({ ex: _ex }: { ex?: Explorer }) {
  const [notes, setNotes] = useState<Note[]>(getNotes);
  const [search, setSearch] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);

  // Pane creator state
  const [paneType, setPaneType] = useState<"note" | "checklist">("note");
  const [paneTitle, setPaneTitle] = useState("");
  const [paneContent, setPaneContent] = useState("");
  const [paneChecklist, setPaneChecklist] = useState<{ id: string; text: string; done: boolean }[]>([
    { id: "c-1", text: "", done: false },
  ]);
  const [paneColor, setPaneColor] = useState<NoteColor>("default");
  const [panePinned, setPanePinned] = useState(false);
  const [showPaneColorPicker, setShowPaneColorPicker] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Reload notes when store emits changes (e.g. from Watson/Spotlight)
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

  // Auto-focus title when pane opens
  useEffect(() => {
    if (paneOpen) {
      setTimeout(() => titleRef.current?.focus(), 200);
    }
  }, [paneOpen]);

  // "Open" on a reminder toast → open that note's editor here.
  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | null = null;
    listen<string>(REMINDER_OPEN_EVENT, ({ payload }) => {
      const n = getNotes().find((x) => x.id === payload);
      if (n) setEditingNote(n);
    }).then((fn) => { un = fn; });
    return () => { un?.(); };
  }, []);

  const refreshNotes = () => {
    setNotes(getNotes());
  };

  const resetPane = () => {
    setPaneTitle("");
    setPaneContent("");
    setPaneChecklist([{ id: "c-1", text: "", done: false }]);
    setPaneColor("default");
    setPanePinned(false);
    setPaneType("note");
    setShowPaneColorPicker(false);
  };

  const handlePaneSave = () => {
    if (paneType === "note") {
      if (!paneTitle.trim() && !paneContent.trim()) return;
      createNote({ title: paneTitle, content: paneContent, type: "note", color: paneColor, pinned: panePinned });
    } else {
      const validItems = paneChecklist.filter((it) => it.text.trim());
      if (!paneTitle.trim() && validItems.length === 0) return;
      createNote({ title: paneTitle, items: validItems, type: "checklist", color: paneColor, pinned: panePinned });
    }
    resetPane();
    refreshNotes();
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
  const paneColorStyle = getColorStyles(paneColor);

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

          {/* New note button in topbar */}
          <button
            className={`keep-btn-new-note ${paneOpen ? "active" : ""}`}
            onClick={() => { setPaneOpen(!paneOpen); if (!paneOpen) resetPane(); }}
            title={paneOpen ? "Close editor" : "New note"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="keep-content">
          {/* Notes Grid Display */}
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
                        onEdit={() => setEditingNote(note)}
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
                        onEdit={() => setEditingNote(note)}
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

      {/* Right-side Editor Pane */}
      <div className={`keep-editor-pane ${paneOpen ? "open" : ""}`}>
        <div className="keep-editor-pane-inner" style={{ borderColor: paneColorStyle.border }}>
          {/* Pane header */}
          <div className="keep-editor-header">
            <span className="keep-editor-heading">New note</span>
            <button className="keep-btn-icon" onClick={() => setPaneOpen(false)} title="Collapse">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            placeholder="Title"
            value={paneTitle}
            onChange={(e) => setPaneTitle(e.target.value)}
            className="keep-editor-title"
          />

          {/* Content area */}
          {paneType === "note" ? (
            <textarea
              placeholder="Take a note..."
              value={paneContent}
              onChange={(e) => setPaneContent(e.target.value)}
              className="keep-editor-textarea"
              rows={10}
            />
          ) : (
            <div className="keep-editor-checklist">
              {paneChecklist.map((item) => (
                <div key={item.id} className="keep-checklist-input-row">
                  <span className="keep-checklist-dot">+</span>
                  <input
                    type="text"
                    placeholder="List item"
                    value={item.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaneChecklist((list) =>
                        list.map((it) => (it.id === item.id ? { ...it, text: val } : it))
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const newId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
                        setPaneChecklist((list) => [...list, { id: newId, text: "", done: false }]);
                      } else if (e.key === "Backspace" && !item.text && paneChecklist.length > 1) {
                        e.preventDefault();
                        setPaneChecklist((list) => list.filter((it) => it.id !== item.id));
                      }
                    }}
                    className="keep-checklist-input"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pane footer toolbar */}
          <div className="keep-editor-toolbar">
            <div className="keep-editor-toolbar-left">
              {/* Toggle note/checklist */}
              <button
                className="keep-btn-toggle"
                onClick={() => setPaneType(paneType === "note" ? "checklist" : "note")}
                title={paneType === "note" ? "Switch to checklist" : "Switch to note"}
              >
                {paneType === "note" ? <ChecklistIcon /> : <NoteIcon />}
                <span>{paneType === "note" ? "Checklist" : "Note"}</span>
              </button>

              {/* Color picker */}
              <div className="keep-color-palette-wrap">
                <button className="keep-btn-icon" onClick={() => setShowPaneColorPicker(!showPaneColorPicker)} title="Color">
                  <PaletteIcon />
                </button>
                {showPaneColorPicker && (
                  <div className="keep-palette-popover">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        className={`keep-palette-dot ${paneColor === c.id ? "active" : ""}`}
                        style={{ backgroundColor: c.strong, borderColor: c.strong }}
                        onClick={() => { setPaneColor(c.id); setShowPaneColorPicker(false); }}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Pin */}
              <button
                className={`keep-btn-icon ${panePinned ? "active" : ""}`}
                onClick={() => setPanePinned(!panePinned)}
                title={panePinned ? "Unpin" : "Pin"}
              >
                <PinIcon filled={panePinned} />
              </button>
            </div>

            <button className="keep-btn-save" onClick={handlePaneSave}>
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onClose={() => {
            setEditingNote(null);
            refreshNotes();
          }}
        />
      )}
    </div>
  );
}

function NoteCard({
  note,
  onEdit,
  onRefresh,
}: {
  note: Note;
  onEdit: () => void;
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

function EditNoteModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [items, setItems] = useState<ChecklistItem[]>(note.items || []);
  const [color, setColor] = useState<NoteColor>(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [showPalette, setShowPalette] = useState(false);
  const [remindAt, setRemindAt] = useState<number | undefined>(note.remindAt);

  const colorStyle = getColorStyles(color);

  const handleSave = () => {
    updateNote(note.id, {
      title,
      content,
      items: note.type === "checklist" ? items.filter((it) => it.text.trim()) : undefined,
      color,
      pinned,
      remindAt,
      // re-arm the reminder when the time moves into the future
      reminderDone: remindAt && remindAt > Date.now() ? false : note.reminderDone,
    });
    onClose();
  };

  const handleToggleItem = (id: string) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };

  return (
    <div className="keep-modal-backdrop" onClick={handleSave}>
      <div
        className="keep-modal-dialog"
        style={{ backgroundColor: colorStyle.bg, borderColor: colorStyle.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="keep-creator-title-row">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="keep-creator-title"
          />
          <button
            className={`keep-btn-icon ${pinned ? "active" : ""}`}
            onClick={() => setPinned(!pinned)}
            title={pinned ? "Unpin note" : "Pin note"}
          >
            <PinIcon filled={pinned} />
          </button>
        </div>

        {note.type === "note" ? (
          <textarea
            placeholder="Note"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="keep-creator-textarea modal-textarea"
            rows={8}
          />
        ) : (
          <div className="keep-creator-checklist modal-checklist">
            {items.map((it) => (
              <div key={it.id} className="keep-checklist-input-row">
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={() => handleToggleItem(it.id)}
                  className="keep-checkbox"
                />
                <input
                  type="text"
                  value={it.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((list) => list.map((item) => (item.id === it.id ? { ...item, text: val } : item)));
                  }}
                  className={`keep-checklist-input ${it.done ? "checked" : ""}`}
                />
                <button
                  className="keep-btn-icon-sm"
                  onClick={() => setItems((list) => list.filter((item) => item.id !== it.id))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="keep-btn-add-item"
              onClick={() =>
                setItems((list) => [
                  ...list,
                  { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text: "", done: false },
                ])
              }
            >
              + List item
            </button>
          </div>
        )}

        <div className="keep-creator-footer">
          <div className="keep-creator-actions">
            <div className="keep-color-palette-wrap">
              <button className="keep-btn-icon" onClick={() => setShowPalette(!showPalette)}>
                <PaletteIcon />
              </button>
              {showPalette && (
                <div className="keep-palette-popover">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      className={`keep-palette-dot ${color === c.id ? "active" : ""}`}
                      style={{ backgroundColor: c.strong, borderColor: c.strong }}
                      onClick={() => {
                        setColor(c.id);
                        setShowPalette(false);
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              )}
            </div>
            <label className={"keep-remind-control" + (remindAt ? " set" : "")} title="Set a reminder">
              <BellIcon size={13} />
              <input
                type="datetime-local"
                value={tsToLocalInput(remindAt)}
                onChange={(e) => setRemindAt(localInputToTs(e.target.value))}
              />
              {remindAt && (
                <button type="button" className="keep-remind-clear" title="Clear reminder" onClick={() => setRemindAt(undefined)}>✕</button>
              )}
            </label>
          </div>

          <div className="keep-creator-submit">
            <button className="keep-btn-close" onClick={handleSave}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
