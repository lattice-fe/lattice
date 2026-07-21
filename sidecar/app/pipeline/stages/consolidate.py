import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.jobs import Job
from app.providers.factory import get_understanding_chat_provider
from app.repositories import summary_repo

_CONSOLIDATE_PROMPT = """You maintain a short "pointer index" describing what's in a shared document scope,
so someone can tell what's inside without opening every file.

Current pointer index (may be empty if this is the first pass):
---
{existing_rollup}
---

Here are the current per-document summaries for this scope ({doc_count} documents total):
---
{summaries}
---

Rewrite the pointer index: a concise, well-organized description of what this scope contains
(topics, document types, notable items). Merge and update rather than append — do not just
concatenate old and new. Keep it proportional to the amount of content (a few sentences for a
handful of docs, structured groupings if there are many). Output only the new pointer index text.
"""


def run(db: Session, job: Job) -> None:
    scope_id = uuid.UUID(job.payload["scope_id"])

    existing = summary_repo.get_pointer_index(db, scope_id)
    summaries = summary_repo.list_summaries_for_scope(db, scope_id)

    if not summaries:
        summary_repo.upsert_pointer_index(
            db, scope_id, rollup_text="", doc_count=0, model_used="", consolidated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        return

    summaries_text = "\n\n".join(f"- {s.summary_text}" for s in summaries)
    prompt = _CONSOLIDATE_PROMPT.format(
        existing_rollup=existing.rollup_text if existing else "",
        doc_count=len(summaries),
        summaries=summaries_text,
    )

    provider = get_understanding_chat_provider()
    rollup_text = provider.complete([{"role": "user", "content": prompt}], max_tokens=800)

    summary_repo.upsert_pointer_index(
        db,
        scope_id,
        rollup_text=rollup_text,
        doc_count=len(summaries),
        model_used=get_settings().chat_model,
        consolidated_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
