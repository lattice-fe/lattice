"use client";

import { useRef } from "react";
import type { Document } from "@/lib/api";
import { displayTitle, relativeTime, statusMeta, typeMeta } from "@/lib/format";
import { Badge, FileChip, TypeChip } from "./Badge";
import { useUploadDocument } from "@/lib/queries";

export function DocumentsTab({
  scopeId,
  documents,
  onOpenDocument,
}: {
  scopeId: string;
  documents: Document[];
  onOpenDocument: (id: string) => void;
}) {
  const sorted = [...documents].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  const upload = useUploadDocument(scopeId);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload.mutateAsync(file);
    }
  }

  return (
    <div className="flex max-w-[920px] flex-col">
      <div className="mb-4.5 flex items-baseline justify-between">
        <div className="font-serif text-[22px] font-semibold">Documents</div>
        <div className="flex items-center gap-4">
          <div className="text-[12.5px]" style={{ color: "var(--color-muted)" }}>
            {documents.length} · sorted by recently updated
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="cursor-pointer rounded-md border px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-accent-ink)" }}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="flex flex-col">
        {sorted.length === 0 && (
          <div className="py-6 text-sm" style={{ color: "var(--color-muted)" }}>
            No documents yet — upload something to get started.
          </div>
        )}
        {sorted.map((doc) => {
          const t = typeMeta(doc.file_extension);
          const s = statusMeta(doc.status);
          return (
            <button
              key={doc.id}
              onClick={() => onOpenDocument(doc.id)}
              className="flex cursor-pointer items-center gap-4 border-b py-3.5 text-left"
              style={{ borderColor: "var(--color-border-soft)" }}
            >
              <TypeChip {...t} />
              <div className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{displayTitle(doc)}</div>
              <FileChip name={doc.external_ref} className="max-w-[160px] flex-none" />
              <Badge {...s} />
              <div className="w-20 flex-none text-right text-[12.5px]" style={{ color: "var(--color-muted)" }}>
                {relativeTime(doc.updated_at)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
