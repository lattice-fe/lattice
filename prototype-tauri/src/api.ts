import { invoke } from "@tauri-apps/api/core";

export type Kind =
  | "folder"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "document"
  | "code"
  | "executable"
  | "other";

export interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  kind: Kind;
}

// When running under `npm run dev` (plain browser, no Tauri backend) we serve
// mock data so the design is reviewable. Under `tauri dev` the real Rust
// commands run against the actual filesystem.
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOCK: Entry[] = [
  { name: "src", path: "~/lattice/src", is_dir: true, size: 0, modified: Date.now() - 2 * 3600e3, kind: "folder" },
  { name: "assets", path: "~/lattice/assets", is_dir: true, size: 0, modified: Date.now() - 26 * 3600e3, kind: "folder" },
  { name: "branding", path: "~/lattice/branding", is_dir: true, size: 0, modified: Date.now() - 5 * 3600e3, kind: "folder" },
  { name: "Cargo.toml", path: "~/lattice/Cargo.toml", is_dir: false, size: 2100, modified: Date.now() - 2 * 3600e3, kind: "code" },
  { name: "main.rs", path: "~/lattice/src/main.rs", is_dir: false, size: 8400, modified: Date.now() - 2 * 3600e3, kind: "code" },
  { name: "README.md", path: "~/lattice/README.md", is_dir: false, size: 4900, modified: Date.now() - 3 * 86400e3, kind: "document" },
  { name: "hero-render.png", path: "~/lattice/assets/hero-render.png", is_dir: false, size: 3.2e6, modified: Date.now() - 7 * 86400e3, kind: "image" },
  { name: "walkthrough.mov", path: "~/lattice/assets/walkthrough.mov", is_dir: false, size: 184e6, modified: Date.now() - 7 * 86400e3, kind: "video" },
  { name: "theme.wav", path: "~/lattice/assets/theme.wav", is_dir: false, size: 5.1e6, modified: Date.now() - 9 * 86400e3, kind: "audio" },
  { name: "design-notes.md", path: "~/lattice/design-notes.md", is_dir: false, size: 12000, modified: Date.now() - 14 * 86400e3, kind: "document" },
  { name: "benchmarks.json", path: "~/lattice/benchmarks.json", is_dir: false, size: 56000, modified: Date.now() - 21 * 86400e3, kind: "code" },
  { name: "release.zip", path: "~/lattice/release.zip", is_dir: false, size: 41e6, modified: Date.now() - 30 * 86400e3, kind: "archive" },
];

export async function listDir(path: string): Promise<Entry[]> {
  if (!isTauri) return MOCK;
  return invoke<Entry[]>("list_dir", { path });
}

export async function homeDir(): Promise<string> {
  if (!isTauri) return "C:/Users/you";
  return invoke<string>("home_dir");
}
