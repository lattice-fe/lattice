import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.chunks import Chunk
from app.models.documents import Document
from app.models.jobs import Job
from app.providers.factory import get_embedding_provider
from app.repositories import chunk_repo, job_repo


def run(db: Session, job: Job) -> None:
    document_id = uuid.UUID(job.payload["document_id"])
    document_version_id = uuid.UUID(job.payload["document_version_id"])
    scope_id = uuid.UUID(job.payload["scope_id"])

    document = db.get(Document, document_id)
    if document is None:
        return

    document.status = "embedding"

    chunks = list(
        db.execute(
            select(Chunk).where(Chunk.document_version_id == document_version_id).order_by(Chunk.chunk_index)
        ).scalars()
    )

    if chunks:
        settings = get_settings()
        provider = get_embedding_provider()
        embedding_model = chunk_repo.get_or_create_embedding_model(
            db, settings.embedding_provider, settings.embedding_model, provider.dimension
        )
        vectors = provider.embed([c.content for c in chunks])
        chunk_repo.upsert_embeddings(db, embedding_model.id, list(zip((c.id for c in chunks), vectors)))

    document.status = "embedded"
    job_repo.enqueue(
        db,
        job_type="summarize",
        payload={"document_id": str(document_id), "document_version_id": str(document_version_id), "scope_id": str(scope_id)},
    )
