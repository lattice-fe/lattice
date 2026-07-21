import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, ChatSession
from app.permissions.checks import require_scope_access

_TITLE_MAX_LEN = 60


def create_session(
    db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, title: str | None = None
) -> ChatSession:
    require_scope_access(db, principal_id, scope_id, "read")
    session = ChatSession(scope_id=scope_id, principal_id=principal_id, title=title)
    db.add(session)
    db.flush()
    return session


def list_sessions(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID) -> list[ChatSession]:
    require_scope_access(db, principal_id, scope_id, "read")
    return list(
        db.execute(
            select(ChatSession)
            .where(ChatSession.scope_id == scope_id, ChatSession.principal_id == principal_id)
            .order_by(ChatSession.updated_at.desc())
        ).scalars()
    )


def get_session(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, session_id: uuid.UUID) -> ChatSession:
    require_scope_access(db, principal_id, scope_id, "read")
    session = db.get(ChatSession, session_id)
    # Ownership check happens here rather than in the query WHERE clause so a
    # session that exists but belongs to someone else 404s the same as one
    # that doesn't exist at all — no signal leaks about other principals'
    # session ids.
    if session is None or session.scope_id != scope_id or session.principal_id != principal_id:
        raise LookupError(f"session {session_id} not found in scope {scope_id}")
    return session


def delete_session(db: Session, principal_id: uuid.UUID, scope_id: uuid.UUID, session_id: uuid.UUID) -> None:
    session = get_session(db, principal_id, scope_id, session_id)
    # chat_messages.session_id has no ON DELETE CASCADE, so messages must go
    # first or the FK constraint rejects deleting the session.
    db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    db.delete(session)


def list_messages(db: Session, session_id: uuid.UUID) -> list[ChatMessage]:
    return list(
        db.execute(
            select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        ).scalars()
    )


def add_message(
    db: Session, session: ChatSession, role: str, content: str, sources: list[dict] | None = None
) -> ChatMessage:
    message = ChatMessage(session_id=session.id, role=role, content=content, sources=sources)
    db.add(message)

    session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if session.title is None and role == "user":
        session.title = content[:_TITLE_MAX_LEN] + ("…" if len(content) > _TITLE_MAX_LEN else "")

    db.flush()
    return message
