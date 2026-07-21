from pathlib import Path

from sqlalchemy import text

import app.models  # noqa: F401 — registers all mapped classes on Base.metadata
from app.config import get_settings
from app.constants import EMBEDDING_DIM
from app.db.base import Base
from app.db.session import get_engine


def init_db() -> None:
    """Create the ORM schema and the sqlite-vec vector table. Safe to call on
    every startup (idempotent). Replaces the old Alembic/Postgres migrations."""
    settings = get_settings()

    # Ensure the sqlite file's directory and the upload storage root exist.
    url = settings.database_url
    if url.startswith("sqlite") and ":///" in url:
        db_path = url.split(":///", 1)[1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.storage_root).mkdir(parents=True, exist_ok=True)

    engine = get_engine()
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0("
                "chunk_id TEXT PRIMARY KEY, "
                "scope_id TEXT, "
                "embedding_model_id TEXT, "
                f"embedding float[{EMBEDDING_DIM}])"
            )
        )
