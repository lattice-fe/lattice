import { emit } from "@tauri-apps/api/event";
import { isTauri } from "../api";
import { Note, NoteColor, ChecklistItem } from "./types";

export const NOTES_STORAGE_KEY = "lattice:keep_notes";
export const NOTES_EVENT = "keep:notes_changed";

const STARTER_NOTES: Note[] = [
  {
    id: "welcome-note",
    title: "Welcome to Keep in Lattice",
    content: "A native, local-first workspace for your thoughts, lists, and reminders.\n\n- **100% Offline & Private**\n- Markdown support with bold, code, and links\n- Ask **watson** (`Alt+Space` → `!`) to create or search notes instantly!",
    type: "note",
    color: "amber",
    pinned: true,
    author: "watson",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: "getting-started-list",
    title: "Getting Started Checklist",
    content: "",
    type: "checklist",
    items: [
      { id: "item-1", text: "Try creating a colorful note above", done: false },
      { id: "item-2", text: "Press Alt+Space and type '! note buy coffee beans'", done: false },
      { id: "item-3", text: "Pin important notes to the top", done: true },
    ],
    color: "sage",
    pinned: true,
    author: "watson",
    createdAt: Date.now() - 1800000,
    updatedAt: Date.now() - 1800000,
  },
];

export function getNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) {
      saveNotes(STARTER_NOTES);
      return STARTER_NOTES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return STARTER_NOTES;
  } catch {
    return STARTER_NOTES;
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    if (isTauri) {
      emit(NOTES_EVENT, notes).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to save notes:", err);
  }
}

export function getNote(id: string): Note | null {
  const notes = getNotes();
  return notes.find((n) => n.id === id) || null;
}

export function createNote(input: {
  title?: string;
  content?: string;
  items?: (string | ChecklistItem)[];
  type?: "note" | "checklist";
  color?: NoteColor;
  pinned?: boolean;
  author?: "watson" | "user";
}): Note {
  const notes = getNotes();
  const now = Date.now();
  const id = `note-${now}-${Math.random().toString(36).slice(2, 7)}`;

  let formattedItems: ChecklistItem[] | undefined = undefined;
  if (input.items && input.items.length > 0) {
    formattedItems = input.items.map((it, idx) => {
      if (typeof it === "string") {
        return { id: `item-${now}-${idx}`, text: it, done: false };
      }
      return it;
    });
  }

  const newNote: Note = {
    id,
    title: (input.title || "").trim(),
    content: input.content || "",
    items: formattedItems,
    type: input.type || (formattedItems && formattedItems.length > 0 ? "checklist" : "note"),
    color: input.color || "default",
    pinned: Boolean(input.pinned),
    author: input.author,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newNote, ...notes];
  saveNotes(updated);
  return newNote;
}

export function updateNote(id: string, patch: Partial<Omit<Note, "id" | "createdAt">>): Note | null {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;

  const current = notes[idx];
  const updatedNote: Note = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };

  const next = [...notes];
  next[idx] = updatedNote;
  saveNotes(next);
  return updatedNote;
}

export function deleteNote(id: string): boolean {
  const notes = getNotes();
  const next = notes.filter((n) => n.id !== id);
  if (next.length === notes.length) return false;
  saveNotes(next);
  return true;
}

export function togglePin(id: string): void {
  const notes = getNotes();
  const note = notes.find((n) => n.id === id);
  if (note) {
    updateNote(id, { pinned: !note.pinned });
  }
}

export function setNoteColor(id: string, color: NoteColor): void {
  updateNote(id, { color });
}

export function toggleChecklistItem(noteId: string, itemId: string): void {
  const note = getNote(noteId);
  if (!note || !note.items) return;

  const nextItems = note.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
  updateNote(noteId, { items: nextItems });
}

export function searchNotes(query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return getNotes();

  const notes = getNotes();
  return notes.filter((n) => {
    if (n.title.toLowerCase().includes(q)) return true;
    if (n.content.toLowerCase().includes(q)) return true;
    if (n.items?.some((it) => it.text.toLowerCase().includes(q))) return true;
    return false;
  });
}
