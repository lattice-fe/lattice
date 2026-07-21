import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, updated_at_col, uuid_pk

DOCUMENT_STATUSES = (
    "pending",
    "parsing",
    "parsed",
    "chunking",
    "chunked",
    "embedding",
    "embedded",
    "summarizing",
    "ready",
    "failed",
    "unsupported",
)


class Document(Base):
    """One logical document per (scope, source, external_ref). Idempotency and
    change tracking live on DocumentVersion via content_hash."""

    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("scope_id", "source_id", "external_ref", name="uq_documents_scope_source_ref"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"))
    source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sources.id"), nullable=True)
    external_ref: Mapped[str] = mapped_column(String(2048))
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_extension: Mapped[str | None] = mapped_column(String(32), nullable=True)
    latest_version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("document_versions.id", use_alter=True, name="fk_documents_latest_version"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)


class DocumentVersion(Base):
    """A specific content snapshot of a document, keyed by sha256 content_hash.
    Drives idempotency (re-scans of unchanged files are no-ops) and summary
    invalidation (a summary is stale if its content_hash no longer matches)."""

    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "content_hash", name="uq_document_versions_doc_hash"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("documents.id"))
    version_number: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(String(64))  # sha256 hex digest
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    storage_uri: Mapped[str] = mapped_column(String(2048))
    parser_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    parser_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    parsed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # Tabular schema summary (columns/dtypes/null-rates/samples) for xlsx/csv.
    # Null for text-kind documents.
    structured_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = created_at_col()
