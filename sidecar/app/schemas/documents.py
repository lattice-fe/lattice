import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: uuid.UUID
    scope_id: uuid.UUID
    external_ref: str
    mime_type: str | None
    file_extension: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    title: str | None = None
    one_liner: str | None = None
    category: str | None = None

    model_config = {"from_attributes": True}


class DocumentDetailOut(DocumentOut):
    summary_text: str | None = None
    structured_data: dict | None = None
