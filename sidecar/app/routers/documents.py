import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.documents import DocumentVersion
from app.models.principals import Principal
from app.permissions.checks import PermissionDenied
from app.permissions.dependencies import get_current_principal
from app.pipeline.hashing import sha256_file
from app.repositories import chunk_repo, document_repo, summary_repo
from app.schemas.chunks import ChunkOut
from app.schemas.documents import DocumentDetailOut, DocumentOut

router = APIRouter(prefix="/scopes/{scope_id}/documents", tags=["documents"])


@router.post("", response_model=DocumentOut)
async def upload_document(
    scope_id: uuid.UUID,
    file: UploadFile,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> DocumentOut:
    try:
        source = document_repo.get_or_create_manual_upload_source(db, scope_id)
    except Exception:
        # scope_id not required to exist yet at this point; surface as 404 rather
        # than a raw 500 if the scope truly doesn't exist.
        raise HTTPException(status_code=404, detail=f"scope {scope_id} not found")

    dest_dir = Path(get_settings().storage_root) / str(scope_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file.filename

    contents = await file.read()
    dest_path.write_bytes(contents)

    try:
        result = document_repo.create_or_update_document(
            db,
            principal_id=principal.id,
            scope_id=scope_id,
            source_id=source.id,
            external_ref=file.filename,
            mime_type=file.content_type,
            file_extension=Path(file.filename).suffix.lower(),
            content_hash=sha256_file(dest_path),
            size_bytes=len(contents),
            storage_uri=str(dest_path),
        )
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    db.commit()
    return DocumentOut.model_validate(result.document)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    scope_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> list[DocumentOut]:
    try:
        documents = document_repo.list_documents(db, principal.id, scope_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    version_ids = [d.latest_version_id for d in documents if d.latest_version_id is not None]
    summaries = summary_repo.get_summaries_for_versions(db, version_ids)

    out = []
    for d in documents:
        summary = summaries.get(d.latest_version_id) if d.latest_version_id else None
        out.append(
            DocumentOut(
                **DocumentOut.model_validate(d).model_dump(exclude={"title", "one_liner", "category"}),
                title=summary.title if summary else None,
                one_liner=summary.one_liner if summary else None,
                category=summary.category if summary else None,
            )
        )
    return out


@router.get("/{document_id}", response_model=DocumentDetailOut)
def get_document(
    scope_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> DocumentDetailOut:
    try:
        document = document_repo.get_document(db, principal.id, scope_id, document_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    summary_text = None
    title = None
    one_liner = None
    category = None
    structured_data = None
    if document.latest_version_id is not None:
        version = db.get(DocumentVersion, document.latest_version_id)
        if version is not None:
            structured_data = version.structured_data
            summary = summary_repo.get_summary_for_document_version(db, version.id)
            if summary:
                summary_text = summary.summary_text
                title = summary.title
                one_liner = summary.one_liner
                category = summary.category

    return DocumentDetailOut(
        **DocumentOut.model_validate(document).model_dump(exclude={"title", "one_liner", "category"}),
        title=title,
        one_liner=one_liner,
        category=category,
        summary_text=summary_text,
        structured_data=structured_data,
    )


@router.get("/{document_id}/chunks", response_model=list[ChunkOut])
def get_document_chunks(
    scope_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> list[ChunkOut]:
    try:
        chunks = chunk_repo.list_chunks(db, principal.id, scope_id, document_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return [ChunkOut.model_validate(c) for c in chunks]


@router.get("/{document_id}/file")
def get_document_file(
    scope_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> FileResponse:
    """Serve the raw document bytes (e.g. a PDF) for inline display in the web
    viewer. Filesystem-source docs stream straight from their on-disk path."""
    try:
        document = document_repo.get_document(db, principal.id, scope_id, document_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if document.latest_version_id is None:
        raise HTTPException(status_code=404, detail="document has no stored version yet")
    version = db.get(DocumentVersion, document.latest_version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="document version not found")

    path = Path(version.storage_uri)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="file is no longer on disk")
    return FileResponse(
        path,
        media_type=document.mime_type or "application/octet-stream",
        content_disposition_type="inline",
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(
    scope_id: uuid.UUID,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> None:
    try:
        document_repo.soft_delete_document(db, principal.id, scope_id, document_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
