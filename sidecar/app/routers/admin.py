import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.principals import Principal
from app.models.scopes import Scope
from app.models.sources import Source
from app.permissions.checks import PermissionDenied, require_scope_access
from app.permissions.dependencies import get_current_principal
from app.repositories import job_repo, summary_repo

router = APIRouter(prefix="/scopes/{scope_id}", tags=["admin"])

# --- Global admin endpoints (no scope_id prefix) ---
global_router = APIRouter(tags=["admin"])


class PointerIndexOut(BaseModel):
    rollup_text: str
    doc_count: int
    last_consolidated_at: str | None

    model_config = {"from_attributes": True}


class ScopeByPathOut(BaseModel):
    scope_id: uuid.UUID
    scope_name: str

    model_config = {"from_attributes": True}


@global_router.get("/admin/scope-by-path", response_model=ScopeByPathOut | None)
def get_scope_by_path(
    path: str, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> ScopeByPathOut | None:
    """Find the scope that indexes the given filesystem path (if any)."""
    source = db.execute(
        select(Source).where(Source.type == "filesystem_watch", Source.path == path)
    ).scalar_one_or_none()
    if source is None:
        return None
    scope = db.get(Scope, source.scope_id)
    if scope is None or scope.deleted_at is not None:
        return None
    return ScopeByPathOut(scope_id=scope.id, scope_name=scope.name)


@router.post("/admin/consolidate", status_code=202)
def force_consolidate(
    scope_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> dict:
    try:
        require_scope_access(db, principal.id, scope_id, "admin")
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    job = job_repo.enqueue(db, job_type="consolidate", payload={"scope_id": str(scope_id)})
    db.commit()
    return {"job_id": str(job.id)}


@router.get("/pointer-index", response_model=PointerIndexOut)
def get_pointer_index(
    scope_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> PointerIndexOut:
    try:
        pointer = summary_repo.get_pointer_index_scoped(db, principal.id, scope_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if pointer is None:
        return PointerIndexOut(rollup_text="", doc_count=0, last_consolidated_at=None)
    return PointerIndexOut(
        rollup_text=pointer.rollup_text,
        doc_count=pointer.doc_count,
        last_consolidated_at=pointer.last_consolidated_at.isoformat() if pointer.last_consolidated_at else None,
    )
