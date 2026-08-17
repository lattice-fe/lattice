export type NoteColor =
  | "default"
  | "amber"
  | "terracotta"
  | "sage"
  | "slate"
  | "violet"
  | "rose"
  | "sand";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  items?: ChecklistItem[];
  type: "note" | "checklist";
  color: NoteColor;
  pinned: boolean;
  author?: "watson" | "user";
  archived?: boolean;
  remindAt?: number;       // epoch ms to fire a local reminder; unset = no reminder
  reminderDone?: boolean;  // reminder already fired (cleared when remindAt is (re)set)
  createdAt: number;
  updatedAt: number;
}
