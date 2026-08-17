import { Skill } from "./types";
import {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
  toggleChecklistItem,
} from "../../keep/store";
import { NoteColor } from "../../keep/types";

const instructions = `
# Skill: Notes & Checklists (Lattice Keep)

Use this skill to manage the user's personal knowledge base, to-do lists, scratchpads, and reminders inside Lattice Keep.

## Guidelines
- **Note Types**: Support both standard markdown notes ('note') and interactive to-do lists ('checklist').
- **Checklists**: When user asks to make a list or to-do items, create a 'checklist' with items array.
- **Color Coding**: Choose thoughtful color accents based on context:
  - 'amber': default warm notes, daily thoughts, highlights
  - 'sage': tasks, nature, completed goals
  - 'terracotta': urgent, important notices, deadlines
  - 'slate': technical references, code snippets, configs
  - 'violet': creative ideas, brainstorms, dreams
  - 'rose': personal, reminders, events
  - 'sand': archives, neutral logs
- **Appending**: When adding to existing lists or notes, prefer 'append_to_note' over re-creating.
- **Formatting**: Use clean GitHub-flavored markdown in note content (headings, bullet points, bold keywords).
`.trim();

export const notesSkill: Skill = {
  name: "notes",
  title: "Lattice Keep Notes & Checklists",
  description: "Create, search, view, update, append to, and delete notes and checklists in Lattice Keep, and set timed desktop reminders.",
  instructions,
  tools: [
    {
      type: "function",
      function: {
        name: "create_note",
        description: "Create a new note or checklist in Lattice Keep",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title of the note or checklist" },
            content: { type: "string", description: "Markdown body text for regular notes" },
            items: {
              type: "array",
              items: { type: "string" },
              description: "List of item strings if creating a checklist",
            },
            type: {
              type: "string",
              enum: ["note", "checklist"],
              description: "Type of note ('note' or 'checklist')",
            },
            color: {
              type: "string",
              enum: ["default", "amber", "terracotta", "sage", "slate", "violet", "rose", "sand"],
              description: "Color palette theme for the note card",
            },
            pinned: { type: "boolean", description: "Whether to pin the note to the top" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_reminder",
        description: "Set a timed reminder. Creates a note that pops up a desktop reminder at the given time. Prefer 'remind_in_minutes' for relative times like 'in a minute' or 'in 2 hours' — you do not need to know the current time for that.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "What to remind the user about" },
            remind_in_minutes: { type: "number", description: "Fire the reminder this many minutes from now (e.g. 1 for 'in a minute', 120 for 'in 2 hours'). Use this whenever the time is relative." },
            remind_at: { type: "string", description: "Absolute local time as ISO 8601 (YYYY-MM-DDTHH:mm). Only use if you reliably know the target date/time; otherwise prefer remind_in_minutes." },
            content: { type: "string", description: "Optional extra details for the reminder note" },
            color: {
              type: "string",
              enum: ["default", "amber", "terracotta", "sage", "slate", "violet", "rose", "sand"],
              description: "Color palette theme for the note card",
            },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_notes",
        description: "Search notes and checklists by keyword or topic",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query or keywords" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_notes",
        description: "List recent notes and checklists from Lattice Keep",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of notes to return (default: 8)" },
            pinned_only: { type: "boolean", description: "Filter to only pinned notes" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_note",
        description: "Get full details of a specific note by ID",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "The unique ID of the note" },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_note",
        description: "Update fields of an existing note",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "ID of the note to update" },
            title: { type: "string", description: "New title" },
            content: { type: "string", description: "New markdown content (for regular notes)" },
            color: {
              type: "string",
              enum: ["default", "amber", "terracotta", "sage", "slate", "violet", "rose", "sand"],
              description: "New color",
            },
            pinned: { type: "boolean", description: "Set pinned status" },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "append_to_note",
        description: "Append text to a note's body or add a new item to a checklist",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "ID of the note to append to" },
            text: { type: "string", description: "Text to append or new checklist item text" },
          },
          required: ["id", "text"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "toggle_checklist_item",
        description: "Toggle a checklist item's completion status",
        parameters: {
          type: "object",
          properties: {
            note_id: { type: "string", description: "ID of the checklist note" },
            item_id: { type: "string", description: "ID of the item within the checklist" },
          },
          required: ["note_id", "item_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_note",
        description: "Permanently delete a note or checklist from Lattice Keep",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "ID of the note to delete" },
          },
          required: ["id"],
        },
      },
    },
  ],
  execute(name: string, args: any) {
    switch (name) {
      case "create_note": {
        const note = createNote({
          title: args.title,
          content: args.content,
          items: args.items,
          type: args.type || (args.items && args.items.length > 0 ? "checklist" : "note"),
          color: (args.color as NoteColor) || "amber",
          pinned: args.pinned,
          author: "watson",
        });
        return { success: true, note_id: note.id, title: note.title, type: note.type };
      }
      case "create_reminder": {
        let remindAt: number | undefined;
        if (typeof args.remind_in_minutes === "number" && args.remind_in_minutes >= 0) {
          remindAt = Date.now() + args.remind_in_minutes * 60000;
        } else if (typeof args.remind_at === "string") {
          const t = Date.parse(args.remind_at);
          if (!Number.isNaN(t)) remindAt = t;
        }
        if (!remindAt) return { success: false, error: "Provide remind_in_minutes (relative) or a valid remind_at ISO datetime." };
        const note = createNote({
          title: args.title,
          content: args.content,
          type: "note",
          color: (args.color as NoteColor) || "amber",
          author: "watson",
          remindAt,
        });
        return { success: true, note_id: note.id, title: note.title, remind_at: new Date(remindAt).toLocaleString() };
      }
      case "search_notes": {
        const results = searchNotes(args.query || "");
        return results.slice(0, 6).map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          type: n.type,
          items: n.items,
          pinned: n.pinned,
          color: n.color,
        }));
      }
      case "list_notes": {
        let notes = getNotes();
        if (args.pinned_only) notes = notes.filter((n) => n.pinned);
        return notes.slice(0, args.limit || 8).map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          type: n.type,
          items: n.items,
          pinned: n.pinned,
          color: n.color,
        }));
      }
      case "get_note": {
        const note = getNote(args.id);
        if (!note) return { error: `Note not found with id: ${args.id}` };
        return note;
      }
      case "update_note": {
        const updated = updateNote(args.id, {
          title: args.title,
          content: args.content,
          color: args.color,
          pinned: args.pinned,
        });
        if (!updated) return { error: `Note not found with id: ${args.id}` };
        return { success: true, note: updated };
      }
      case "append_to_note": {
        const note = getNote(args.id);
        if (!note) return { error: `Note not found with id: ${args.id}` };
        if (note.type === "checklist" || (note.items && note.items.length > 0)) {
          const now = Date.now();
          const nextItems = [
            ...(note.items || []),
            { id: `item-${now}-${Math.random().toString(36).slice(2, 6)}`, text: args.text, done: false },
          ];
          const updated = updateNote(args.id, { items: nextItems });
          return { success: true, note: updated };
        } else {
          const newContent = note.content ? `${note.content}\n${args.text}` : args.text;
          const updated = updateNote(args.id, { content: newContent });
          return { success: true, note: updated };
        }
      }
      case "toggle_checklist_item": {
        toggleChecklistItem(args.note_id, args.item_id);
        const note = getNote(args.note_id);
        return { success: true, note };
      }
      case "delete_note": {
        const ok = deleteNote(args.id);
        return { success: ok, message: ok ? "Note deleted" : "Note not found" };
      }
      default:
        return { error: `Unknown notes tool: ${name}` };
    }
  },
};
