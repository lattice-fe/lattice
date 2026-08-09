<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/wordmark-light.svg">
    <img alt="Lattice" src="docs/wordmark-dark.svg" width="300">
  </picture>
</p>

<p align="center">
  A fast local file explorer with full-text search, in-app previews, and a companion CLI.<br>
  Everything runs locally on your machine with zero cloud dependencies.
</p>

<p align="center">
  <a href="docs/cli.md">CLI reference</a> &middot;
  <a href="docs/SKILL.md">Agent skill</a> &middot;
  <a href="ROADMAP.md">Roadmap</a> &middot;
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Features

### File Explorer & Tabs

- **View modes:** List, Grid, and Cards with live previews (syntax-highlighted code, rendered Markdown, image cards).
- **Tab management:** Drag-to-reorder tabs across the titlebar, duplicate tabs, and organize work into Chrome-style color-coded tab groups with collapse/expand toggles.
- **Navigation:** Breadcrumbs, back/forward history, up directory (`Backspace`), and a Quick Access sidebar with pinnable folders.
- **File operations:** Copy, cut, paste, delete to trash, in-place rename (`F2`), and new file/folder creation (`Ctrl+N` / `Ctrl+Shift+N`).
- **Rubber-band selection:** Decoupled 60fps selection box from empty space.

### Built-in Editor & Previews

- **In-app code editor:** Syntax highlighting for JavaScript, TypeScript, Python, Rust, HTML, CSS, JSON, Markdown, TOML, YAML, SQL, and C/C++.
- **Find and replace:** In-editor search widget (`Ctrl+F` / `Ctrl+H`) with match counts, jump navigation (`Enter` / `Shift+Enter`), case matching, and replace all.
- **Editor status bar:** Real-time line/column cursor tracker, selection length, line and word counts, encoding, and language badges.
- **Markdown & HTML sandbox:** Dual-pane split view with rendered GFM tables and interactive sandboxed `<iframe>` previews for web code and HTML apps.
- **Rich media viewers:** PDF viewer, Jupyter notebook renderer (`.ipynb`), audio waveform player, and quick hover previews.
- **Sensitive file protection:** Automatic blurring for `.env`, credentials, and private keys during screen shares.

### Local Search & Indexing

Search runs against a zero-cloud SQLite database stored at `%LOCALAPPDATA%\Lattice\index.db`.

- **Name search:** Weighted, tokenized path matching folded in with in-memory folder caches so unindexed changes show up immediately.
- **Full-text search:** SQLite FTS5 with bm25 ranking across source files and documents.
- **Semantic search:** Optional local FastEmbed embeddings stored via `sqlite-vec`.
- **Spotlight launcher (`Alt+Space` / `Ctrl+K`):** Global command palette with prefix shortcuts:
  - `>` desktop apps
  - `@kind` filter by category (`code`, `doc`, `folder`, `image`, `audio`, `video`, `archive`)
  - `=` math evaluator
  - `?` web search
  - `Shift+Enter` opens any file match directly in a new Lattice tab.

### Theming

- **11 built-in themes:** Ink, Paper, Slate, Copper, Forest, Midnight, Canvas, Ash, Amber, Graphite, and Sepia.
- **Custom theme editor:** Token color pickers, corner radius, glow/shadow, and font settings with JSON import/export.
- Themes synchronize live between the main window and Spotlight.

### `lat` CLI

Lattice includes a standalone command-line binary (`lat` / `lattice-cli`) that shares the desktop index:

```bash
lat "main.rs"              # fast filename search
lat -t "reconcile"         # full-text content search
lat -p README.md           # syntax-colored terminal preview
lat -r "src/lib.rs"        # reveal and highlight file in Lattice GUI
lat --json "@code editor"  # structured JSON for scripts and agents
```

See the [CLI Guide](docs/cli.md) and [Agent Skill](docs/SKILL.md) for full options.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Back / Forward | `Alt+←` / `Alt+→` |
| Up a directory | `Backspace` |
| Refresh | `F5` |
| Spotlight launcher | `Alt+Space` or `Ctrl+K` |
| Global search bar | `Ctrl+F` (in folder view) |
| In-editor find / replace | `Ctrl+F` / `Ctrl+H` (in editor) |
| In-editor save | `Ctrl+S` (auto-saves on edit) |
| New file | `Ctrl+N` |
| New folder | `Ctrl+Shift+N` |
| New / close tab | `Ctrl+T` / `Ctrl+W` |
| Cycle tabs | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Select all | `Ctrl+A` |
| Copy / Cut / Paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Rename | `F2` |
| Delete to trash | `Delete` |
| Toggle hidden files | `Ctrl+H` (in folder view) |

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Highlight.js, React-Markdown, PDF.js.
- **Shell:** Tauri 2 (WebView2 on Windows), custom window decorations, global shortcuts, system tray.
- **Backend:** Rust, `rusqlite` (SQLite + FTS5), `sqlite-vec`, `fastembed`, and the `ignore` crate for gitignore-aware filesystem walks.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.77+

### Development

```bash
cd app
npm install
npm run tauri dev
```

### Production Build

```bash
cd app
npm run tauri build
```

---

## Project Layout

```
app/
  src/            React frontend (components, hooks, editor, themes)
  src-tauri/
    src/
      core/       Rust core: filesystem, indexer, search, embeddings
      cli/        the `lat` CLI
      lib.rs      Tauri commands and window lifecycle
docs/
  cli.md          CLI reference
  SKILL.md        Agent skill instructions
ROADMAP.md        Product roadmap
CHANGELOG.md      Release history
```
