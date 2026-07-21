import socket
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.jobs import Job

_WORKER_ID = f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"

# Exponential backoff base for retry scheduling: attempt 1 -> 10s, 2 -> 20s, 3 -> 40s, ...
_BACKOFF_BASE_SECONDS = 10


def _utcnow() -> datetime:
    # Naive UTC, to match SQLite's CURRENT_TIMESTAMP (func.now()) string format
    # used for the run_after default and comparisons.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def dequeue(db: Session, worker_id: str = _WORKER_ID) -> Job | None:
    """Claim the next runnable job. The sidecar runs a single in-process worker,
    so plain claim-and-flip is enough (no SKIP LOCKED needed as on Postgres)."""
    job = db.execute(
        select(Job)
        .where(Job.status == "queued", Job.run_after <= func.now())
        .order_by(Job.created_at)
        .limit(1)
    ).scalars().first()
    if job is None:
        return None

    job.status = "running"
    job.locked_by = worker_id
    job.locked_at = _utcnow()
    job.attempts += 1
    db.flush()
    return job


def complete(db: Session, job: Job) -> None:
    job.status = "succeeded"
    job.locked_by = None
    job.locked_at = None


def fail(db: Session, job: Job, error: str) -> None:
    job.last_error = error[:4000]
    if job.attempts >= job.max_attempts:
        job.status = "dead_letter"
        job.locked_by = None
        job.locked_at = None
        return
    backoff = _BACKOFF_BASE_SECONDS * (2 ** (job.attempts - 1))
    job.status = "queued"
    job.run_after = _utcnow() + timedelta(seconds=backoff)
    job.locked_by = None
    job.locked_at = None
