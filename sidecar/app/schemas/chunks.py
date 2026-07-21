from pydantic import BaseModel


class ChunkOut(BaseModel):
    chunk_index: int
    content: str
    structural_metadata: dict

    model_config = {"from_attributes": True}
