import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { isTauri } from "../lib/api";

// Pull a couple of live theme tokens so the terminal matches the app.
function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback;
  return {
    background: v("--ink", "#1a1815"),
    foreground: v("--paper", "#f4eee2"),
    cursor: v("--terracotta", "#c05f3c"),
    selectionBackground: v("--card-hi", "#3a352d"),
  };
}

// One xterm terminal bound to a backend PTY session. Spawns once with the cwd
// captured at mount — navigating folders afterward doesn't move the shell.
export function TerminalPane({ cwd }: { cwd: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cwdRef = useRef(cwd);

  useEffect(() => {
    if (!isTauri || !hostRef.current) return;
    const host = hostRef.current;
    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: themeColors(),
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try { fit.fit(); } catch { /* not laid out yet */ }

    let id: number | null = null;
    const cleanups: Array<() => void> = [];
    let disposed = false;

    (async () => {
      try {
        const spawned = await invoke<number>("terminal_spawn", { cwd: cwdRef.current, cols: term.cols, rows: term.rows });
        if (disposed) { invoke("terminal_kill", { id: spawned }).catch(() => {}); return; }
        id = spawned;
        cleanups.push(await listen<string>(`terminal:data:${id}`, (e) => term.write(e.payload)));
        cleanups.push(await listen(`terminal:exit:${id}`, () => term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n")));
        term.onData((d) => { if (id != null) invoke("terminal_write", { id, data: d }).catch(() => {}); });
      } catch (err) {
        term.write(`\r\n\x1b[31mFailed to start terminal: ${String(err)}\x1b[0m\r\n`);
      }
    })();

    const ro = new ResizeObserver(() => {
      try { fit.fit(); } catch { /* ignore */ }
      if (id != null) invoke("terminal_resize", { id, cols: term.cols, rows: term.rows }).catch(() => {});
    });
    ro.observe(host);
    setTimeout(() => term.focus(), 0);

    return () => {
      disposed = true;
      ro.disconnect();
      cleanups.forEach((f) => f());
      if (id != null) invoke("terminal_kill", { id }).catch(() => {});
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="terminal-host" ref={hostRef} />;
}
