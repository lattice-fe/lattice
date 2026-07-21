import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import get_settings
from app.db.session import get_sessionmaker
from app.models.jobs import Job
from app.models.scopes import Scope
from app.models.sources import Source
from app.repositories import job_repo, summary_repo

logger = logging.getLogger("app.jobs.scheduler")


def _has_pending_job(db, job_type: str, key_field: str, key_value: str) -> bool:
    rows = db.execute(select(Job.payload).where(Job.job_type == job_type, Job.status.in_(["queued", "running"])))
    return any(payload.get(key_field) == key_value for (payload,) in rows)


def _sweep_sources(db) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sources = db.execute(select(Source).where(Source.status == "active")).scalars()
    for source in sources:
        interval = timedelta(seconds=source.config.get("poll_interval_seconds", 60))
        due = source.last_scanned_at is None or (now - source.last_scanned_at) >= interval
        if not due:
            continue
        if _has_pending_job(db, "scan_source", "source_id", str(source.id)):
            continue
        job_repo.enqueue(db, job_type="scan_source", payload={"source_id": str(source.id)})


def _sweep_consolidation(db) -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    scopes = db.execute(select(Scope).where(Scope.deleted_at.is_(None))).scalars()
    for scope in scopes:
        pointer = summary_repo.get_pointer_index(db, scope.id)
        since = pointer.last_consolidated_at if pointer is not None else datetime.min
        new_count = summary_repo.count_summaries_since(db, scope.id, since)
        if new_count == 0:
            continue
        wait_exceeded = pointer is None or (now - since) >= timedelta(minutes=settings.consolidation_max_wait_minutes)
        due = new_count >= settings.consolidation_min_new_summaries or wait_exceeded
        if not due:
            continue
        if _has_pending_job(db, "consolidate", "scope_id", str(scope.id)):
            continue
        job_repo.enqueue(db, job_type="consolidate", payload={"scope_id": str(scope.id)})


def run_scheduler_tick() -> None:
    Session = get_sessionmaker()
    with Session() as db:
        _sweep_sources(db)
        _sweep_consolidation(db)
        db.commit()


def run_scheduler() -> None:
    settings = get_settings()
    logger.info("scheduler starting, tick=%ss", settings.scheduler_tick_seconds)
    while True:
        try:
            run_scheduler_tick()
        except Exception:
            logger.exception("scheduler tick failed")
        time.sleep(settings.scheduler_tick_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_scheduler()
