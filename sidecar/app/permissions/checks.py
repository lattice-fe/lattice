import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.scopes import ScopeAcl, permission_at_least


class PermissionDenied(Exception):
    def __init__(self, principal_id: uuid.UUID, scope_id: uuid.UUID, level: str):
        self.principal_id = principal_id
        self.scope_id = scope_id
        self.level = level
        super().__init__(f"principal {principal_id} lacks '{level}' access to scope {scope_id}")


def is_system_principal(principal_id: uuid.UUID) -> bool:
    return str(principal_id) == get_settings().system_principal_id


def require_scope_access(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, level: str) -> None:
    """The single structural enforcement point for scope access. Every
    repository read/write path must call this before touching scoped data —
    there is no other sanctioned way to reach scoped tables.

    Background jobs run as SYSTEM_PRINCIPAL and bypass the ACL check here,
    but never the scope_id filter itself: callers still pass an explicit
    scope_id that comes from the job payload, so scoping is never skipped,
    only the "is this principal allowed" grant check is.
    """
    if is_system_principal(principal_id):
        return

    grant = db.execute(
        select(ScopeAcl.permission_level).where(
            ScopeAcl.scope_id == scope_id,
            ScopeAcl.principal_id == principal_id,
        )
    ).scalar_one_or_none()

    if grant is None or not permission_at_least(grant, level):
        raise PermissionDenied(principal_id, scope_id, level)


def accessible_scope_ids(db: Session, principal_id: uuid.UUID, level: str = "read") -> list[uuid.UUID]:
    """All scope ids a principal has at least `level` access to. Used by
    routes that list across scopes rather than operating on one known scope_id."""
    rows = db.execute(
        select(ScopeAcl.scope_id, ScopeAcl.permission_level).where(ScopeAcl.principal_id == principal_id)
    ).all()
    return [scope_id for scope_id, granted in rows if permission_at_least(granted, level)]
