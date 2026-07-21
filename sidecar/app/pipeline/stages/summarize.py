import json
import re
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import CATEGORY_TAXONOMY
from app.models.chunks import Chunk
from app.models.documents import Document, DocumentVersion
from app.models.jobs import Job
from app.providers.factory import get_understanding_chat_provider
from app.repositories import summary_repo

_CATEGORY_GUIDE = """Category guide (pick exactly one):
- spec: a plan, design, or requirements document
- research: findings, experiments, analysis
- decision: a record of a choice that was made
- incident: a bug, postmortem, or outage report
- notes: meeting notes, standups, informal logs
- data: structured/tabular data, numeric results"""

_JSON_INSTRUCTIONS = """Respond with ONLY a JSON object (no markdown code fences, no commentary before or after) with exactly these keys, in exactly this order:
{{
  "title": "a short, human-readable title for this document (at most 80 characters) — what a person would call it in conversation, not the filename",
  "category": "one of: spec, research, decision, incident, notes, data",
  "one_liner": "a single sentence, at most 100 characters, capturing the single most important takeaway",
  "summary": "3-5 sentence summary for a colleague scanning a list of documents. Be concrete: decisions, topics, dates, participants."
}}

Put "summary" last — it's the longest field, and if you run out of room the
shorter fields above it still need to have already been written out in full.

""" + _CATEGORY_GUIDE

_TABULAR_PROMPT = """Read this spreadsheet/table's schema and produce the JSON described below.
For "summary" and "one_liner", state what the data appears to track and its shape — do not enumerate rows.

{json_instructions}

Filename: {filename}
Sheets/tables: {sheet_names}
Schema:
{schema}
"""

_TEXT_PROMPT = """Read this document and produce the JSON described below.

{json_instructions}

Filename: {filename}

Content:
{content}
"""

_MAX_CONTENT_CHARS = 12000
_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)


def _fallback_title(filename: str) -> str:
    """Used when structured-output parsing fails entirely — a readable
    guess from the filename beats showing raw JSON or leaving it blank."""
    stem = Path(filename).stem
    return re.sub(r"[_-]+", " ", stem).strip().title() or filename


_SMART_QUOTES = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'"})


def _try_json_loads(text: str) -> dict | None:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def _repair_truncated_json(text: str) -> dict | None:
    """max_tokens is generous (see run()) but the model can still land right
    on the edge, cutting the response off mid-object with everything present
    except the final closing brace(s) — observed in practice with Groq/Llama
    even at 800 tokens. Trim any dangling partial "key": "val and try
    progressively appending closing quote/brace combinations rather than
    discarding an otherwise-complete response."""
    text = text.rstrip()
    if not text.startswith("{"):
        return None
    # If the last field's value was cut mid-string, drop back to the last
    # complete ", boundary before guessing at closers.
    candidates = [text, text[: text.rfind('",') + 1] if '",' in text else text]
    for candidate in candidates:
        for suffix in ('"}', "}", '""}'):
            data = _try_json_loads(candidate.rstrip().rstrip(",") + suffix)
            if data is not None:
                return data
    return None


def _parse_structured_output(raw: str, filename: str) -> dict:
    """LLMs occasionally wrap JSON in a markdown fence despite instructions
    not to, prepend/append commentary around the object, emit typographic
    smart quotes instead of straight ASCII quotes (observed with Llama on
    Groq), or get cut off by the token budget right at/near the closing
    brace. Try progressively more aggressive recovery before giving up and
    treating the raw text as the summary — title/one_liner/category just
    end up derived/unset then."""
    text = raw.strip()
    fence_match = _FENCE_RE.search(text)
    if fence_match:
        text = fence_match.group(1)

    start, end = text.find("{"), text.rfind("}")
    span = text[start : end + 1] if start != -1 and end > start else text

    data = (
        _try_json_loads(text)
        or _try_json_loads(span)
        or _try_json_loads(span.translate(_SMART_QUOTES))
        or _repair_truncated_json(text)
    )

    if data is None:
        return {
            "title": _fallback_title(filename),
            "summary": raw.strip(),
            "one_liner": raw.strip()[:280],
            "category": None,
        }

    title = str(data.get("title") or "").strip()[:200] or _fallback_title(filename)
    summary = str(data.get("summary") or raw).strip()
    one_liner = str(data.get("one_liner") or summary).strip()[:280]
    category = str(data.get("category") or "").strip().lower()
    if category not in CATEGORY_TAXONOMY:
        category = None
    return {"title": title, "summary": summary, "one_liner": one_liner, "category": category}


def run(db: Session, job: Job) -> None:
    document_id = uuid.UUID(job.payload["document_id"])
    document_version_id = uuid.UUID(job.payload["document_version_id"])
    scope_id = uuid.UUID(job.payload["scope_id"])

    document = db.get(Document, document_id)
    version = db.get(DocumentVersion, document_version_id)
    if document is None or version is None:
        return

    document.status = "summarizing"
    provider = get_understanding_chat_provider()
    filename = document.external_ref

    if version.structured_data is not None:
        prompt = _TABULAR_PROMPT.format(
            json_instructions=_JSON_INSTRUCTIONS,
            filename=filename,
            sheet_names=", ".join(version.structured_data.get("sheet_names", [])),
            schema=_format_schema(version.structured_data),
        )
    else:
        chunks = list(
            db.execute(
                select(Chunk.content)
                .where(Chunk.document_version_id == document_version_id)
                .order_by(Chunk.chunk_index)
            ).scalars()
        )
        content = "\n\n".join(chunks)[:_MAX_CONTENT_CHARS]
        prompt = _TEXT_PROMPT.format(json_instructions=_JSON_INSTRUCTIONS, filename=filename, content=content)

    # Structured JSON output needs headroom beyond just the summary prose —
    # too tight a budget truncates the JSON mid-object, sometimes missing
    # only the final closing brace (see _repair_truncated_json for that
    # case). 1000 plus the key-ordering above (summary last) covers what's
    # been observed in practice with Groq/Llama.
    raw = provider.complete([{"role": "user", "content": prompt}], max_tokens=1000)
    parsed = _parse_structured_output(raw, filename)

    summary_repo.upsert_document_summary(
        db,
        scope_id=scope_id,
        document_id=document_id,
        document_version_id=document_version_id,
        title=parsed["title"],
        summary_text=parsed["summary"],
        one_liner=parsed["one_liner"],
        category=parsed["category"],
        model_used=get_settings().chat_model,
        content_hash=version.content_hash,
    )

    document.status = "ready"
    # Deliberately does not enqueue consolidate — see app/jobs/scheduler.py.
    # The pointer index is a debounced/batched rollup, not updated per-document.


def _format_schema(structured_data: dict) -> str:
    lines = []
    for table in structured_data.get("tables", []):
        cols = ", ".join(c["name"] for c in table.get("columns", []))
        lines.append(f"- {table['table_name']} ({table['row_count']} rows): {cols}")
    return "\n".join(lines)
