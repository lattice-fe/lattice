import { Entry } from "./api";

export type SortCol = "name" | "modified" | "size";
export type SortDir = "asc" | "desc";
export interface Sort { col: SortCol; dir: SortDir; }

export const TEMPORAL_LABELS = [
  "Today",
  "Yesterday",
  "Earlier this week",
  "Last week",
  "Earlier this month",
  "Earlier this year",
  "A long time ago",
];

export function getTemporalBucket(modifiedSecs?: number | null): number {
  if (!modifiedSecs) return 6;
  const ms = modifiedSecs > 1e11 ? modifiedSecs : modifiedSecs * 1000;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;
  const yesterdayStart = todayStart - dayMs;
  const dayOfWeek = (now.getDay() + 6) % 7;
  const weekStart = todayStart - dayOfWeek * dayMs;
  const lastWeekStart = weekStart - 7 * dayMs;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

  if (ms >= todayStart) return 0;
  if (ms >= yesterdayStart) return 1;
  if (ms >= weekStart) return 2;
  if (ms >= lastWeekStart) return 3;
  if (ms >= monthStart) return 4;
  if (ms >= yearStart) return 5;
  return 6;
}

export function sortEntries(entries: Entry[], sort: Sort, isDownloads: boolean = false): Entry[] {
  const s = [...entries];
  const dir = sort.dir === "asc" ? 1 : -1;
  s.sort((a, b) => {
    if (isDownloads) {
      // Group by temporal category for Downloads
      const bucketA = getTemporalBucket(a.modified ?? 0);
      const bucketB = getTemporalBucket(b.modified ?? 0);
      if (bucketA !== bucketB) return bucketA - bucketB;
    } else {
      // Standard folders-first sorting for normal directories
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    }

    let cmp = 0;
    if (sort.col === "name") {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    } else if (sort.col === "modified") {
      cmp = (b.modified ?? 0) - (a.modified ?? 0);
    } else {
      cmp = a.size - b.size;
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return cmp * dir;
  });
  return s;
}
