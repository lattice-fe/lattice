import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.documents import Document, DocumentVersion
from app.models.jobs import Job
from app.parsers.registry import parse_file
from app.repositories import job_repo, tabular_repo


def run(db: Session, job: Job) -> None:
    document_id = uuid.UUID(job.payload["document_id"])
    document_version_id = uuid.UUID(job.payload["document_version_id"])
    scope_id = uuid.UUID(job.payload["scope_id"])

    document = db.get(Document, document_id)
    version = db.get(DocumentVersion, document_version_id)
    if document is None or version is None:
        return

    document.status = "parsing"

    parsed, parser = parse_file(Path(version.storage_uri), document.mime_type, document.file_extension or "")

    version.parser_name = parser.name
    version.parser_version = parser.version
    version.parsed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    next_payload = {
        "document_id": str(document_id),
        "document_version_id": str(document_version_id),
        "scope_id": str(scope_id),
    }

    if parsed.kind == "tabular":
        version.structured_data = {
            "sheet_names": parsed.raw_metadata.get("sheet_names", []),
            "tables": [
                {"table_name": t.table_name, "row_count": t.row_count, "columns": t.columns} for t in parsed.tables
            ],
        }
        tabular_repo.replace_tabular_rows(db, document_version_id, {t.table_name: t.rows for t in parsed.tables})
        document.status = "parsed"
        # Tabular content skips chunk/embed entirely — straight to summarize.
        job_repo.enqueue(db, job_type="summarize", payload=next_payload)
    else:
        document.status = "parsed"
        job_repo.enqueue(db, job_type="chunk", payload=next_payload)
