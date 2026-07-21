import uuid

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.tabular import TabularRow


def replace_tabular_rows(
    db: Session, document_version_id: uuid.UUID, tables: dict[str, list[dict]]
) -> None:
    """Idempotent on retry, mirrors chunk_repo.replace_chunks. tables maps
    table_name (sheet name, or 'csv') -> list of row dicts."""
    db.execute(delete(TabularRow).where(TabularRow.document_version_id == document_version_id))
    rows = [
        TabularRow(document_version_id=document_version_id, table_name=table_name, row_index=i, row_data=row)
        for table_name, table_rows in tables.items()
        for i, row in enumerate(table_rows)
    ]
    if rows:
        db.add_all(rows)
