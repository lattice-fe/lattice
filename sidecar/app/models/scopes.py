import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, updated_at_col, uuid_pk


class Scope(Base):
    """The isolation boundary for indexed content. Not a folder path — folders/ACLs
    drift apart in real orgs, so this is what every scoped table filters on."""

    __tablename__ = "scopes"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    embedding_model_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("embedding_models.id"), nullable=True
    )
    settings: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)


PERMISSION_LEVELS = ("read", "write", "admin")
_PERMISSION_RANK = {level: i for i, level in enumerate(PERMISSION_LEVELS)}


def permission_at_least(granted: str, required: str) -> bool:
    return _PERMISSION_RANK[granted] >= _PERMISSION_RANK[required]


class ScopeAcl(Base):
    """Real permission grants, not a stub. One row per principal per scope."""

    __tablename__ = "scope_acl"
    __table_args__ = (UniqueConstraint("scope_id", "principal_id", name="uq_scope_acl_scope_principal"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"))
    principal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("principals.id"))
    permission_level: Mapped[str] = mapped_column(String(16))  # read | write | admin
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("principals.id"), nullable=True
    )
    granted_at: Mapped[datetime] = created_at_col()
