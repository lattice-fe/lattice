import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Spotlight } from "./components/Spotlight";
import { isTauri } from "./lib/api";

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
