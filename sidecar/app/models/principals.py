import uuid
from datetime import datetime

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, uuid_pk


class Principal(Base):
    __tablename__ = "principals"
    __table_args__ = (UniqueConstraint("type", "external_id", name="uq_principal_type_external_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    type: Mapped[str] = mapped_column(String(16))  # "user" | "group"
    external_id: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = created_at_col()
