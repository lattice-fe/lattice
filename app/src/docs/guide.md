# 1. Core Concepts & Navigation

Lattice is a high-performance local file explorer built for speed, privacy, and seamless terminal hand-off. It combines sub-10ms SQLite index searching, local vector embeddings, 11 curated dark themes, and rich in-app previews.

## Previews

Lattice provides three distinct ways to inspect and edit files without launching external applications:

- **Hover Previews:** Hovering over any file card in grid or list view displays an instant image or code snippet preview. Customize preview trigger timing in *Settings ➔ Hover Preview* (default: 550ms delay, 250ms persistence).
- **Inspector Preview Pane:** The right-side inspector panel displays file metadata (size, created/modified timestamps, kind), absolute path, and audio waveform playback controls for supported audio files.
- **Shift Previews:** Pressing `Shift+Enter` or `Shift+Click` on a file opens it directly in preview mode. Under *Settings ➔ General*, you can configure Shift-Open to display files in a **50% Side-by-Side Split View Panel** or open as an **Individual Explorer Tab**.

## Views & Sensitive File Protection

Switch between layout view modes using the topbar layout controls:

- **List View:** Compact single-line table optimized for high-density file management.
- **Grid View:** Clean, responsive grid of file and folder tiles with type-colored glyph icons.
- **Sensitive Files Blur:** Dotfiles containing credentials or API keys (e.g. `.env`, `.env.local`, `id_rsa`) are automatically blurred in previews to prevent accidental disclosure during screen shares or presentations. Configure blur behavior under *Settings ➔ General*.

## Indexing & Local Semantic Search

Lattice builds a fast, zero-cloud SQLite search database directly on your device:

- **Indexing a Directory:** Add a folder by navigating to *Settings ➔ Indexing ➔ Add Directory*, or right-clicking inside any folder in the explorer and selecting **"Index this directory"**.
- **Settings Indexing Pane:** Manage collection paths, inspect total indexed files, monitor database size, trigger manual re-scans, or remove collections.
- **Semantic Opt-in & Local Vectors:** Enable *Semantic Vector Search* in the Indexing pane to generate local 384-dimensional FastEmbed embeddings. Search your codebase and documents by concept, topic, and context with complete privacy.

---

# 2. Global Spotlight Launcher

Press **Alt+Space** (or **Ctrl+Space** on Windows) from any application to toggle the Spotlight launcher.

### Spotlight Prefix Shortcuts

| Prefix | Mode | Example | Description |
| :--- | :--- | :--- | :--- |
| `=` | Math | `= 256 * 1024` | Evaluates arithmetic expressions directly in terminal/launcher |
| `@` | Kind Filter | `@code main.rs` | Filters search results by category (`code`, `doc`, `folder`, `image`, `audio`, `video`, `archive`) |
| `>` | App Launcher | `> vscode` | Launches installed desktop applications or executables |
| `?` | Web Search | `? react docs` | Opens web search query directly in default browser |

### Spotlight Selection Shortcuts

- **`Enter` on Folders:** Navigates directly to the directory in the active Lattice workspace (or smoothly switches to existing tab if already open).
- **`Enter` on Files:** Opens the target file in your OS default application.
- **`Shift + Enter` on Files:** Instantly opens the file directly in a new Lattice preview / editor tab (supporting Markdown, code, HTML sandbox, PDF, and notebooks).

---

# 3. Lattice CLI ('lat' / 'lattice-cli')

Lattice includes a high-performance terminal CLI binary (`lat` and `lattice-cli`) for sub-10ms index queries and GUI navigation hand-off.


### Installation to System PATH

```bash
lat --install
```

Copies `lat.exe` to `%LOCALAPPDATA%\Microsoft\WindowsApps`, putting `lat` on your system `PATH`.

### CLI Flags & Options

| Flag | Description | Example |
| :--- | :--- | :--- |
| `lat <query>` | Fast filename & path search | `lat "main.rs"` |
| `-t, --text` | Full-text FTS5 bm25 content search | `lat -t "scan_dir"` |
| `-p, --preview` | Terminal text preview with line numbers | `lat -p README.md` |
| `-o, --open` | Direct open file, or open folder in Lattice GUI | `lat -o D:\dev\project` |
| `-r, --reveal` | Reveal & highlight file/folder in Lattice GUI | `lat -r src/main.rs` |
| `--json, -j` | Structured machine-readable JSON array for agents | `lat --json "config"` |

### Agent Process Exit Codes

- `0` — Search matches found successfully
- `1` — Query executed cleanly, no matching results found
- `2` — Execution error (invalid arguments or missing target file)

---

# 4. Custom Themes & JSON Theme Schema

Lattice includes 11 built-in dark and light themes (*Ink, Paper, Slate, Copper, Forest, Midnight, Canvas, Ash, Amber, Graphite, Sepia*). You can edit, clone, or create custom themes in *Settings ➔ Appearance ➔ Custom Theme Editor*.

### Importing & Exporting Themes

- **Copy JSON:** In the Theme Editor, click **Copy JSON** to copy the current theme's configuration directly to your clipboard.
- **Import:** Click **Import** to paste any theme JSON schema and apply it live.

### Theme JSON Structure

```json
{
  "name": "Graphite copy",
  "appearance": "dark",
  "tokens": {
    "bg": "#121212",
    "surface": "#1e1e1e",
    "surfaceHover": "#2a2a2a",
    "border": "#333333",
    "text": "#e0e0e0",
    "textDim": "#9e9e9e",
    "accent": "#5f6b78",
    "accent2": "#6b7b89",
    "accent3": "#4f5b68",
    "danger": "#c0392b"
  },
  "radius": 11,
  "effects": {
    "glow": "#5f6b78",
    "glowStrength": 0.02,
    "shadowStrength": 0.8
  },
  "tiles": {
    "rust": {
      "bg": "#2a1f1a", "fg": "#bcaaa4"
    },
    "amber": {
      "bg": "#2e261a", "fg": "#d7ccc8"
    },
    "green": {
      "bg": "#1a2622", "fg": "#b0bec5"
    },
    "violet": {
      "bg": "#221a28", "fg": "#d1c4e9"
    },
    "red": {
      "bg": "#2e1a20", "fg": "#e57373"
    },
    "neutral": {
      "bg": "#26201a", "fg": "#a0a0a0"
    }
  },
  "fonts": {}
}
```

---

# 5. Built-in Code Editor & Tab Groups

Lattice features a native, zero-dependency code and document editor designed for fast inspection, on-the-fly edits, and live preview rendering without leaving your workspace.

### Editor Modes & Previews

- **Source / Split / Preview:** Toggle between raw syntax-highlighted code, side-by-side split view, or full preview pane.
- **Live Markdown Preview:** Full GitHub Flavored Markdown (GFM) table formatting, inline code tokens, and internal relative link navigation.
- **Interactive HTML Sandbox:** Live sandboxed `<iframe>` rendering for web documents, games, canvas animations, and reactive widgets.
- **Debounced Continuous Auto-save:** Edits are automatically persisted to disk with real-time save state indicators.

### In-Editor Find & Replace

Press **Ctrl+F** (or click **Find** in the editor header) to summon the compact, floating in-document search bar:

- **Live Match Counter:** Displays real-time `X of Y` match statistics.
- **Jump to Match:** Press `Enter` (or `↓`) for next match, and `Shift+Enter` (or `↑`) for previous match. Matched lines automatically scroll into view.
- **Case Matching:** Toggle the `Aa` button for exact case-sensitive search.
- **In-Place Replace:** Press **Ctrl+H** to expand the Replace bar with instant single (`Replace`) or bulk (`All`) substitution.

### Editor Status Bar Footer

The bottom status bar provides real-time workspace metrics:
- **Cursor Metrics:** Active line and column (`Ln 14, Col 28`) plus selection character count (`(48 selected)`).
- **Document Statistics:** Total line count (`284 lines`) and total word count (`938 words`).
- **Encoding & Line Endings:** Text encoding (`UTF-8`) and line ending mode (`LF` / `CRLF`).
- **Language Badge:** Rounded pill badge displaying formatted Title Case language names (`TypeScript`, `Python`, `Rust`, `Markdown`, `HTML`, `Plain Text`).

### Advanced Tab Management & Tab Groups

- **Drag-to-Reorder:** Click and drag any tab across the titlebar strip to seamlessly rearrange your open tabs.
- **Split Preview Tab Indicators:** Tabs with an active 50% split preview pane automatically display `<folder> | <file>` in the tab strip for instant visual context.
- **Chrome-Style Tab Groups:** Right-click a tab to create color-coded tab groups (`Amber`, `Teal`, `Terracotta`, `Purple`, `Blue`). Group badges render inline before member tabs with live collapse/expand toggles and bottom accent borders.
- **Drag into Group:** Drag any tab directly over a group badge to automatically assign it to that group.
- **Tab Context Menu:** Right-click any tab for quick access to *Close Tab (`Ctrl+W`)*, *Close Other Tabs*, *Close Tabs to the Right*, *Duplicate Tab*, and *Copy Path*.
