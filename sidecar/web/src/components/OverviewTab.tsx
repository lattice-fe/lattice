"use client";

import { useState } from "react";
import type { Document, PointerIndex } from "@/lib/api";
import { categoryMeta, displayTitle, relativeTime, typeMeta } from "@/lib/format";
import { Badge, FileChip, TypeChip } from "./Badge";
import { Markdown } from "./Markdown";

export function OverviewTab({
  documents,
  pointerIndex,
  memberCount,
  onOpenDocument,
}: {
  documents: Document[];
  pointerIndex: PointerIndex | undefined;
  memberCount: number;
  onOpenDocument: (id: string) => void;
}) {
  const sorted = [...documents].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  const recent = sorted.slice(0, 5);
  const lastActivity = sorted[0] ? relativeTime(sorted[0].updated_at) : "—";

  const [glanceExpanded, setGlanceExpanded] = useState(false);
  const glanceDocs = glanceExpanded ? documents : documents.slice(0, 4);

  return (
    <div className="flex max-w-[760px] flex-col gap-9">
      <div
        className="flex flex-col gap-3.5 rounded-[10px] border p-6.5"
        style={{ background: "var(--color-surface-card)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-1.75 w-1.75 rounded-full animate-pulse-dot"
            style={{ background: "var(--color-green-ink)" }}
          />
          <span className="text-[11.5px] font-semibold tracking-wider uppercase" style={{ color: "var(--color-dim)" }}>
            Workspace overview
          </span>
          <span className="ml-auto text-[11.5px]" style={{ color: "var(--color-muted)" }}>
            {pointerIndex?.last_consolidated_at ? `Updated ${relativeTime(pointerIndex.last_consolidated_at)}` : "Not generated yet"}
          </span>
        </div>
        <div className="font-serif text-[19px] leading-[1.55]" style={{ color: "var(--color-ink)" }}>
          {pointerIndex?.rollup_text ? (
            <Markdown>{pointerIndex.rollup_text}</Markdown>
          ) : (
            "No overview yet — it will appear once documents finish processing."
          )}
        </div>
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          Regenerates automatically as documents in this workspace change.
        </div>
      </div>

      <div className="flex gap-9">
        <Stat value={documents.length} label="Documents" />
        <Stat value={memberCount} label="Members" />
        <Stat value={lastActivity} label="Since last activity" />
      </div>

      {documents.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <div className="text-[11.5px] font-semibold tracking-wider uppercase" style={{ color: "var(--color-dim)" }}>
              Contents at a glance
            </div>
            {documents.length > 4 && (
              <button
                onClick={() => setGlanceExpanded((v) => !v)}
                className="cursor-pointer text-xs"
                style={{ color: "var(--color-accent)" }}
              >
                {glanceExpanded ? "Show less" : `Show all ${documents.length}`}
              </button>
            )}
          </div>
          {glanceDocs.map((doc) => {
            const t = typeMeta(doc.file_extension);
            const c = categoryMeta(doc.category);
            return (
              <button
                key={doc.id}
                onClick={() => onOpenDocument(doc.id)}
                className="flex cursor-pointer items-center gap-3 border-b py-2.75 text-left"
                style={{ borderColor: "var(--color-border-soft)" }}
              >
                <TypeChip {...t} />
                {c && <Badge label={c.label} bg={c.bg} text={c.text} />}
                <div className="w-[170px] flex-none truncate text-[13.5px] font-semibold">{displayTitle(doc)}</div>
                <FileChip name={doc.external_ref} className="hidden w-[130px] flex-none sm:inline-flex" />
                <div className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--color-dim)" }}>
                  {doc.one_liner ?? ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <div className="mb-2.5 text-[11.5px] font-semibold tracking-wider uppercase" style={{ color: "var(--color-dim)" }}>
          Recently changed
        </div>
        {recent.length === 0 && (
          <div className="py-3 text-sm" style={{ color: "var(--color-muted)" }}>
            Nothing uploaded yet.
          </div>
        )}
        {recent.map((doc) => {
          const t = typeMeta(doc.file_extension);
          return (
            <button
              key={doc.id}
              onClick={() => onOpenDocument(doc.id)}
              className="flex cursor-pointer items-center gap-3 border-b py-3 text-left"
              style={{ borderColor: "var(--color-border-soft)" }}
            >
              <TypeChip {...t} />
              <div className="min-w-0 flex-1 truncate text-sm">{displayTitle(doc)}</div>
              <FileChip name={doc.external_ref} className="max-w-[140px] flex-none" />
              <div className="flex-none text-xs" style={{ color: "var(--color-muted)" }}>
                {relativeTime(doc.updated_at)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-serif text-[26px] font-semibold">{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
        {label}
      </div>
    </div>
  );
}
