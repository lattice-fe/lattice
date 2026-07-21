import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.documents import Document
from app.models.jobs import Job
from app.models.sources import Source
from app.pipeline.hashing import sha256_file
from app.repositories import chunk_repo, document_repo


def run(db: Session, job: Job) -> None:
    source_id = uuid.UUID(job.payload["source_id"])
    source = db.get(Source, source_id)
    if source is None or source.status != "active":
        return

    system_id = uuid.UUID(get_settings().system_principal_id)
    root = Path(source.config["path"])
    if not root.exists():
        source.status = "error"
        return

    files = [root] if root.is_file() else [p for p in root.rglob("*") if p.is_file()]
    seen_refs: set[str] = set()

    for file_path in files:
        external_ref = str(file_path.relative_to(root)) if root.is_dir() else file_path.name
        seen_refs.add(external_ref)
        mime_type, _ = mimetypes.guess_type(file_path.name)
        document_repo.create_or_update_document(
            db,
            principal_id=system_id,
            scope_id=source.scope_id,
            source_id=source.id,
            external_ref=external_ref,
            mime_type=mime_type,
            file_extension=file_path.suffix.lower(),
            content_hash=sha256_file(file_path),
            size_bytes=file_path.stat().st_size,
            storage_uri=str(file_path),
        )

    existing_docs = db.execute(
        select(Document).where(Document.source_id == source.id, Document.deleted_at.is_(None))
    ).scalars()
    for doc in existing_docs:
        if doc.external_ref not in seen_refs:
            document_repo.soft_delete_document(db, system_id, source.scope_id, doc.id)
            chunk_repo.delete_chunks_for_document(db, doc.id)

    source.last_scanned_at = datetime.now(timezone.utc).replace(tzinfo=None)
