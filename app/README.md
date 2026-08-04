# Lattice

A modern file explorer with local semantic search, built with Tauri + React.

## Features

### v0.1.0

**Core File Explorer**
- Three view modes: List, Grid, and Cards (with content previews)
- Multi-tab browsing
- Rubber band selection with optimized collision detection
- Keyboard shortcuts (Ctrl+A, Ctrl+C/X/V, Delete, F2 rename, etc.)
- Copy, cut, paste, and delete operations
- Folder navigation with breadcrumbs and history (back/forward)
- Quick access sidebar with pinned folders
- File preview pane with lazy-loaded content

**Search & Indexing**
- Spotlight-style command palette (Ctrl+K)
- Full-text and semantic search
- Background indexing
- Search across file names and contents

**Theming**
- Multiple built-in themes (Dark, Light, Monokai, Nord, etc.)
- Custom theme editor with live preview
- Import/export custom themes
- Configurable UI elements (colors, borders, radius)

**UI Polish**
- Adaptive Cards view with intelligent layout
- Hover previews for files and folders
- Code syntax highlighting in previews
- Markdown rendering in cards view
- Sensitive file blurring (.env files, credentials)
- Smooth animations and transitions
- Context menus for file operations

## Installation

### Prerequisites
- Node.js 18+
- Rust 1.70+ (for Tauri)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run build
npm run tauri build
```

## Usage

### Keyboard Shortcuts

- `Ctrl+F` - Focus search
- `Ctrl+K` - Open Spotlight
- `Ctrl+A` - Select all
- `Ctrl+C` - Copy
- `Ctrl+X` - Cut
- `Ctrl+V` - Paste
- `Delete` - Delete selected items
- `F2` - Rename selected item
- `Backspace` - Go up one directory
- `Alt+←/→` - Navigate back/forward
- `Ctrl+T` - New tab
- `Ctrl+W` - Close tab
- `Ctrl+Tab` - Switch tabs
- `Ctrl+H` - Toggle hidden files
- `Esc` - Clear selection / Close dialogs

### Rubber Band Selection

Click and drag on empty space to create a selection rectangle. Hold Ctrl/Cmd while dragging to add to existing selection.

### View Modes

- **List**: Compact rows with name, modified date, and size
- **Grid**: Icon tiles with labels
- **Cards**: Rich previews showing file content (code, images, markdown)

## Architecture

Built with:
- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Tauri 2, Rust
- **Styling**: Custom CSS with theme engine
- **Search**: Tantivy (full-text) + FastEmbed (semantic)

## Known Limitations

- Drag-and-drop file operations not yet implemented (coming in v0.2)
- Search indexing runs in background but may impact performance on large directories
- Some file previews may not load for very large files

## Roadmap

**v0.2 (Planned)**
- Drag-and-drop file operations
- Bulk rename utility
- Archive extraction
- File watchers for live updates

**v0.3 (Planned)**
- Cloud storage integration
- Advanced search filters
- Saved searches
- File tagging system

## License

[Add your license here]

## Credits

Built with Claude Code and lots of ☕
