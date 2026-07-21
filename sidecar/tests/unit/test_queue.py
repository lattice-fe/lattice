from app.jobs import queue
from app.models.jobs import Job


def _job(attempts=1, max_attempts=5) -> Job:
    return Job(job_type="parse", payload={}, status="running", attempts=attempts, max_attempts=max_attempts)


def test_complete_clears_lock_and_sets_succeeded():
    job = _job()
    job.locked_by, job.locked_at = "worker-1", "irrelevant"
    queue.complete(None, job)
    assert job.status == "succeeded"
    assert job.locked_by is None
    assert job.locked_at is None


def test_fail_requeues_with_backoff_when_attempts_remain():
    job = _job(attempts=2, max_attempts=5)
    queue.fail(None, job, "boom")
    assert job.status == "queued"
    assert job.last_error == "boom"
    assert job.run_after is not None


def test_fail_dead_letters_after_max_attempts():
    job = _job(attempts=5, max_attempts=5)
    queue.fail(None, job, "boom")
    assert job.status == "dead_letter"


def test_fail_backoff_grows_with_attempts():
    from datetime import datetime, timezone

    job_early = _job(attempts=1, max_attempts=10)
    job_late = _job(attempts=4, max_attempts=10)
    now = datetime.now(timezone.utc)

    queue.fail(None, job_early, "x")
    queue.fail(None, job_late, "x")

    assert (job_late.run_after - now) > (job_early.run_after - now)
