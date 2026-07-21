import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, updated_at_col, uuid_pk


class DocumentSummary(Base):
    """Standalone per-document summary, generated immediately on ingest.
    content_hash mirrors the source document_version's hash, so a stale
    summary (edited doc, not yet re-summarized) is detectable without a join
    to figure out staleness logic."""

    __tablename__ = "document_summaries"
    __table_args__ = (UniqueConstraint("document_version_id", name="uq_document_summaries_version"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("documents.id"))
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("document_versions.id")
    )
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"))
    summary_text: Mapped[str] = mapped_column(String)
    # A human-readable title, a single purpose-written sentence, and a coarse
    # category, all generated alongside summary_text in the same LLM call —
    # not derived from the filename or by truncating summary_text, which
    # both read poorly at a glance. Nullable: rows written before these
    # fields existed, or where the model's structured-output parse fell back
    # to a plain-text summary, won't have them.
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    one_liner: Mapped[str | None] = mapped_column(String(280), nullable=True)
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = created_at_col()


class ScopePointerIndex(Base):
    """The per-scope 'what's in here' rollup. Kept bounded by periodic
    re-consolidation (merge-and-update over document_summaries deltas) rather
    than growing by literal append — see app/pipeline/stages/consolidate.py."""

    __tablename__ = "scope_pointer_index"

    id: Mapped[uuid.UUID] = uuid_pk()
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"), unique=True)
    rollup_text: Mapped[str] = mapped_column(String, default="", server_default="")
    doc_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_consolidated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()
