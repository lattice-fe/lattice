// Lightweight, local activity log — only events Lattice actually performs
// (edits, searches, opens, folder creation). Persisted to localStorage; no
// filesystem scanning, no fabricated events. Grows as you use the app.

export type ActivityType = "edit" | "search" | "open" | "create";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;   // e.g. "Edited README.md"
  sub?: string;    // e.g. parent dir, or "Semantic · 34 results"
  path?: string;   // file/folder path, used for the icon + click-through
  ts: number;
}

const KEY = "lattice:activity";
const CAP = 200;
export const ACTIVITY_EVENT = "lattice:activity";

export function getActivity(): Activity[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function logActivity(a: Omit<Activity, "id" | "ts">): void {
  try {
    const list = getActivity();
    const now = Date.now();
    // Collapse a repeat of the same event (type+path) within 30s so autosave
    // bursts and re-runs don't flood the feed — just bump the timestamp.
    const last = list[0];
    if (last && last.type === a.type && last.path === a.path && last.title === a.title && now - last.ts < 30_000) {
      last.ts = now;
    } else {
      list.unshift({ ...a, id: `${now}-${Math.random().toString(36).slice(2, 7)}`, ts: now });
    }
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
    window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
  } catch { /* ignore */ }
}

export function clearActivity(): void {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT)); } catch { /* ignore */ }
}

export interface ActivityGroup { label: string; items: Activity[]; }

// Bucket into Today / This Week / Earlier (newest first within each).
export function groupActivity(list: Activity[]): ActivityGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 86_400_000;
  const buckets: Record<string, Activity[]> = { Today: [], "This week": [], Earlier: [] };
  for (const a of list) {
    if (a.ts >= startOfToday) buckets.Today.push(a);
    else if (a.ts >= weekAgo) buckets["This week"].push(a);
    else buckets.Earlier.push(a);
  }
  return ["Today", "This week", "Earlier"]
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0);
}
