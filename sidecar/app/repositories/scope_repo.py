import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.scopes import Scope, ScopeAcl
from app.permissions.checks import accessible_scope_ids, require_scope_access


def create_scope(db: Session, creator_principal_id: uuid.UUID, name: str, description: str | None = None) -> Scope:
    scope = Scope(name=name, description=description)
    db.add(scope)
    db.flush()
    db.add(ScopeAcl(scope_id=scope.id, principal_id=creator_principal_id, permission_level="admin"))
    return scope


def get_scope(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, level: str = "read") -> Scope:
    require_scope_access(db, principal_id, scope_id, level)
    scope = db.get(Scope, scope_id)
    if scope is None or scope.deleted_at is not None:
        raise LookupError(f"scope {scope_id} not found")
    return scope


def list_scopes(db: Session, principal_id: uuid.UUID, level: str = "read") -> list[Scope]:
    ids = accessible_scope_ids(db, principal_id, level)
    if not ids:
        return []
    return list(db.execute(select(Scope).where(Scope.id.in_(ids), Scope.deleted_at.is_(None))).scalars())


def count_members(db: Session, scope_id: uuid.UUID) -> int:
    return db.execute(select(func.count()).select_from(ScopeAcl).where(ScopeAcl.scope_id == scope_id)).scalar_one()


def grant_access(
    db: Session, granter_principal_id: uuid.UUID, scope_id: uuid.UUID, target_principal_id: uuid.UUID, level: str
) -> ScopeAcl:
    require_scope_access(db, granter_principal_id, scope_id, "admin")
    existing = db.execute(
        select(ScopeAcl).where(ScopeAcl.scope_id == scope_id, ScopeAcl.principal_id == target_principal_id)
    ).scalar_one_or_none()
    if existing is not None:
        existing.permission_level = level
        existing.granted_by = granter_principal_id
        return existing
    acl = ScopeAcl(
        scope_id=scope_id, principal_id=target_principal_id, permission_level=level, granted_by=granter_principal_id
    )
    db.add(acl)
    return acl
