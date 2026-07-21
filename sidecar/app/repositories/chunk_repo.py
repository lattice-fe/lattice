import uuid
from dataclasses import dataclass

import sqlite_vec
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.models.chunks import Chunk, ChunkEmbedding, EmbeddingModel
from app.permissions.checks import require_scope_access


def _delete_vectors(db: Session, chunk_ids: list[uuid.UUID]) -> None:
    """Remove rows from the sqlite-vec `chunk_vectors` table for these chunks."""
    for chunk_id in chunk_ids:
        db.execute(
            text("DELETE FROM chunk_vectors WHERE chunk_id = :cid"),
            {"cid": str(chunk_id)},
        )


def get_or_create_embedding_model(db: Session, provider: str, model_name: str, dimension: int) -> EmbeddingModel:
    existing = db.execute(
        select(EmbeddingModel).where(EmbeddingModel.provider == provider, EmbeddingModel.model_name == model_name)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    row = EmbeddingModel(provider=provider, model_name=model_name, dimension=dimension)
    db.add(row)
    db.flush()
    return row


@dataclass
class NewChunk:
    chunk_index: int
    content: str
    token_count: int | None
    structural_metadata: dict


def replace_chunks(
    db: Session,
    scope_id: uuid.UUID,
    document_id: uuid.UUID,
    document_version_id: uuid.UUID,
    new_chunks: list[NewChunk],
) -> list[Chunk]:
    """Idempotent on retry: deletes any existing chunks for this version
    before inserting. Runs as a pipeline stage under SYSTEM_PRINCIPAL, so no
    principal_id/ACL check here — scope_id still comes explicitly from the
    calling job's payload, so scoping itself is never bypassed."""
    # Clear prior chunks (and their embeddings/vectors) for this version first,
    # so re-runs are idempotent and FK constraints aren't violated.
    existing_ids = db.execute(
        select(Chunk.id).where(Chunk.document_version_id == document_version_id)
    ).scalars().all()
    if existing_ids:
        _delete_vectors(db, list(existing_ids))
        db.execute(delete(ChunkEmbedding).where(ChunkEmbedding.chunk_id.in_(existing_ids)))
    db.execute(delete(Chunk).where(Chunk.document_version_id == document_version_id))
    rows = [
        Chunk(
            document_id=document_id,
            document_version_id=document_version_id,
            scope_id=scope_id,
            chunk_index=c.chunk_index,
            content=c.content,
            token_count=c.token_count,
            structural_metadata=c.structural_metadata,
        )
        for c in new_chunks
    ]
    db.add_all(rows)
    db.flush()
    return rows


def upsert_embeddings(
    db: Session, embedding_model_id: uuid.UUID, chunk_vectors: list[tuple[uuid.UUID, list[float]]]
) -> None:
    """(Re)write embeddings for these chunks: an ORM metadata row in
    `chunk_embeddings` plus the actual vector in the sqlite-vec `chunk_vectors`
    virtual table (keyed by chunk_id, with scope_id/model as filter metadata)."""
    if not chunk_vectors:
        return
    chunk_ids = [chunk_id for chunk_id, _ in chunk_vectors]

    # Idempotent: clear any prior embeddings for these chunks + this model.
    db.execute(
        delete(ChunkEmbedding).where(
            ChunkEmbedding.chunk_id.in_(chunk_ids),
            ChunkEmbedding.embedding_model_id == embedding_model_id,
        )
    )
    _delete_vectors(db, chunk_ids)

    db.add_all(
        [ChunkEmbedding(chunk_id=chunk_id, embedding_model_id=embedding_model_id) for chunk_id in chunk_ids]
    )
    db.flush()

    scope_by_chunk = dict(
        db.execute(select(Chunk.id, Chunk.scope_id).where(Chunk.id.in_(chunk_ids))).all()
    )
    for chunk_id, vector in chunk_vectors:
        db.execute(
            text(
                "INSERT INTO chunk_vectors(chunk_id, scope_id, embedding_model_id, embedding) "
                "VALUES (:cid, :sid, :mid, :emb)"
            ),
            {
                "cid": str(chunk_id),
                "sid": str(scope_by_chunk[chunk_id]),
                "mid": str(embedding_model_id),
                "emb": sqlite_vec.serialize_float32(vector),
            },
        )


def delete_chunks_for_document(db: Session, document_id: uuid.UUID) -> None:
    """Used when a document is soft-deleted (missing on re-scan): chunks and
    their embeddings are regenerable, so they're hard-deleted rather than
    kept around, unlike document_versions/summaries which are retained for
    audit history."""
    chunk_ids = db.execute(select(Chunk.id).where(Chunk.document_id == document_id)).scalars().all()
    if chunk_ids:
        _delete_vectors(db, list(chunk_ids))
        db.execute(delete(ChunkEmbedding).where(ChunkEmbedding.chunk_id.in_(chunk_ids)))
        db.execute(delete(Chunk).where(Chunk.document_id == document_id))


def search_similar_chunks(
    db: Session, scope_id: uuid.UUID, embedding_model_id: uuid.UUID, query_vector: list[float], limit: int = 8
) -> list[tuple[Chunk, float]]:
    """Nearest-neighbor search within a single scope via sqlite-vec KNN, filtered
    by scope_id + embedding_model_id (vec0 metadata columns), then joined back
    to the chunk rows (preserving distance order)."""
    rows = db.execute(
        text(
            "SELECT chunk_id, distance FROM chunk_vectors "
            "WHERE embedding MATCH :q AND scope_id = :sid AND embedding_model_id = :mid AND k = :k "
            "ORDER BY distance"
        ),
        {
            "q": sqlite_vec.serialize_float32(query_vector),
            "sid": str(scope_id),
            "mid": str(embedding_model_id),
            "k": limit,
        },
    ).all()
    if not rows:
        return []

    ordered_ids = [uuid.UUID(row[0]) for row in rows]
    distance_by_id = {uuid.UUID(row[0]): row[1] for row in rows}
    chunks = db.execute(select(Chunk).where(Chunk.id.in_(ordered_ids))).scalars().all()
    chunk_by_id = {chunk.id: chunk for chunk in chunks}
    return [(chunk_by_id[cid], distance_by_id[cid]) for cid in ordered_ids if cid in chunk_by_id]


def list_chunks(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, document_id: uuid.UUID) -> list[Chunk]:
    require_scope_access(db, principal_id, scope_id, "read")
    return list(
        db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id, Chunk.scope_id == scope_id)
            .order_by(Chunk.chunk_index)
        ).scalars()
    )
