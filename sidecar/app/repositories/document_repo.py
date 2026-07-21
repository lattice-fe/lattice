import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.documents import Document, DocumentVersion
from app.models.sources import Source
from app.permissions.checks import require_scope_access
from app.repositories import chunk_repo, job_repo


def get_or_create_manual_upload_source(db: Session, scope_id: uuid.UUID) -> Source:
    """Manual uploads need a stable source_id so the (scope_id, source_id,
    external_ref) uniqueness on Document actually catches re-uploads of the
    same filename. One singleton manual_upload source per scope."""
    existing = db.execute(
        select(Source).where(Source.scope_id == scope_id, Source.type == "manual_upload")
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    source = Source(scope_id=scope_id, type="manual_upload", config={}, status="active")
    db.add(source)
    db.flush()
    return source


class CreateOrUpdateResult:
    def __init__(self, document: Document, version: DocumentVersion, is_new_content: bool):
        self.document = document
        self.version = version
        self.is_new_content = is_new_content


def create_or_update_document(
    db: Session,
    principal_id: uuid.UUID,
    scope_id: uuid.UUID,
    source_id: uuid.UUID,
    external_ref: str,
    mime_type: str | None,
    file_extension: str | None,
    content_hash: str,
    size_bytes: int | None,
    storage_uri: str,
) -> CreateOrUpdateResult:
    """Shared idempotency/versioning logic for both filesystem-watch scans and
    manual uploads — they must never diverge in behavior. Enqueues a 'parse'
    job in the same transaction as the document/version write so a document
    can never exist with no pipeline job behind it. Caller commits."""
    require_scope_access(db, principal_id, scope_id, "write")

    document = db.execute(
        select(Document).where(
            Document.scope_id == scope_id,
            Document.source_id == source_id,
            Document.external_ref == external_ref,
        )
    ).scalar_one_or_none()

    was_deleted = document is not None and document.deleted_at is not None
    if was_deleted:
        document.deleted_at = None  # file reappeared

    if document is None:
        document = Document(
            scope_id=scope_id,
            source_id=source_id,
            external_ref=external_ref,
            mime_type=mime_type,
            file_extension=file_extension,
            status="pending",
        )
        db.add(document)
        db.flush()
    else:
        current_version = db.get(DocumentVersion, document.latest_version_id) if document.latest_version_id else None
        if current_version is not None and current_version.content_hash == content_hash:
            if was_deleted:
                # Chunks/embeddings for this version were hard-deleted when the
                # document was soft-deleted, so even though content is
                # unchanged, regenerable data must be rebuilt — re-enqueue
                # against the existing version rather than minting a new one
                # (content_hash is unique per document_id).
                document.status = "pending"
                job_repo.enqueue(
                    db,
                    job_type="parse",
                    payload={
                        "document_id": str(document.id),
                        "document_version_id": str(current_version.id),
                        "scope_id": str(scope_id),
                    },
                )
                return CreateOrUpdateResult(document, current_version, is_new_content=True)
            return CreateOrUpdateResult(document, current_version, is_new_content=False)

    prior_version_count = db.execute(
        select(DocumentVersion.id).where(DocumentVersion.document_id == document.id)
    ).all()
    version = DocumentVersion(
        document_id=document.id,
        version_number=len(prior_version_count) + 1,
        content_hash=content_hash,
        size_bytes=size_bytes,
        storage_uri=storage_uri,
    )
    db.add(version)
    db.flush()

    document.latest_version_id = version.id
    document.status = "pending"
    document.mime_type = mime_type
    document.file_extension = file_extension
    document.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # This version supersedes whatever chunks/embeddings exist for the
    # document's prior version — those are keyed by the old
    # document_version_id, so chunk_repo.replace_chunks (keyed by the new
    # version_id) would never touch them, leaving stale content sitting
    # alongside the new content in every list_chunks() call. Clear them now
    # rather than waiting for the chunk stage to run.
    chunk_repo.delete_chunks_for_document(db, document.id)

    job_repo.enqueue(
        db,
        job_type="parse",
        payload={
            "document_id": str(document.id),
            "document_version_id": str(version.id),
            "scope_id": str(scope_id),
        },
    )

    return CreateOrUpdateResult(document, version, is_new_content=True)


def soft_delete_document(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, document_id: uuid.UUID) -> None:
    require_scope_access(db, principal_id, scope_id, "write")
    document = db.get(Document, document_id)
    if document is None or document.scope_id != scope_id:
        raise LookupError(f"document {document_id} not found in scope {scope_id}")
    document.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)


def get_document(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, document_id: uuid.UUID) -> Document:
    require_scope_access(db, principal_id, scope_id, "read")
    document = db.get(Document, document_id)
    if document is None or document.scope_id != scope_id:
        raise LookupError(f"document {document_id} not found in scope {scope_id}")
    return document


def list_documents(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID) -> list[Document]:
    require_scope_access(db, principal_id, scope_id, "read")
    return list(
        db.execute(
            select(Document).where(Document.scope_id == scope_id, Document.deleted_at.is_(None))
        ).scalars()
    )
