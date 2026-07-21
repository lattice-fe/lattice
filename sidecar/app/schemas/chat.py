import uuid
from datetime import datetime

from pydantic import BaseModel


class ChatSource(BaseModel):
    document_id: uuid.UUID
    external_ref: str
    heading_path: list[str] = []


class AskRequest(BaseModel):
    question: str


class SessionCreate(BaseModel):
    title: str | None = None


class SessionOut(BaseModel):
    id: uuid.UUID
    scope_id: uuid.UUID
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: list[ChatSource] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailOut(SessionOut):
    messages: list[MessageOut] = []
