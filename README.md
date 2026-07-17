# Lattice

A Windows file explorer built from scratch in Rust with [iced](https://iced.rs) 0.14.

Windows-first, but filesystem knowledge lives behind a `Platform` trait so other
operating systems can be added without touching the UI.

## Features

**Browsing**
- Navigation pane: Quick Access, drives, and a lazily-expanding folder tree
- Address bar with a clickable breadcrumb and click-to-edit path entry
- Details view — Name / Date modified / Type / Size, sortable columns (folders first)
- Back / forward / up history
- Ctrl/Shift multi-selection with a live status bar (count + selected size)
- Hidden-files toggle, category icons

**File operations**
- Copy / cut / paste (with `name - Copy` collision handling)
- Rename (inline), New folder, Delete → **Recycle Bin** (via the [`trash`](https://crates.io/crates/trash) crate)
- Right-click context menus and a command bar
- Guarded against pasting a folder into itself or a subfolder

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Back / Forward | `Alt+←` / `Alt+→` |
| Up a folder | `Backspace` |
| Refresh | `F5` |
| Select all | `Ctrl+A` |
| Copy / Cut / Paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Rename | `F2` |
| New folder | `Ctrl+Shift+N` |
| Delete (to Recycle Bin) | `Delete` |
| Open / activate | `Enter` or double-click |
| Cancel / close menu | `Esc` |

## Build & run

```sh
cargo run
```

Requires Rust 1.88+ (iced 0.14). Tested on Windows 11.

```sh
cargo test   # pure logic: history, selection, sorting, formatting, file ops
```

## Architecture

Single `App` state with an Elm-style `update` / `view` loop.

- `src/fs/` — filesystem core: `entry` (model + type classification), `scan`
  (async directory scanning), `ops` (copy/move/rename/delete), `platform` +
  `windows` (drives, known folders)
- `src/ui/` — one module per widget (toolbar, breadcrumb, sidebar, file list,
  status bar, context menu, command bar, icons, styles)
- `navigation`, `selection`, `sort`, `format` — pure, unit-tested logic
