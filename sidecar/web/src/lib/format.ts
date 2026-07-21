import type { Document, DocumentCategory, DocumentStatus } from "./api";

export type BadgeMeta = { label: string; bg: string; text: string; pulse: boolean };

// title is only set once summarization finishes — falls back to the raw
// filename for documents still being processed.
export function displayTitle(doc: Pick<Document, "title" | "external_ref">): string {
  return doc.title || doc.external_ref;
}

const IN_PROGRESS: DocumentStatus[] = [
  "parsing",
  "parsed",
  "chunking",
  "chunked",
  "embedding",
  "embedded",
  "summarizing",
];

export function statusMeta(status: DocumentStatus): BadgeMeta {
  if (status === "pending") {
    return { label: "Uploaded", bg: "var(--color-border-soft)", text: "var(--color-dim)", pulse: false };
  }
  if (IN_PROGRESS.includes(status)) {
    return { label: "Being read", bg: "var(--color-accent-soft)", text: "var(--color-accent-ink)", pulse: true };
  }
  if (status === "ready") {
    return { label: "Understood", bg: "var(--color-green-soft)", text: "var(--color-green-ink)", pulse: false };
  }
  if (status === "failed") {
    return { label: "Failed", bg: "var(--color-error-soft)", text: "var(--color-error-ink)", pulse: false };
  }
  return { label: "Unsupported", bg: "var(--color-border-soft)", text: "var(--color-dim)", pulse: false };
}

export type TypeMeta = { code: string; bg: string; text: string };

const TABULAR_EXTENSIONS = new Set([".xlsx", ".xlsm", ".csv"]);
const SLIDE_EXTENSIONS = new Set([".pptx"]);

export function typeMeta(extension: string | null): TypeMeta {
  const ext = (extension ?? "").toLowerCase();
  if (TABULAR_EXTENSIONS.has(ext)) {
    return { code: "XLS", bg: "var(--color-green-soft)", text: "var(--color-green-ink)" };
  }
  if (SLIDE_EXTENSIONS.has(ext)) {
    return { code: "PPT", bg: "var(--color-accent-soft)", text: "var(--color-accent-ink)" };
  }
  return { code: "DOC", bg: "var(--color-neutral-soft)", text: "var(--color-neutral-ink)" };
}

export type CategoryMeta = { label: string; bg: string; text: string };

// Mirrors app.constants.CATEGORY_TAXONOMY — keep in sync if that changes.
const CATEGORY_META: Record<DocumentCategory, CategoryMeta> = {
  spec: { label: "Spec", bg: "var(--color-blue-soft)", text: "var(--color-blue-ink)" },
  research: { label: "Research", bg: "var(--color-cyan-soft)", text: "var(--color-cyan-ink)" },
  decision: { label: "Decision", bg: "var(--color-accent-soft)", text: "var(--color-accent-ink)" },
  incident: { label: "Incident", bg: "var(--color-error-soft)", text: "var(--color-error-ink)" },
  notes: { label: "Notes", bg: "var(--color-border-soft)", text: "var(--color-dim)" },
  data: { label: "Data", bg: "var(--color-green-soft)", text: "var(--color-green-ink)" },
};

export function categoryMeta(category: DocumentCategory | null): CategoryMeta | null {
  return category ? (CATEGORY_META[category] ?? null) : null;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function initials(name: string): string {
  const parts = name.split(/[@.\s]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
