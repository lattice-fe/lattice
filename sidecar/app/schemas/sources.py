import uuid
from datetime import datetime

from pydantic import BaseModel


class SourceCreate(BaseModel):
    path: str
    poll_interval_seconds: int = 60


class SourceOut(BaseModel):
    id: uuid.UUID
    scope_id: uuid.UUID
    type: str
    status: str
    last_scanned_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
