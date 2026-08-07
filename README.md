# Lattice

A modern, high-performance file explorer with local full-text and semantic
search, built with **Tauri 2**, **React 19**, and **Rust**. Everything runs
locally — indexing, embeddings, and search all happen on your machine, with no
network calls.

> Lattice aims to be high-performance *and* inviting — a file manager you enjoy
> being in, not just one you leave as fast as possible.

For the terminal companion, see **[`lat` — the Lattice CLI](docs/cli.md)**.

---

## Features

### File explorer

- **Three view modes** — List, Grid, and **Cards** (content-adaptive tiles:
  image thumbnails, syntax-highlighted code peeks, rendered markdown), lazy-loaded
  so big folders stay fast.
- **Tabs** — browser-style tabs, each with its own navigation history. Open a
  folder in a new tab via middle-click, context menu, or `Ctrl+T`.
- **Navigation** — breadcrumbs, back/forward history, up, and a Quick Access
  sidebar with user-pinnable folders.
- **File operations** — copy / cut / paste / delete (to trash), rename, new
  folder, reveal in OS explorer.
- **Rubber-band selection** with decoupled 60fps visual feedback.
- **Custom titlebar** with the tab strip and themed window controls.

### Previews

- **Hover preview** — rest on a file to peek its contents in a floating pane.
- **Inspector pane** with rich, per-type previews:
  - Images — full-bleed thumbnails + a gallery viewer (zoom 25–500%, fit, copy
    bytes to clipboard, metadata overlay)
  - Code — syntax highlighting (highlight.js)
  - Markdown — rendered, GFM tables, code blocks
  - PDF (PDF.js), HTML (sandboxed iframe), Jupyter notebooks (`.ipynb`)
  - Audio — waveform player
  - Text editor with a persisted Source / Preview split
- **Sensitive-file blur** — `.env`, credentials, and custom patterns are blurred
  for screen-sharing safety (with never-blur / never-unblur modes).

### Search & indexing

Search is powered by a local index you build per folder ("collections").

- **Name** — fast filename/path search with weighted, tokenized ranking.
- **Text** — full-text content search over **SQLite FTS5** (bm25 ranking).
- **Semantic** — meaning-based search over **FastEmbed** embeddings stored in
  **sqlite-vec**.
- **Live merge** — name search also folds in the current folder's entries, so
  newly added/removed files are found immediately.
- **Auto-reconcile** — the current folder's collection re-indexes on navigate
  and window focus (large/drive-root collections are skipped to avoid heavy walks
  and refresh on manual reindex).
- **Spotlight** (`Alt+Space` / `Ctrl+K`) — a command palette with prefixes:
  `>` apps · `@kind` files · `?` web · `=` math · `/` commands.

### Theming

- **11 built-in themes** — Ink, Paper, Slate, Copper, Forest, Midnight, Canvas,
  Ash, Amber, Graphite, Sepia (light and dark).
- **Custom theme editor** — live per-token color pickers, corner radius, glow /
  shadow, and fonts, with **import / export as JSON** (bring your own theme).
- Themes sync across the main window and the Spotlight window.

---

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Back / Forward | `Alt+←` / `Alt+→` |
| Up a folder | `Backspace` |
| Refresh | `F5` |
| Focus search | `Ctrl+F` |
| Spotlight | `Alt+Space` or `Ctrl+K` |
| New / close tab | `Ctrl+T` / `Ctrl+W` |
| Cycle tabs | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Select all | `Ctrl+A` |
| Copy / Cut / Paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Rename | `F2` |
| New folder | `Ctrl+Shift+N` |
| Delete (to trash) | `Delete` |
| Open | `Enter` |
| Toggle hidden files | `Ctrl+H` |

---

## Tech stack

- **Frontend** — React 19 + TypeScript, Vite. highlight.js, react-markdown,
  rehype-highlight, PDF.js.
- **Shell** — Tauri 2 (WebView2), custom window chrome, global shortcut, tray,
  single-instance.
- **Backend (Rust)** — `rusqlite` (bundled SQLite, FTS5) + `sqlite-vec` +
  `fastembed` for search/embeddings; `pdf-extract` for PDF text; the `ignore`
  crate for gitignore-aware walking.

The index database is shared between the app and the [`lat` CLI](docs/cli.md) at
`%LOCALAPPDATA%\Lattice\index.db`.

---

## Getting started

### Prerequisites

- Node.js 18+
- Rust 1.77+

### Development

```bash
cd app
npm install
npm run tauri dev
```

### Production build

```bash
cd app
npm run tauri build
```

---

## Project layout

```
app/
  src/            React frontend (components, hooks, lib)
  src-tauri/
    src/
      core/       Rust core: fs, sort, format, index (search/embed/walk)
      cli/        the `lat` CLI (shares the core index)
      lib.rs      Tauri commands + window/tray setup
docs/cli.md       CLI reference
ROADMAP.md        planned work
CHANGELOG.md      release history
```

---

## Links

- **[CLI reference](docs/cli.md)** — the `lat` terminal companion
- **[Roadmap](ROADMAP.md)** — what's planned
- **[Changelog](CHANGELOG.md)** — release history
