# Changelog

All notable changes to Lattice will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-08-08

### Added

#### In-App Code & Markdown Editor
- **Full-featured Editor & Syntax Highlighting:** Integrated code editor supporting JavaScript, TypeScript, Python, Rust, HTML, CSS, JSON, Markdown, TOML, YAML, SQL, C/C++, and plain text with Highlight.js tokenization.
- **Source / Split / Preview Modes:** Dual-pane split view with live markdown preview (GFM tables, inline code, links) and sandboxed interactive HTML iframe preview with script execution.
- **In-Editor Find & Replace:** Floating in-editor search bar with real-time match count (`X of Y`), `Enter` / `Shift+Enter` (or arrow button) navigation to jump and scroll directly to matches, case-matching toggle (`Aa`), and instant single or bulk replace (`Replace` / `Replace All`) with continuous auto-save.
- **Real-time Status Bar Footer:** Displays `Ln X, Col Y` cursor position, selection character count (`(N selected)`), total line and word counts, character encoding (`UTF-8`), line endings (`LF` / `CRLF`), Title Case language pill badge (`TypeScript`, `Python`, `Markdown`, `HTML`), and background auto-save status indicator.
- **In-Editor File Renaming:** Clickable filename in the header to rename files directly from within the editor.

#### Tab Management & Chrome-style Tab Groups
- **Pointer-Based Drag-to-Reorder:** Smooth, responsive tab dragging across the titlebar with visual drop target indicator (`border-left: 2px solid var(--terracotta)`).
- **Chrome-style Inline Tab Groups:** Create named, color-coded tab groups (`Amber`, `Teal`, `Terracotta`, `Purple`, `Blue`) rendered inline with tabs. Features collapsible group badges with member counts, visual colored bottom accents on grouped tabs, and drag-and-drop tab assignment into groups.
- **Tab Context Menu:** Dedicated right-click menu on tabs supporting Close Tab (`Ctrl+W`), Close Other Tabs, Close Tabs to the Right, Duplicate Tab, Copy Path, Add to New Group, and Add to Existing Group.

#### Search & Global Navigation
- **Unified Global Search Dropdown:** Floating search dropdown accessible across folder views, editor tabs, and doc pages without interrupting or destroying the active canvas.
- **`lat` CLI:** Terminal companion for Lattice providing sub-10ms filename, full-text FTS5, and semantic search, previews, and open/reveal hand-off into the GUI with Spotlight prefix support (`=`, `@`, `>`, `?`), `--json` output, and process exit codes. See [docs/cli.md](docs/cli.md).
- **Global Shortcuts & New File Modal:** Wide single-row `Ctrl+N` new file creation with folder prefix badge, `Ctrl+Shift+N` new folder creation, and keybindings table integration.
- **Live Search Merge & Auto-Reconcile:** In-memory entry fold-in for instant unindexed search and automatic background index reconciliation on navigation and window focus.

### Fixed
- **Window Close Icon (×) SVG:** Corrected malformed SVG path (`L8.8 L8.8` → `L8.8 8.8`) restoring the first diagonal line of the window close button.
- **Tab Drag Region Conflict:** Removed conflicting `data-tauri-drag-region` from the tab container, preventing OS window drag from intercepting tab mouse interactions.
- **Context Menu Interaction:** Resolved event bubbling and screen-edge clamping for right-click context menus.
- **`lat` Read-Only Indexing:** CLI queries now open SQLite databases in read-only mode to prevent write locks against the GUI process.

## [0.2.0] - 2026-08-06

### Added
- **Image & Gallery Overhaul:** High-impact full-bleed cover thumbnails (`object-fit: cover`), zoom in/out/reset (25%–500%) controls, screen fit mode, floating metadata info overlay (`ℹ`), and instant copy image bytes to system clipboard (`✓`).
- **Type-Aware Card Grid:** Smart layout that automatically differentiates between high-impact media tiles (`210px` height) and compact code/document previews (`180px` height, single column).
- **PDF & HTML Previews:** Integrated split-panel PDF viewing via PDF.js canvas rendering and HTML iframe preview sandboxing.
- **Native Jupyter Notebook Viewer:** Zero-dependency, native `.ipynb` viewer supporting Markdown cells, formatted code blocks with syntax highlighting (`In [N]:`), and output rendering.
- **Markdown Renderer Extensions:** GFM Markdown table rendering (`| Header |`) with dark styled wrappers and inline bold (`**text**`) formatting.
- **Editor Mode & Tab Persistence:** Split-panel editor state (`Source` vs `Preview`) persists across tabs and app restarts via `localStorage`.
- **Spotlight & Navigation Enhancements:** Spotlight (`Alt+Space`) search directly opens selected directories in new tabs (`spotlight:navigate`). Added "Open preview" (`Shift ↵`) right-click context menu item.
- **Responsive Compact Display Mode:** Automatically routes split previews to isolated new tabs on screens smaller than 768px with toast feedback.
- **Window Controls Pinning:** Fixed right-side titlebar button clipping (`minimize`, `maximize`, `close`) on narrow displays.

### Fixed
- **Row Animation Snapping & Displacement:** Resolved microsecond leftward row displacement bug by switching row mounting animations to opacity fade-in keyframes.
- **Toast snappings:** Decoupled toast rise keyframes to eliminate visual snapping.
- **Image Copy Event Bubbling & SVG Scaling:** Scoped `.preview > svg` CSS to fix copy button distortion and prevented event bubbling.

## [0.1.0] - 2026-08-04

### Added

#### Core Features
- Three view modes: List, Grid, and Cards with rich content previews
- Multi-tab file browsing with tab management
- Rubber band selection with optimized performance
  - Decoupled visual feedback (60fps) from collision detection (throttled)
  - Only works from empty space to avoid conflicts
  - Visual feedback for intersecting items during selection
- Comprehensive keyboard shortcuts for all operations
- Copy, cut, paste, and delete file operations
- File and folder navigation with breadcrumbs
- History navigation (back/forward buttons)
- Quick access sidebar with pinned folders
- File preview pane with lazy-loaded content
- Context menus for file operations
- Rename functionality (F2 or right-click)
- New folder creation
- Toggle hidden files visibility

#### Search & Indexing
- Spotlight-style command palette (Ctrl+K)
- Full-text search powered by SQLite FTS5 (bm25 ranking)
- Semantic search with FastEmbed embeddings (stored via sqlite-vec)
- Background indexing with progress indicator
- Search across file names and contents
- Index status indicator in UI

#### Adaptive Cards View
- Intelligent layout that adapts to folder content
- Code file previews with syntax highlighting
- Markdown file rendering
- Image thumbnails
- Compact folder strip for mixed-content folders
- Lazy loading for performance (300px intersection margin)
- Special sizing for config files (1x1 vs 2x1 grid spans)

#### Theming System
- 11 built-in themes: Ink, Paper, Slate, Copper, Forest, Midnight, Canvas, Ash, Amber, Graphite, Sepia
- Custom theme editor with live preview
- Theme import/export (JSON format)
- Configurable elements:
  - Colors (background, foreground, accents, borders)
  - Border radius (UI corners)
  - Icon colors for different file types
- Theme validation with helpful error messages
- Synced themes across main window and Spotlight

#### UI Polish
- Hover previews for files and folders
- Smooth animations and transitions
- Sensitive file blurring for .env and credential files
  - Configurable blur patterns
  - "Never blur" and "Never unblur" modes
- Code syntax highlighting in previews (via highlight.js)
- Markdown rendering with syntax highlighting
- File type icons with color-coded backgrounds
- Storage usage indicator in sidebar
- Global click-to-deselect behavior
- Preview pane collapse/expand with persistent handle

#### Settings
- Settings panel with multiple sections
- Search index management (pause, resume, clear cache)
- Theme selection and customization
- Keyboard shortcuts reference
- Sensitive file blur configuration
- System information display

### Technical Improvements
- Migrated from iced to Tauri + React for better UI flexibility
- Optimized rubber band selection with RAF-based visual updates
- Element position caching to avoid repeated getBoundingClientRect calls
- Throttled collision detection (67ms intervals)
- CSS optimizations with will-change hints
- Lazy loading for file previews using IntersectionObserver
- React 19 with TypeScript for type safety
- Vite for fast development builds

### Dependencies
- React 19.1.0
- Tauri 2.x
- TypeScript 5.8.3
- Vite 7.0.4
- highlight.js 11.11.1 (syntax highlighting)
- react-markdown 9.1.0 (markdown rendering)
- rehype-highlight 7.0.2 (markdown code blocks)

### Known Issues
- Drag-and-drop file operations not yet implemented (planned for v0.2)
- In rare cases, rubber band selection state may not render visually (under investigation)
- Large file previews may cause brief UI lag
- Search indexing can impact performance on very large directories

### Breaking Changes
- Complete rewrite from iced (Rust native UI) to Tauri + React
- This is the first release of the Tauri version
- Previous iced implementation moved to `retired-iced` branch

---

## Previous Versions (iced implementation)

The original iced-based implementation (P1-P6) is archived in the `retired-iced` branch.
Features included basic file browsing, FTS search, semantic search, and dark mode.
