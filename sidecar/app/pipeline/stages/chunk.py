import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.chunking.chunker import chunk_sections
from app.models.documents import Document, DocumentVersion
from app.models.jobs import Job
from app.parsers.registry import parse_file
from app.repositories import chunk_repo, job_repo

# Re-parses the file rather than persisting the intermediate ParsedDocument
# between the parse and chunk stages. Parsing is cheap/pure relative to the
# LLM calls elsewhere in the pipeline, and this avoids serializing arbitrary
# document text through the jobs.payload jsonb column.


def run(db: Session, job: Job) -> None:
    document_id = uuid.UUID(job.payload["document_id"])
    document_version_id = uuid.UUID(job.payload["document_version_id"])
    scope_id = uuid.UUID(job.payload["scope_id"])

    document = db.get(Document, document_id)
    version = db.get(DocumentVersion, document_version_id)
    if document is None or version is None:
        return

    document.status = "chunking"

    parsed, _ = parse_file(Path(version.storage_uri), document.mime_type, document.file_extension or "")
    pieces = chunk_sections(parsed.sections)

    new_chunks = [
        chunk_repo.NewChunk(
            chunk_index=i, content=p.text, token_count=p.token_count, structural_metadata=p.structural_metadata
        )
        for i, p in enumerate(pieces)
    ]
    chunk_repo.replace_chunks(db, scope_id, document_id, document_version_id, new_chunks)

    document.status = "chunked"
    job_repo.enqueue(
        db,
        job_type="embed",
        payload={"document_id": str(document_id), "document_version_id": str(document_version_id), "scope_id": str(scope_id)},
    )
