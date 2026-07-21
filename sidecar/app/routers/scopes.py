import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.principals import Principal
from app.permissions.checks import PermissionDenied
from app.permissions.dependencies import get_current_principal
from app.repositories import scope_repo
from app.schemas.scopes import AclGrant, ScopeCreate, ScopeOut

router = APIRouter(prefix="/scopes", tags=["scopes"])


def _to_scope_out(db: Session, scope) -> ScopeOut:
    return ScopeOut(
        **ScopeOut.model_validate(scope).model_dump(exclude={"member_count"}),
        member_count=scope_repo.count_members(db, scope.id),
    )


@router.post("", response_model=ScopeOut)
def create_scope(
    body: ScopeCreate, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> ScopeOut:
    scope = scope_repo.create_scope(db, principal.id, body.name, body.description)
    db.commit()
    return _to_scope_out(db, scope)


@router.get("", response_model=list[ScopeOut])
def list_scopes(
    db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> list[ScopeOut]:
    scopes = scope_repo.list_scopes(db, principal.id)
    return [_to_scope_out(db, s) for s in scopes]


@router.get("/{scope_id}", response_model=ScopeOut)
def get_scope(
    scope_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> ScopeOut:
    try:
        scope = scope_repo.get_scope(db, principal.id, scope_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _to_scope_out(db, scope)


@router.post("/{scope_id}/acl", status_code=204)
def grant_access(
    scope_id: uuid.UUID,
    body: AclGrant,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> None:
    from sqlalchemy import select

    target = db.execute(
        select(Principal).where(
            Principal.external_id == body.principal_external_id, Principal.type == body.principal_type
        )
    ).scalar_one_or_none()
    if target is None:
        target = Principal(type=body.principal_type, external_id=body.principal_external_id)
        db.add(target)
        db.flush()
    try:
        scope_repo.grant_access(db, principal.id, scope_id, target.id, body.permission_level)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    db.commit()
