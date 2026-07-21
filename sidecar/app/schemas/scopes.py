import uuid
from datetime import datetime

from pydantic import BaseModel


class ScopeCreate(BaseModel):
    name: str
    description: str | None = None


class ScopeOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class AclGrant(BaseModel):
    principal_external_id: str
    principal_type: str = "user"
    permission_level: str  # read | write | admin
