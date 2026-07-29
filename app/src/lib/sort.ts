import { Entry } from "./api";

export type SortCol = "name" | "modified" | "size";
export type SortDir = "asc" | "desc";
export interface Sort { col: SortCol; dir: SortDir; }

// Folders always first; then the chosen column. Name is the tiebreaker.
export function sortEntries(entries: Entry[], sort: Sort): Entry[] {
  const s = [...entries];
  const dir = sort.dir === "asc" ? 1 : -1;
  s.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (sort.col === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    else if (sort.col === "modified") cmp = (a.modified ?? 0) - (b.modified ?? 0);
    else cmp = a.size - b.size;
    if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return cmp * dir;
  });
  return s;
}
