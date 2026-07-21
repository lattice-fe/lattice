import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, uuid_pk


class Chunk(Base):
    """A structure-aware slice of a parsed text-kind document. Never populated
    for tabular-kind documents (those live in TabularRow instead)."""

    __tablename__ = "chunks"
    __table_args__ = (
        UniqueConstraint("document_version_id", "chunk_index", name="uq_chunks_version_index"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("documents.id"))
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("document_versions.id")
    )
    # Denormalized from documents.scope_id — defense-in-depth so scope
    # filtering never silently depends on a join being remembered correctly.
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(String)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # heading_path, page, slide, etc. — carried through from the parser/chunker.
    structural_metadata: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    created_at: Mapped[datetime] = created_at_col()


class EmbeddingModel(Base):
    """Catalog of embedding models this deployment has produced vectors with."""

    __tablename__ = "embedding_models"
    __table_args__ = (UniqueConstraint("provider", "model_name", name="uq_embedding_models_provider_name"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    provider: Mapped[str] = mapped_column(String(64))
    model_name: Mapped[str] = mapped_column(String(255))
    dimension: Mapped[int] = mapped_column(Integer)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("0"))
    created_at: Mapped[datetime] = created_at_col()


class ChunkEmbedding(Base):
    """Separate from Chunk so embeddings can be regenerated independently of
    chunk text, and so a migration window can hold two models' vectors for the
    same chunk side by side (see app/providers/embedding.py runbook)."""

    __tablename__ = "chunk_embeddings"
    __table_args__ = (UniqueConstraint("chunk_id", "embedding_model_id", name="uq_chunk_embeddings_chunk_model"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    chunk_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("chunks.id"))
    embedding_model_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("embedding_models.id"))
    # The actual vector lives in the sqlite-vec `chunk_vectors` virtual table
    # (keyed by chunk_id), not here. This row is the embedding's metadata.
    created_at: Mapped[datetime] = created_at_col()
