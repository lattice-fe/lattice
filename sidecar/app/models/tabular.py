import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col


class TabularRow(Base):
    """Rows from xlsx/csv sources. Deliberately never chunked or embedded —
    semantic search over spreadsheet cells is a poor fit. A future
    SQL/pandas-style query tool reads this directly via document_version_id
    and table_name; document_versions.structured_data carries the schema
    summary that the pointer index can reason about without loading rows."""

    __tablename__ = "tabular_rows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("document_versions.id"), index=True
    )
    table_name: Mapped[str] = mapped_column(String(255))  # sheet name, or "csv"
    row_index: Mapped[int] = mapped_column(Integer)
    row_data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = created_at_col()
