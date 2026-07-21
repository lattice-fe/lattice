import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.documents import Document
from app.models.summaries import DocumentSummary, ScopePointerIndex
from app.permissions.checks import require_scope_access


def upsert_document_summary(
    db: Session,
    scope_id: uuid.UUID,
    document_id: uuid.UUID,
    document_version_id: uuid.UUID,
    summary_text: str,
    model_used: str,
    content_hash: str,
    title: str | None = None,
    one_liner: str | None = None,
    category: str | None = None,
) -> DocumentSummary:
    stmt = (
        pg_insert(DocumentSummary)
        .values(
            document_id=document_id,
            document_version_id=document_version_id,
            scope_id=scope_id,
            summary_text=summary_text,
            title=title,
            one_liner=one_liner,
            category=category,
            model_used=model_used,
            content_hash=content_hash,
        )
        .on_conflict_do_update(
            index_elements=[DocumentSummary.document_version_id],
            set_={
                "summary_text": summary_text,
                "title": title,
                "one_liner": one_liner,
                "category": category,
                "model_used": model_used,
                "content_hash": content_hash,
            },
        )
        .returning(DocumentSummary)
    )
    return db.execute(stmt).scalar_one()


def list_summaries_for_scope(db: Session, scope_id: uuid.UUID) -> list[DocumentSummary]:
    """Used by consolidation — reads the current summary set for a scope: one
    row per non-deleted document, matched to that document's *current*
    version specifically (document_summaries keeps one row per version, kept
    around for audit history — a re-summarized edit leaves the prior
    version's row in place rather than replacing it, so without this filter
    an edited document would be double-counted via its stale summary).
    Scoped implicitly by the explicit scope_id from the job payload (no
    principal check: this runs under SYSTEM_PRINCIPAL as a pipeline stage)."""
    return list(
        db.execute(
            select(DocumentSummary)
            .join(Document, Document.id == DocumentSummary.document_id)
            .where(
                DocumentSummary.scope_id == scope_id,
                Document.deleted_at.is_(None),
                DocumentSummary.document_version_id == Document.latest_version_id,
            )
        ).scalars()
    )


def get_summary_for_document_version(db: Session, document_version_id: uuid.UUID) -> DocumentSummary | None:
    return db.execute(
        select(DocumentSummary).where(DocumentSummary.document_version_id == document_version_id)
    ).scalar_one_or_none()


def get_summaries_for_versions(db: Session, document_version_ids: list[uuid.UUID]) -> dict[uuid.UUID, DocumentSummary]:
    """Bulk variant of get_summary_for_document_version, for list endpoints —
    one query instead of N, keyed by document_version_id for easy zipping
    against a document list by each doc's latest_version_id."""
    if not document_version_ids:
        return {}
    rows = db.execute(
        select(DocumentSummary).where(DocumentSummary.document_version_id.in_(document_version_ids))
    ).scalars()
    return {row.document_version_id: row for row in rows}


def count_summaries_since(db: Session, scope_id: uuid.UUID, since: datetime) -> int:
    return len(
        db.execute(
            select(DocumentSummary.id).where(DocumentSummary.scope_id == scope_id, DocumentSummary.created_at > since)
        ).all()
    )


def get_pointer_index(db: Session, scope_id: uuid.UUID) -> ScopePointerIndex | None:
    return db.execute(select(ScopePointerIndex).where(ScopePointerIndex.scope_id == scope_id)).scalar_one_or_none()


def get_pointer_index_scoped(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID) -> ScopePointerIndex | None:
    require_scope_access(db, principal_id, scope_id, "read")
    return get_pointer_index(db, scope_id)


def upsert_pointer_index(
    db: Session, scope_id: uuid.UUID, rollup_text: str, doc_count: int, model_used: str, consolidated_at: datetime
) -> ScopePointerIndex:
    stmt = (
        pg_insert(ScopePointerIndex)
        .values(
            scope_id=scope_id,
            rollup_text=rollup_text,
            doc_count=doc_count,
            model_used=model_used,
            last_consolidated_at=consolidated_at,
        )
        .on_conflict_do_update(
            index_elements=[ScopePointerIndex.scope_id],
            set_={
                "rollup_text": rollup_text,
                "doc_count": doc_count,
                "model_used": model_used,
                "last_consolidated_at": consolidated_at,
            },
        )
        .returning(ScopePointerIndex)
    )
    return db.execute(stmt).scalar_one()
