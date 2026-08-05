import { ReactNode } from "react";
import { Entry } from "../api";

// A preview strategy knows how to (a) decide it applies to an entry, (b) load
// whatever data it needs, and (c) render that data into the hover pane. New
// file types are added by registering a strategy — nothing else changes.
export interface PreviewStrategy<T = unknown> {
  id: string;
  /** Whether this strategy can preview the given entry. */
  match: (e: Entry) => boolean;
  /** Fetch the preview payload (text, an image URL, …). May throw to bail. */
  load: (e: Entry) => Promise<T>;
  /** Render the loaded payload. Must be side-effect free (no hooks). */
  render: (data: T) => ReactNode;
  /** If true, this strategy will not trigger floating hover previews. */
  disableHover?: boolean;
  /** If true, this strategy will not render inside the side-pane Inspector preview. */
  disableInspector?: boolean;
}

const strategies: PreviewStrategy[] = [];

/**
 * Register a preview strategy. Strategies are tried in registration order and
 * the first match wins, so register more specific ones first (or use
 * `prepend` to jump the queue ahead of the built-ins).
 */
export function registerPreviewStrategy<T>(s: PreviewStrategy<T>, opts?: { prepend?: boolean }) {
  if (opts?.prepend) strategies.unshift(s as PreviewStrategy);
  else strategies.push(s as PreviewStrategy);
}

/** First strategy that claims this entry, or null if none preview it. */
export function pickStrategy(e: Entry): PreviewStrategy | null {
  return strategies.find((s) => s.match(e)) ?? null;
}

/** Lowercased extension without the dot ("" if none). */
export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Build a `match` that accepts non-dir entries with one of the given exts. */
export function byExt(...exts: string[]): (e: Entry) => boolean {
  const set = new Set(exts.map((x) => x.toLowerCase()));
  return (e: Entry) => !e.is_dir && set.has(extOf(e.name));
}
