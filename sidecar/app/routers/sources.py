import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.principals import Principal
from app.models.sources import Source
from app.permissions.checks import PermissionDenied, require_scope_access
from app.permissions.dependencies import get_current_principal
from app.schemas.sources import SourceCreate, SourceOut

router = APIRouter(prefix="/scopes/{scope_id}/sources", tags=["sources"])


@router.post("", response_model=SourceOut)
def create_source(
    scope_id: uuid.UUID,
    body: SourceCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> SourceOut:
    try:
        require_scope_access(db, principal.id, scope_id, "write")
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if not Path(body.path).exists():
        raise HTTPException(status_code=400, detail=f"path does not exist: {body.path}")

    # Check for duplicate path across all sources
    existing = db.execute(
        select(Source).where(Source.type == "filesystem_watch", Source.path == body.path)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"path already indexed in another scope: {body.path}",
        )

    source = Source(
        scope_id=scope_id,
        type="filesystem_watch",
        path=body.path,
        config={"path": body.path, "poll_interval_seconds": body.poll_interval_seconds},
        status="active",
    )
    db.add(source)
    db.commit()
    return SourceOut.model_validate(source)


@router.get("", response_model=list[SourceOut])
def list_sources(
    scope_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> list[SourceOut]:
    try:
        require_scope_access(db, principal.id, scope_id, "read")
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    sources = db.execute(select(Source).where(Source.scope_id == scope_id)).scalars()
    return [SourceOut.model_validate(s) for s in sources]
