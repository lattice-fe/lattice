import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { Note } from "../lib/keep/types";
import { REMINDER_SHOW_EVENT, REMINDER_ACTION_EVENT, ReminderAction } from "../lib/keep/reminders";
import { NOTE_COLORS } from "./KeepCanvas";

const WIN_W = 360, WIN_H = 150; // logical size, matches tauri.conf.json
const AUTO_HIDE_MS = 7000;

const strongOf = (note: Note) => NOTE_COLORS.find((c) => c.id === note.color)?.strong || "var(--terracotta)";

// Standalone toast window (label "reminder"): stays hidden until the main
// window emits a due reminder, then reveals itself at the bottom-right corner.
export function ReminderToast() {
  const [queue, setQueue] = useState<Note[]>([]);
  const current = queue[0] || null;
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = () => setQueue((q) => q.slice(1));
  const act = (action: ReminderAction["action"]) => {
    if (current) emit(REMINDER_ACTION_EVENT, { id: current.id, action } as ReminderAction).catch(() => {});
    dismiss();
  };

  // Enqueue notes as they come due.
  useEffect(() => {
    const un = listen<Note>(REMINDER_SHOW_EVENT, (e) => { if (e.payload) setQueue((q) => [...q, e.payload]); });
    return () => { un.then((f) => f()); };
  }, []);

  // Reveal + position when something's queued; hide when the queue drains.
  useEffect(() => {
    const win = getCurrentWindow();
    if (!current) { win.hide().catch(() => {}); return; }
    (async () => {
      // Position best-effort, but NEVER let a positioning failure stop the
      // window from showing (that would look like "the reminder never fired").
      try {
        const mon = await currentMonitor();
        if (mon) {
          const sf = mon.scaleFactor;
          const margin = Math.round(18 * sf);
          const taskbar = Math.round(48 * sf); // clear the Windows taskbar
          const x = mon.position.x + mon.size.width - Math.round(WIN_W * sf) - margin;
          const y = mon.position.y + mon.size.height - Math.round(WIN_H * sf) - margin - taskbar;
          await win.setPosition(new PhysicalPosition(x, y));
        }
      } catch { /* couldn't read monitor / set position — show anyway */ }
      try { await win.show(); } catch { /* not tauri */ }
    })();
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => clearTimeout(hideTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  const strong = strongOf(current);
  const preview = current.type === "checklist"
    ? (current.items || []).slice(0, 2).map((it) => it.text).filter(Boolean).join(" · ")
    : current.content;

  return (
    // Clicking anywhere on the toast (except a button) opens the note in Keep.
    <div key={current.id} className="reminder-toast" onClick={() => act("open")} title="Open in Keep">
      <div className="reminder-toast-head">
        <span className="reminder-bell" style={{ color: strong }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <span className="reminder-title">{current.title || "Reminder"}</span>
        <button className="reminder-x" onClick={(e) => { e.stopPropagation(); act("done"); }} title="Dismiss">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {preview && <div className="reminder-body">{preview.length > 120 ? preview.slice(0, 120) + "…" : preview}</div>}
      <div className="reminder-actions" onClick={(e) => e.stopPropagation()}>
        <button className="reminder-btn" onClick={() => act("open")}>Open</button>
        <button className="reminder-btn" onClick={() => act("snooze")}>Snooze 10m</button>
        <button className="reminder-btn primary" style={{ background: strong, borderColor: strong }} onClick={() => act("done")}>Done</button>
      </div>
      {/* Depletes over AUTO_HIDE_MS, then the window hides itself. */}
      <div className="reminder-progress">
        <div className="reminder-progress-bar" style={{ animationDuration: `${AUTO_HIDE_MS}ms`, background: strong }} />
      </div>
    </div>
  );
}
