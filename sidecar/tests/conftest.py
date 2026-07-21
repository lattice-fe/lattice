import os

import pytest
from sqlalchemy import text

from app.config import get_settings
from app.db.base import Base
from app.db.session import get_engine, get_sessionmaker


@pytest.fixture()
def db_engine():
    """Requires a real, disposable Postgres+pgvector instance. Point
    TEST_DATABASE_URL at it (e.g. postgresql+psycopg://user:pass@localhost:5432/index_test).
    Skips cleanly if unreachable rather than failing the whole suite, since
    this backbone has no in-memory substitute for pgvector."""
    test_url = os.environ.get("TEST_DATABASE_URL")
    if test_url:
        os.environ["DATABASE_URL"] = test_url
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()

    engine = get_engine()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"no reachable Postgres+pgvector test database: {exc}")

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(engine)


@pytest.fixture()
def db_session(db_engine):
    Session = get_sessionmaker()
    with Session() as session:
        yield session
