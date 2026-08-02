import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Spotlight } from "./components/Spotlight";
import { isTauri } from "./lib/api";
import { applyTheme } from "./lib/theme/engine";
import { initialTheme, THEME_EVENT } from "./hooks/useTheme";
import type { Theme } from "./lib/theme/types";

// Apply the persisted theme before first paint (both windows) to avoid a flash.
applyTheme(initialTheme());

// Keep every window (main + spotlight) in sync when the theme changes. The
// event carries the full theme, so custom themes propagate too.
if (isTauri) {
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<Theme>(THEME_EVENT, (e) => { if (e.payload) applyTheme(e.payload); });
  });
}

// The Spotlight window loads the same bundle; branch on the window label so it
// renders only the launcher (never the full explorer).
let spotlight = new URLSearchParams(location.search).has("spotlight"); // dev override
if (isTauri) {
  try { spotlight = getCurrentWindow().label === "spotlight"; } catch { /* not tauri */ }
}
if (spotlight) document.body.classList.add("is-spotlight");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{spotlight ? <Spotlight /> : <App />}</React.StrictMode>,
);
