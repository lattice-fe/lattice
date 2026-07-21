import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db.init import init_db
from app.jobs.scheduler import run_scheduler
from app.jobs.worker import run_worker
from app.routers import admin, chat, documents, scopes, sources

logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # One process runs the whole sidecar: create the schema, then start the
    # job worker + scheduler as background threads (SQLite has no LISTEN/NOTIFY,
    # so both just poll). WAL lets the worker write while the API reads.
    init_db()
    stop = threading.Event()
    worker_thread = threading.Thread(target=run_worker, kwargs={"stop": stop}, daemon=True)
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    worker_thread.start()
    scheduler_thread.start()
    logger.info("sidecar started: API + worker + scheduler")
    try:
        yield
    finally:
        stop.set()


# The frontend (web/) is a standalone Next.js app; in dev it proxies API calls
# here via next.config.ts rewrites.
app = FastAPI(title="Index — ingestion & indexing backbone", lifespan=lifespan)

app.include_router(scopes.router)
app.include_router(sources.router)
app.include_router(documents.router)
app.include_router(admin.router)
app.include_router(admin.global_router)
app.include_router(chat.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Serve the built Next.js web chat UI (static export) at the root, same origin
# as the API — so its relative /scopes calls hit the routers above. Mounted
# last so the API routes take precedence. Only present once `web/` is built.
_web_out = Path(__file__).resolve().parent.parent / "web" / "out"
if _web_out.is_dir():
    app.mount("/", StaticFiles(directory=str(_web_out), html=True), name="web")
