import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, updated_at_col, uuid_pk

SOURCE_TYPES = ("filesystem_watch", "manual_upload")
SOURCE_STATUSES = ("active", "paused", "error")


class Source(Base):
    __tablename__ = "sources"
    __table_args__ = (UniqueConstraint("type", "path", name="uq_source_type_path"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"))
    type: Mapped[str] = mapped_column(String(32))
    # Extracted from config for unique constraint - the filesystem path for "filesystem_watch" sources.
    path: Mapped[str] = mapped_column(String(1024), default="", server_default="")
    config: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(16), default="active", server_default="active")
    last_scanned_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()
