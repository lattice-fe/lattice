# Contributing to Lattice

Thanks for wanting to help. Lattice is a passion project and a friendly one —
issues, ideas, and PRs are all welcome.

## License & the (lack of) CLA

Lattice is [AGPL-3.0](LICENSE). There is **no CLA**: by opening a pull request
you agree your contribution is licensed under AGPL-3.0, same as the rest of the
project (inbound = outbound). That's it — no paperwork, and the code stays a
commons.

## Prerequisites

- [Rust](https://rustup.rs) 1.77+
- Node 18+
- The [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your OS

## Running it

Everything lives under `app/`:

```bash
cd app
npm install
npm run tauri dev      # full app (Rust backend + webview)
```

**Fast frontend loop:** `npm run dev` runs just the Vite frontend in your
browser. The Tauri bridge (`src/lib/api.ts`) falls back to mock data when it
isn't running inside Tauri, so you can iterate on UI without a Rust rebuild.
Anything that needs the real backend (search, file ops, the terminal) needs
`npm run tauri dev`.

Before opening a PR:

```bash
cd app
npx tsc --noEmit -p tsconfig.json     # typecheck
cd src-tauri && cargo check           # backend
```

## Project layout

```
app/
├── src/                      # React 19 + TypeScript frontend
│   ├── main.tsx              # entry — one index.html, branched by window label
│   │                         #   (main → App, spotlight → Spotlight, reminder → ReminderToast)
│   ├── components/           # UI (FileList, Inspector, TextEditor, Spotlight,
│   │                         #   KeepCanvas, WatsonChatPane, TerminalPane, …)
│   ├── hooks/                # useExplorer, useSearch, useIndexer, useTheme
│   ├── lib/
│   │   ├── api.ts            # the Tauri bridge (invoke/listen) + browser mock
│   │   ├── assistant/        # Watson: streaming client, config, skills (tools)
│   │   ├── keep/             # notes/reminders store
│   │   ├── theme/            # seed-and-derive theme engine + built-in themes
│   │   └── preview/          # file-preview strategy registry
│   └── lattice.css           # styles + theme CSS variables
└── src-tauri/                # Rust backend
    ├── src/lib.rs            # #[tauri::command]s, setup, event emitting
    ├── src/terminal.rs       # PTY (portable-pty) for the terminal drawer
    ├── src/core/             # fs operations, formatting
    ├── src/cli/, src/bin/    # the `lat` CLI
    └── tauri.conf.json       # windows, bundle, capabilities
```

## How things talk

- **Frontend ↔ backend:** React calls Rust `#[tauri::command]`s via `invoke`
  (wrapped in `lib/api.ts`); Rust pushes updates back with `emit` → the frontend
  `listen`s. Custom commands are added in `lib.rs`'s `generate_handler!`.
- **Extensible by registry:** file previews (`registerPreviewStrategy`), Watson
  tools (`getAllAssistantTools` / `executeAssistantTool`), and themes (plain
  data) are all pluggable in-tree — a good place to add capability without
  touching core.

## Style

Match the surrounding code — this repo favors small, direct changes over
abstraction. Keep diffs focused; one concern per PR. If you're planning
something large, open an issue first so we can talk shape before you build.

## Reporting bugs

Include your OS, what you did, and what happened. A short repro beats a long
description — Lattice is a UI app, so a screenshot or clip helps a lot.
