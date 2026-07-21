import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.jobs import Job


def enqueue(db: Session, job_type: str, payload: dict, run_after: datetime | None = None) -> Job:
    """Insert a job row. Callers that need atomicity with a data write (e.g.
    creating a document and its parse job together) should call this on the
    same Session/transaction before commit — see document_repo.create_or_update_document."""
    job = Job(job_type=job_type, payload=payload)
    if run_after is not None:
        job.run_after = run_after
    db.add(job)
    db.flush()
    return job


def get_job(db: Session, job_id: uuid.UUID) -> Job | None:
    return db.get(Job, job_id)
