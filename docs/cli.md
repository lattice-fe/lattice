# `lat` — the Lattice CLI

A terminal companion for Lattice. It shares the same on-disk index as the
desktop app, so anything you've indexed in the GUI is instantly searchable from
the shell — plus syntax-highlighted previews and open/reveal hand-off back into
the GUI.

It's also designed as an **agent hook**: `--json` output and real process exit
codes let a coding assistant search your files and *reveal* a result in the app
instead of just reciting a path.

Two names are installed for the same binary: **`lat`** (short) and
**`lattice-cli`** (explicit).

---

## Install

The binary ships with the desktop app. To put `lat` on your `PATH`:

```bash
lat --install
```

On Windows this copies `lat.exe` and `lattice-cli.exe` into
`%LOCALAPPDATA%\Microsoft\WindowsApps` (already on `PATH`).

---

## Usage

```
lat [FLAGS] [QUERY / PATH]
```

| Flag | Description |
|------|-------------|
| `<query>` | Filename / path search (default; index-backed, top 5) |
| `-t, --text <q>` | Full-text content search (SQLite FTS5, bm25 ranking) |
| `-s, --semantic <q>` | Semantic search *(currently routes to full-text in the CLI)* |
| `-p, --preview <file>` | Terminal preview with line numbers + syntax colors |
| `-o, --open [index]` | Open a result (files in the default app; folders in Lattice) |
| `-r, --reveal [index]` | Reveal a result inside the Lattice GUI |
| `-n, --limit <count>` | Max results (default 5) |
| `-j, --json` | Machine-readable JSON output (no colors) |
| `--install` | Install `lat` / `lattice-cli` onto the PATH |
| `-h, --help` | Help |

Search is **read-only** — the CLI never writes to the index, so running it
while the GUI is open is safe.

### Spotlight prefixes

The same prefix conventions as the in-app Spotlight:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `=` | Math evaluator (`+ - * / %`, parens) | `lat "= (100 + 450) / 2"` → `275` |
| `@kind` | Kind-filtered search | `lat "@image logo"` |
| `>` | Launch an app | `lat "> vscode"` |
| `?` | Web search in the browser | `lat "? rust lifetimes"` |

### `@kind` filters

`image`/`img`, `code`, `doc`/`document`, `folder`/`dir`, `audio`, `video`,
`archive`. When the index has nothing for a kind (it only stores text/PDF files
and directories), the CLI falls back to a **recursive walk of the current
directory** (respecting `.gitignore`), so `@image` and media kinds still work in
a project.

---

## JSON output (for scripts & agents)

```bash
lat --json "@code useExplorer" -n 3
```

```json
[{"path":"D:\\dev\\lattice\\app\\src\\hooks\\useExplorer.ts","name":"useExplorer.ts","dir":"D:\\dev\\lattice\\app\\src\\hooks","is_dir":false,"score":4.2,"snippet":""}]
```

Fields: `path`, `name`, `dir`, `is_dir`, `score`, `snippet` (text-search only).

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Found results / action succeeded |
| `1` | No matching results |
| `2` | Error (e.g. file not found, invalid math) |

---

## Examples

```bash
lat "main.rs"                 # filename search
lat -t "reconcile"            # full-text content search
lat "@code scan_dir"          # code files matching "scan_dir"
lat "@image" -n 10            # images under the current tree
lat -p README.md              # preview with syntax colors
lat "ROADMAP" -r              # reveal the match in the Lattice GUI
lat "= 256 * 1024"            # → 262144
```

### Agent pattern

```bash
# find, then reveal the top hit in the desktop app
path=$(lat --json "@code useExplorer" -n 1 | jq -r '.[0].path')
lat -r "$path"
```

Because exit codes are honest, an agent can branch on "found vs not found" and
`lat -r <path>` surfaces the answer in the GUI rather than pasting a path.

---

## Notes

- `-s` semantic currently falls back to full-text search in the CLI (the vector
  path is GUI-only for now).
- Non-JSON output uses ANSI colors; use `--json` for clean, parseable output.
