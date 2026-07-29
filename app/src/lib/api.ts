import { invoke } from "@tauri-apps/api/core";

export type Kind =
  | "folder" | "image" | "audio" | "video"
  | "archive" | "document" | "code" | "executable" | "other";

export interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  kind: Kind;
  type_label: string;
  hidden: boolean;
}
export interface Drive { letter: string; name: string; display: string; path: string; }
export interface Shortcut { label: string; path: string; }

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---- mock data for browser preview (npm run dev, no backend) ----
const now = Date.now();
const MOCK: Entry[] = [
  m("src", true, 0, 2, "folder", "File folder"),
  m("assets", true, 0, 26, "folder", "File folder"),
  m("branding", true, 0, 5, "folder", "File folder"),
  m("Cargo.toml", false, 2100, 2, "code", "TOML File"),
  m("main.rs", false, 8400, 2, "code", "Rust Source"),
  m("README.md", false, 4900, 72, "document", "Markdown File"),
  m("hero-render.png", false, 3.2e6, 168, "image", "PNG image"),
  m("walkthrough.mov", false, 184e6, 168, "video", "QuickTime"),
  m("theme.wav", false, 5.1e6, 216, "audio", "WAV audio"),
  m("design-notes.md", false, 12000, 336, "document", "Markdown File"),
  m("benchmarks.json", false, 56000, 504, "code", "JSON File"),
  m("release.zip", false, 41e6, 720, "archive", "Archive"),
];
function m(name: string, is_dir: boolean, size: number, hoursAgo: number, kind: Kind, type_label: string): Entry {
  return { name, path: `~/lattice/${name}`, is_dir, size, modified: now - hoursAgo * 3600e3, kind, type_label, hidden: false };
}
const MOCK_DRIVES: Drive[] = [
  { letter: "C", name: "Local Disk", display: "Local Disk (C:)", path: "C:/" },
  { letter: "D", name: "Local Disk", display: "Local Disk (D:)", path: "D:/" },
];
const MOCK_QUICK: Shortcut[] = [
  { label: "Home", path: "~" }, { label: "Downloads", path: "~/Downloads" },
  { label: "Documents", path: "~/Documents" }, { label: "Pictures", path: "~/Pictures" },
];

// ---- typed command wrappers ----
export const api = {
  async listDir(path: string, showHidden: boolean): Promise<Entry[]> {
    if (!isTauri) return MOCK;
    return invoke<Entry[]>("list_dir", { path, showHidden });
  },
  async drives(): Promise<Drive[]> {
    if (!isTauri) return MOCK_DRIVES;
    return invoke<Drive[]>("drives");
  },
  async quickAccess(): Promise<Shortcut[]> {
    if (!isTauri) return MOCK_QUICK;
    return invoke<Shortcut[]>("quick_access");
  },
  async homeDir(): Promise<string> {
    if (!isTauri) return "~";
    return invoke<string>("home_dir");
  },
  async newFolder(dir: string): Promise<string> {
    if (!isTauri) return `${dir}/New folder`;
    return invoke<string>("new_folder", { dir });
  },
  async rename(path: string, newName: string): Promise<string> {
    if (!isTauri) return path;
    return invoke<string>("rename", { path, newName });
  },
  async copyItems(sources: string[], dest: string): Promise<void> {
    if (!isTauri) return;
    return invoke("copy_items", { sources, dest });
  },
  async moveItems(sources: string[], dest: string): Promise<void> {
    if (!isTauri) return;
    return invoke("move_items", { sources, dest });
  },
  async deleteItems(paths: string[]): Promise<void> {
    if (!isTauri) return;
    return invoke("delete_items", { paths });
  },
  async openPath(path: string): Promise<void> {
    if (!isTauri) return;
    return invoke("open_path", { path });
  },
  async reveal(path: string): Promise<void> {
    if (!isTauri) return;
    return invoke("reveal", { path });
  },
  // --- search + indexing (results arrive via the "index:*" events) ---
  async search(seq: number, query: string, mode: SearchMode): Promise<void> {
    if (!isTauri) return;
    return invoke("search", { seq, query, mode });
  },
  async indexFolder(path: string): Promise<void> {
    if (!isTauri) return;
    return invoke("index_folder", { path });
  },
  async collections(): Promise<Collection[]> {
    if (!isTauri) return [];
    return invoke<Collection[]>("collections");
  },
  async reindex(id: number): Promise<void> { if (!isTauri) return; return invoke("reindex", { id }); },
  async removeCollection(id: number): Promise<void> { if (!isTauri) return; return invoke("remove_collection", { id }); },
  async setSemantic(id: number, on: boolean): Promise<void> { if (!isTauri) return; return invoke("set_semantic", { id, on }); },
};

export type SearchMode = "name" | "text" | "semantic";
export interface Hit { file_path: string; snippet: string; score: number; char_start: number; }
export interface Collection { id: number; root: string; semantic: boolean; status: string; file_count: number; }

// Browser-preview mock: filter the mock entries by name.
export function mockSearch(query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MOCK.filter((e) => e.name.toLowerCase().includes(q)).map((e) => ({
    file_path: e.path, snippet: e.name, score: 1, char_start: 0,
  }));
}
