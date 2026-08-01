# Lattice — Roadmap

Lattice is a Windows file explorer + local search engine. It's being rewritten
from **iced** (Rust GUI) to **Tauri v2** (Rust backend + React/TypeScript
frontend) for a slicker, more inviting UI.

- **Active branch:** `tauri-rewrite`
- **Frozen:** the iced app stays shippable on `master` until cutover, then is archived.
- **App location:** `app/` (Rust backend in `app/src-tauri/`, frontend in `app/src/`).
- **Shared index DB:** `%LOCALAPPDATA%\Lattice\index.db` (SQLite + FTS5 + sqlite-vec).

**Product thesis:** high-performance *and* inviting — not "find your file and get out."

Legend: ✅ done · 🚧 in progress · ⬜ planned · ❄️ deferred

---

## Done

### Phase 0 — Foundation ✅
Branch created; `prototype-tauri/` → `app/`; UI-agnostic Rust core (`fs`, `sort`,
`format`, later `index`) copied to `app/src-tauri/src/core/`. Brand app icons,
1200×800 window. Compiles clean.

### Phase 1 — File-explorer parity ✅
Navigation (back/forward/breadcrumb/history), multi-select (click/ctrl/shift),
column sort, list/grid views, context menus, inline rename, copy/move/delete
(→ trash), open/reveal, drives + quick-access sidebar. Robust double-click via
timestamp ref. React hooks architecture (`useExplorer`) + component split.

### Phase 2 — Search + indexing ✅
Index worker in the backend (single thread owning the DB + embedding model),
three modes (name / text / semantic), collections management. rusqlite (bundled)
+ FTS5 + sqlite-vec (vec0) + fastembed (all-MiniLM-L6-v2) + pdf-extract. Worker
events forwarded to the frontend as `index:*` events. Bottom indexing toast.

### Phase 3 — Spotlight + tray + settings ✅
- **3a:** Alt+Space global shortcut toggles a transparent, always-on-top
  Spotlight window; system tray (Show/Quit); close-to-tray.
- **3b:** Settings modal — show-hidden toggle + indexed-folders manager
  (semantic on/off, reindex, remove).

### Spotlight upgrades ✅
Auto-resize (compact → grows with results), app launching (enumerates Start
Menu `.lnk`), arrow-key nav, and **prefixes**: `>` apps · `@` files/folders ·
`?` web (Google) · `=` math · `/` commands.

### Phase 6 — Directories in search ✅
Sub-dirs indexed as `files` rows with `is_dir=1`; name search ranks folders
first; folder results navigate into the folder. Weighted, tokenized name-search
ranking (exact basename / component / directory bonus / recency / depth).

### Indexing performance fixes ✅
- **delete_collection** was O(n²) (per-chunk FTS delete full-scanned the
  `chunk_id UNINDEXED` column) → fixed with a single subquery delete.
- **Re-index hang** — same root cause on the per-file `clear_file_chunks` path.
  Permanent fix: re-key `chunk_fts` on **`rowid = chunk_id`** so all FTS deletes
  are O(1); `migrate()` rebuilds an existing DB in place (no reindex needed).
  Re-index 3000 files: >200s (hung) → ~5s.

### Phase 7 — Hover preview ✅
Resting the pointer ~550ms on a file pops a floating, cursor-anchored,
non-interactive pane with a gist of the file. Built on a **modular preview
registry** — `registerPreviewStrategy({ match, load, render })`, first match
wins — so file types are extensible without touching the core. Built-ins:
- **Markdown** — rendered via react-markdown.
- **Images** — shown via the Tauri asset protocol (no bytes over IPC).
- **Code / text** — syntax-highlighted head via highlight.js, themed to the
  Ink palette. Markdown code fences highlight via rehype-highlight.

Backend `preview_file` reads ≤16KB off the head, rejects binary (NUL sniff),
caps ~60 lines / 3000 chars.

---

## Planned

### Phase 4 — RAG "Open with Index" ⬜ (deferred by choice)
Port the `rag` sidecar spawn/lifecycle + deferred-index modal. Opportunity to
unify with the sidecar's Next.js UI. **Skipped for now** at the user's request.

### Phase 5 — Packaging + cutover ⬜
- Tauri bundler (MSI / NSIS installers).
- Freeze the Python sidecar (PyInstaller) if RAG ships.
- Cutover: retire the iced `src/`, merge `tauri-rewrite` → `master`, archive iced.
- The "ship it" milestone — best once the feature set feels complete.

### Phase 8 — Tabs ✅
Browser-style tabs in the explorer, each with its own navigation stack
(history / path). `useExplorer` refactored to a per-tab model (selection,
entries and view prefs follow the active tab). TabBar strip with new (+) and
close (×), keep-at-least-one. Open in new tab via context menu or middle-click
a folder; keyboard: Ctrl+T new, Ctrl+W close, Ctrl+Tab / Ctrl+Shift+Tab cycle.
New tabs open at the current location.

### Phase 9 — Rich file previews / code viewer ⬜
Full previews in the inspector pane (large images, text, markdown,
spreadsheets) and a proper code viewer. **This is where tree-sitter earns its
keep** — do it once in the Rust backend for semantic highlighting, symbol
outlines, and code-aware features, reusable app-wide (overkill for the hover
tooltip, right investment here).

### Phase 10 — Settings redesign ⬜
Replace the single Settings modal with a **VSCode-style categorized layout** —
a side pane of sections (e.g. General, Appearance, Indexing, Search, Advanced)
with the detail on the right. Sketch the information architecture first, then
build. This is the home for a growing, discoverable set of options — and the
host for the theme picker from Phase 11.

### Phase 11 — Theming & custom themes ⬜
- **Light mode** — the first alternate to the dark "Ink" palette. Prerequisite:
  audit hard-coded colors so everything flows through CSS variables / tokens.
- **Theme system** — palettes as swappable data (tokens), not code, selected
  from the Appearance pane (Phase 10).
- **Bring-your-own themes** — let users supply and share their own palettes.
- **Spotlight acrylic / mica blur** — native Windows `windowEffects` for a true
  frosted-desktop backdrop (CSS blur doesn't blur the desktop). Deferred here to
  land alongside the theming work rather than as a one-off.

### Phase 12 — Multi-window & drag-and-drop ⬜
Viability notes (Tauri v2), easiest → hardest:
- **New window (Ctrl+N)** — spawn additional explorer windows. **Easy / low
  risk**: multi-window is already in use (main + spotlight); each window runs its
  own explorer state, backend + index DB are shared. Just a builder + command.
- **File drag-drop** — dropping files onto a Lattice window (from Explorer,
  other apps, or another Lattice window) via Tauri's native drag-drop events →
  copy/move. Dropping *in* is well-supported; dragging files *out* of the webview
  needs a native-drag plugin (e.g. `tauri-plugin-drag`). **Medium.**
- **Tab tear-out** — drag a tab out to spawn its own window (seeded with that
  tab's history), and drag a tab between windows. **Viable but fiddliest**:
  separate OS windows have separate webviews, so HTML5 drag can't cross them —
  synthesize it via pointer tracking + a backend "spawn window with state"
  command + close-source. State transfer is trivial (a tab is just
  `{history, hi}` — already serializable thanks to the Phase 8 refactor); the
  drag interaction is the real work. **Medium-hard.**

---

## Smaller enhancements

- **`?` prefix — open full URLs directly** ✅ — a full URL / `www.` / domain+path /
  bare domain with a known TLD opens in the browser; everything else (incl.
  `node.js`, dotted search terms) still Google-searches.
- **Remove drive size indicator** ✅ — dropped the sidebar storage meter (it was a
  hardcoded placeholder).
- **Spotlight scrollbar** ⬜ — style it to match the main app's scrollbar (visual
  consistency between the two windows).
- **Pin folders to Quick Access** ⬜ — let users pin arbitrary folders into the
  sidebar's Quick Access list.
- **Folder hover preview** ⬜ (design TBD) — folders should get a hover preview
  too. Open question on *what* to show: leaning **away** from a bare file count
  (feels distracting); a peek at the first few child items is a candidate.
- **Usage-frequency ranking** ⬜ — the `w6` weight in the search ranking formula.
  Needs a small opens-counter table so frequently-opened files rank higher.
- **Restart needed for images** 🚧 — the `assetProtocol` config change requires a
  `tauri dev` restart to take effect; then verify `.png/.jpg` hover previews.

---

## Deferred polish ❄️

- Persist sidebar collapse to localStorage.
- Small niceties parked for the final polish pass.

_(Light mode graduated from here to Phase 11 — it's now planned work, not deferred.)_
