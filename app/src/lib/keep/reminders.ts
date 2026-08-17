import { emit } from "@tauri-apps/api/event";
import { isTauri } from "../api";
import { getNotes, updateNote } from "./store";
import { Note } from "./types";

// main → reminder window: "here's a note that just came due, show it"
export const REMINDER_SHOW_EVENT = "reminder:show";
// reminder window → main: user pressed Done / Snooze / Open on the toast
export const REMINDER_ACTION_EVENT = "reminder:action";
// main → keep view: open the editor for this note id
export const REMINDER_OPEN_EVENT = "reminder:open-note";

export const SNOOZE_MS = 10 * 60 * 1000; // Snooze = +10 minutes

export interface ReminderAction {
  id: string;
  action: "done" | "snooze" | "open";
}

// Notes whose reminder time has passed but haven't fired yet.
export function dueReminders(notes: Note[], now = Date.now()): Note[] {
  return notes.filter((n) => typeof n.remindAt === "number" && !n.reminderDone && n.remindAt <= now);
}

// Fire any newly-due reminders: mark them done (so they don't re-fire on the
// next tick or after a restart) and emit them to the toast window. Runs on an
// interval in the main window only.
export async function checkDueReminders(now = Date.now()): Promise<void> {
  for (const n of dueReminders(getNotes(), now)) {
    // Emit first; only mark fired once the toast window has been told. If the
    // emit throws, leave it un-fired so the next tick retries instead of losing it.
    if (isTauri) {
      try { await emit(REMINDER_SHOW_EVENT, { ...n, reminderDone: true }); }
      catch { continue; }
    }
    updateNote(n.id, { reminderDone: true });
  }
}

export function formatRemindAt(ts: number): string {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// epoch ms → value for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local).
export function tsToLocalInput(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local value → epoch ms (parsed as local time), or undefined if blank.
export function localInputToTs(v: string): number | undefined {
  if (!v) return undefined;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

// ---- self-check (run with: npx tsx src/lib/keep/reminders.ts) ----
declare const require: any;
declare const module: any;
if (typeof require !== "undefined" && require.main === module) {
  const now = 1_000_000;
  const notes = [
    { id: "a", remindAt: now - 1 } as Note,             // due
    { id: "b", remindAt: now + 1 } as Note,             // future
    { id: "c", remindAt: now - 1, reminderDone: true } as Note, // already fired
    { id: "d" } as Note,                                // no reminder
  ];
  const due = dueReminders(notes, now).map((n) => n.id);
  console.assert(JSON.stringify(due) === JSON.stringify(["a"]), "dueReminders", due);
  const rt = tsToLocalInput(localInputToTs("2026-08-18T09:30"));
  console.assert(rt === "2026-08-18T09:30", "roundtrip", rt);
  console.assert(localInputToTs("") === undefined, "blank");
  console.log("reminders self-check ok");
}
