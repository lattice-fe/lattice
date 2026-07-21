from collections.abc import Generator
from functools import lru_cache

import sqlite_vec
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    engine = create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        # SQLite: worker / scheduler / API run in different threads.
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _configure_connection(dbapi_conn, _record):  # noqa: ANN001
        # Load sqlite-vec and apply pragmas on every new connection (WAL lets
        # the worker write while the API reads).
        dbapi_conn.enable_load_extension(True)
        sqlite_vec.load(dbapi_conn)
        dbapi_conn.enable_load_extension(False)
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA foreign_keys=ON")
        # Generous busy timeout: the worker/scheduler/API threads all write, so
        # let a blocked writer wait for the current one instead of erroring.
        cur.execute("PRAGMA busy_timeout=30000")
        cur.close()

    return engine


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    # autoflush must stay on (the default): repository functions issue
    # sequential writes and reads against the same Session within one
    # transaction (e.g. create_scope's ACL insert, then a later
    # require_scope_access SELECT) and rely on earlier pending writes being
    # visible without an explicit flush() at every call site.
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()
