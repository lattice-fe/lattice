import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Spotlight } from "./components/Spotlight";
import { ReminderToast } from "./components/ReminderToast";
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

// Which window are we? Both spotlight and reminder are chromeless overlay
// windows that reuse this same entry (dev override via ?spotlight / ?reminder).
const params = new URLSearchParams(location.search);
let kind: "main" | "spotlight" | "reminder" = params.has("reminder") ? "reminder" : params.has("spotlight") ? "spotlight" : "main";
if (isTauri) {
  try { const l = getCurrentWindow().label; if (l === "spotlight" || l === "reminder") kind = l; } catch { /* not tauri */ }
}
const chromeless = kind !== "main";
if (chromeless) {
  const splash = document.getElementById("app-splash");
  if (splash) splash.remove();
  document.documentElement.classList.add("is-spotlight");
  document.body.classList.add("is-spotlight");
  document.documentElement.style.background = "transparent";
  document.documentElement.style.backgroundColor = "transparent";
  document.body.style.background = "transparent";
  document.body.style.backgroundColor = "transparent";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{kind === "spotlight" ? <Spotlight /> : kind === "reminder" ? <ReminderToast /> : <App />}</React.StrictMode>,
);
