import logging
import threading
import time

from app.config import get_settings
from app.db.session import get_sessionmaker
from app.jobs import queue
from app.pipeline.dispatcher import run_stage

logger = logging.getLogger("app.jobs.worker")


def process_one(worker_id: str) -> bool:
    """Claims and runs a single job. Returns True if a job was processed."""
    from app.models.jobs import Job

    Session = get_sessionmaker()
    with Session() as db:
        job = queue.dequeue(db, worker_id)
        if job is None:
            db.commit()
            return False
        job_id, job_type = job.id, job.job_type
        db.commit()  # release the claim (status='running') promptly

    with Session() as db:
        job = db.get(Job, job_id)
        try:
            run_stage(db, job)
            queue.complete(db, job)
            db.commit()
        except Exception as exc:
            db.rollback()
            error = repr(exc)
            with Session() as fail_db:
                failing_job = fail_db.get(Job, job_id)
                queue.fail(fail_db, failing_job, error)
                fail_db.commit()
            logger.exception("job %s (%s) failed", job_id, job_type)
    return True


def run_worker(worker_id: str = queue._WORKER_ID, stop: threading.Event | None = None) -> None:
    """Poll-driven job worker. SQLite has no LISTEN/NOTIFY, so we just poll at
    `job_poll_interval_seconds`; drain all ready work before sleeping."""
    settings = get_settings()
    logger.info("worker %s starting, poll_interval=%ss", worker_id, settings.job_poll_interval_seconds)
    while stop is None or not stop.is_set():
        try:
            worked = process_one(worker_id)
        except Exception:
            logger.exception("worker loop error")
            worked = False
        if not worked:
            if stop is not None:
                stop.wait(timeout=settings.job_poll_interval_seconds)
            else:
                time.sleep(settings.job_poll_interval_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_worker()
