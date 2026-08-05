# 🗺️ Lattice Product Roadmap

Lattice is a modern, high-performance, inviting file explorer built with Tauri 2, React 19, and Rust.

---

## 🎯 Short-Term Feature Goals

### 1. 📄 PDF Hover & Side Preview Strategy
- High-fidelity PDF preview rendering in the hover preview and inspector side panel.
- Page rendering, text extraction summary, and thumbnail navigation.

### 2. 📝 Quick Text Editor Panel (Tabbed View)
- In-app text/code editor tab for viewing and editing files directly within Lattice.
- Syntax highlighting powered by `highlight.js`.
- Keyboard shortcuts (`Ctrl+S` to save, `Ctrl+W` to close tab).

### 3. 🎵 Audio Waveform & Interactive Side Player
- Audio preview strategy featuring interactive waveform visualization in the inspector side panel.
- Play/pause/seek controls embedded directly into the file tile header.

### 4. 💻 Lattice CLI Frontend (`lattice-cli`)
- Terminal interface for fast searching and previewing.
- Spotlight syntax alignment: `>`, `@`, `=`, `?`, `/`.
- Configurable result count (default 5–10 items).
- Direct-open option (`--open` / best match launch).
- Terminal text preview mode (`-p` / `--preview`).

---

## 🚀 Long-Term Vision
- **Smart File Auto-Sorter**: Rule-based 1-click cleanup for Downloads/Desktop.
- **Disk Space Heatmap**: Interactive visual storage analyzer (Treemap / Sunburst diagram).
- **Custom Theme Creator**: User-defined color palettes, glassmorphism density, and typography options.
