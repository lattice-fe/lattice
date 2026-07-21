import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.types import created_at_col, updated_at_col, uuid_pk

MESSAGE_ROLES = ("user", "assistant")


class ChatSession(Base):
    """A conversation thread, scoped to one workspace and owned by the
    principal who started it — personal chat history, not a shared team
    thread. title is set lazily from the first question if not provided."""

    __tablename__ = "chat_sessions"
    __table_args__ = (Index("ix_chat_sessions_scope_principal", "scope_id", "principal_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    scope_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scopes.id"))
    principal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("principals.id"))
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()


class ChatMessage(Base):
    """One turn in a session. sources is only populated for assistant
    messages (mirrors ChatSource: document_id/external_ref/heading_path)."""

    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_session_id_created_at", "session_id", "created_at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("chat_sessions.id"))
    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(String)
    sources: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = created_at_col()
