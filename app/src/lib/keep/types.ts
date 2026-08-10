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
  createdAt: number;
  updatedAt: number;
}
