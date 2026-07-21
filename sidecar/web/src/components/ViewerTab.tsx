"use client";

import { useDocument, useDocumentChunks } from "@/lib/queries";
import { displayTitle, relativeTime, statusMeta } from "@/lib/format";
import { Badge, FileChip } from "./Badge";
import { Markdown } from "./Markdown";

export function ViewerTab({ scopeId, documentId, scopeName }: { scopeId: string; documentId: string; scopeName: string }) {
  const { data: doc, isLoading: docLoading } = useDocument(scopeId, documentId);
  const { data: chunks, isLoading: chunksLoading } = useDocumentChunks(scopeId, documentId);

  if (docLoading || !doc) {
    return (
      <div className="text-sm" style={{ color: "var(--color-muted)" }}>
        Loading…
      </div>
    );
  }

  const s = statusMeta(doc.status);
  const isTabular = !!doc.structured_data;
  const isPdf = doc.file_extension === ".pdf" || doc.mime_type === "application/pdf";

  return (
    <div className="flex max-w-[1080px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="font-serif text-[26px] font-semibold">{displayTitle(doc)}</div>
        <div className="flex items-center gap-3.5 text-[12.5px]" style={{ color: "var(--color-muted)" }}>
          <FileChip name={doc.external_ref} />
          <span>Updated {relativeTime(doc.updated_at)}</span>
          <Badge {...s} />
        </div>
      </div>

      <div className="flex items-start gap-10">
        <div className="min-w-0 flex-1 flex flex-col gap-4.5">
          {doc.summary_text && (
            <div
              className="rounded-lg border-l-3 px-4 py-3.5 text-[14.5px] leading-[1.7]"
              style={{ background: "var(--color-accent-soft)", borderColor: "var(--color-accent)", color: "var(--color-ink-soft)" }}
            >
              <Markdown>{doc.summary_text}</Markdown>
            </div>
          )}

          {isTabular ? (
            <TabularContent structuredData={doc.structured_data!} />
          ) : isPdf ? (
            <PdfViewer scopeId={scopeId} documentId={documentId} />
          ) : (
            <ChunkContent chunks={chunks} loading={chunksLoading} />
          )}
        </div>

        <div className="w-[280px] flex-none flex flex-col gap-5">
          {!isTabular && chunks && chunks.length > 0 && (
            <div>
              <div className="mb-2.5 text-[11px] font-semibold tracking-wider uppercase" style={{ color: "var(--color-muted)" }}>
                Sections
              </div>
              <div className="flex flex-col gap-2">
                {chunks.map((c) => {
                  const heading = c.structural_metadata.heading_path?.slice(1).join(" › ") || `Section ${c.chunk_index + 1}`;
                  return (
                    <div
                      key={c.chunk_index}
                      className="rounded-lg border px-3 py-2.5 text-[12.5px] leading-[1.5]"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      {heading}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="border-t pt-4 text-[12.5px] leading-[1.6]" style={{ borderColor: "var(--color-border-soft)", color: "var(--color-muted)" }}>
            Visible only to members of {scopeName}.
          </div>
        </div>
      </div>
    </div>
  );
}

function PdfViewer({ scopeId, documentId }: { scopeId: string; documentId: string }) {
  // Served inline, same-origin, by the sidecar's /file endpoint — the browser's
  // built-in PDF viewer renders it (no more mangled extracted text).
  const src = `/scopes/${scopeId}/documents/${documentId}/file`;
  return (
    <iframe
      src={src}
      title="PDF document"
      className="w-full rounded-lg border"
      style={{ height: "78vh", borderColor: "var(--color-border)" }}
    />
  );
}

function ChunkContent({ chunks, loading }: { chunks: { chunk_index: number; content: string; structural_metadata: { heading_path?: string[] } }[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="text-sm" style={{ color: "var(--color-muted)" }}>
        Loading content…
      </div>
    );
  }
  if (!chunks || chunks.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--color-muted)" }}>
        This document hasn&rsquo;t finished processing yet.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4.5 text-[15.5px] leading-[1.75]" style={{ color: "var(--color-ink-soft)" }}>
      {chunks
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map((c) => (
          <Markdown key={c.chunk_index}>{c.content}</Markdown>
        ))}
    </div>
  );
}

function TabularContent({ structuredData }: { structuredData: { sheet_names?: string[]; tables?: { table_name: string; row_count: number; columns: { name: string; dtype: string }[] }[] } }) {
  return (
    <div className="flex flex-col gap-5">
      {structuredData.tables?.map((table) => (
        <div key={table.table_name} className="rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <div className="border-b px-4 py-2.5 text-[13px] font-semibold" style={{ borderColor: "var(--color-border-soft)" }}>
            {table.table_name} · {table.row_count} rows
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {table.columns.map((col) => (
              <span
                key={col.name}
                className="rounded-md px-2.5 py-1 font-mono text-[11.5px]"
                style={{ background: "var(--color-border-soft)", color: "var(--color-ink-soft)" }}
              >
                {col.name} <span style={{ color: "var(--color-muted)" }}>· {col.dtype}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
