from sqlalchemy.orm import Session

from app.models.jobs import Job
from app.pipeline.stages import chunk, consolidate, embed, parse, scan_source, summarize

_STAGES = {
    "scan_source": scan_source.run,
    "parse": parse.run,
    "chunk": chunk.run,
    "embed": embed.run,
    "summarize": summarize.run,
    "consolidate": consolidate.run,
}


def run_stage(db: Session, job: Job) -> None:
    stage = _STAGES.get(job.job_type)
    if stage is None:
        raise ValueError(f"unknown job_type {job.job_type!r}")
    stage(db, job)
