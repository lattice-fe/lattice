---
name: lat-cli
description: Search, preview, and interact with the local filesystem and Lattice GUI using the high-performance 'lat' (or 'lattice-cli') terminal companion.
---

# Lattice CLI (`lat` / `lattice-cli`) Agent Skill

Lattice provides a sub-10ms terminal tool (`lat` and `lattice-cli`) backed by SQLite FTS5 full-text indexing, tokenized filename search, syntax-highlighted terminal previews, and hand-off mechanisms into the Lattice desktop GUI.

---

## Quick Reference

```bash
# 1. Filename & Path Search
lat "<query>" [-n <count>] [--json]

# 2. Full-Text Content Search (SQLite FTS5, bm25)
lat -t "<text_query>" [-n <count>] [--json]

# 3. Kind-Filtered Search
lat "@<kind> <query>" [-n <count>] [--json]

# 4. Terminal Preview with Syntax Highlighting & Line Numbers
lat -p <file_path>

# 5. Open or Reveal in GUI
lat -o <query_or_path>    # Opens file in default app, or folder in Lattice tab
lat -r <query_or_path>    # Reveals and highlights file/folder in Lattice GUI
```

---

## Search Modes & Filters

### 1. Filename Search (Default)
Fast, weighted tokenized search over all indexed collections and in-memory directory caches:
```bash
lat "TextEditor.tsx"
lat --json "TitleBar" -n 3
```

### 2. Full-Text Search (`-t`, `--text`)
Search the actual content of indexed source files, scripts, markdown documents, and configs:
```bash
lat -t "performSave"
lat -t "useExplorer" --json
```

### 3. Kind Filters (`@kind`)
Filter search queries by file category:
- `@code`: Source code files (`.ts`, `.tsx`, `.rs`, `.py`, `.js`, `.css`, etc.)
- `@doc` / `@document`: Text & documentation (`.md`, `.txt`, `.pdf`, `.json`, etc.)
- `@folder` / `@dir`: Directories
- `@image` / `@img`: Images (`.png`, `.jpg`, `.svg`, `.webp`, `.gif`)
- `@audio`: Audio tracks (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`)
- `@video`: Video files (`.mp4`, `.mkv`, `.mov`)
- `@archive`: Compressed archives (`.zip`, `.tar.gz`, `.7z`, `.rar`)

```bash
lat "@code useExplorer"
lat "@image logo"
lat "@doc guide"
```

*Note: For unindexed media categories (e.g. `@image`, `@audio`), `lat` automatically executes a gitignore-aware walk of the current workspace directory.*

---

## Interacting with the Lattice GUI (`-o` and `-r`)

Agents can interactively show files and directories to the user in the desktop app:

### Open Target (`-o`, `--open`)
- **Folders:** Opens directly in an active or new Lattice tab.
- **Files:** Launches in the user's OS default application.
```bash
lat -o "D:\dev\lattice\app"
lat -o "useExplorer.ts"
```

### Reveal Target (`-r`, `--reveal`)
- Locates the file/folder in Lattice, focuses the main window, and highlights the item in the explorer view:
```bash
lat -r "app\src\components\TextEditor.tsx"
lat -r "CHANGELOG.md"
```

---

## Agent Scripting & JSON Recipes

Always supply `--json` (`-j`) when querying programmatically.

### JSON Output Schema
```json
[
  {
    "path": "D:\\dev\\lattice\\app\\src\\hooks\\useExplorer.ts",
    "name": "useExplorer.ts",
    "dir": "D:\\dev\\lattice\\app\\src\\hooks",
    "is_dir": false,
    "score": 4.2,
    "snippet": "..."
  }
]
```

### Process Exit Codes
- `0`: Success — matches found or action executed cleanly.
- `1`: No matches found (query executed without error).
- `2`: Error (missing file, invalid arguments, or inaccessible path).

### Bash / PowerShell Patterns

#### 1. Find and Reveal in GUI
```bash
# Locate file path and reveal in Lattice GUI
target=$(lat --json "@code TextEditor" -n 1 | jq -r '.[0].path')
if [ -n "$target" ] && [ "$target" != "null" ]; then
  lat -r "$target"
fi
```

#### 2. Verify File Existence & Preview First 50 Lines
```bash
lat -p "app/src/components/TitleBar.tsx"
```

---

## Spotlight Prefixes

The CLI supports the same interactive prefixes as Lattice Spotlight:
- `= <expr>`: Math evaluator (e.g. `lat "= (1024 * 1024) / 8"`)
- `> <app>`: Launch desktop application (e.g. `lat "> vscode"`)
- `? <query>`: Browser web search (e.g. `lat "? rust lifetimes"`)
