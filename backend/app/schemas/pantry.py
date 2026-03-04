import uuid
from pydantic import BaseModel
from app.schemas.tag import TagOut


class PantryItemOut(BaseModel):
    id: uuid.UUID
    name: str
    in_stock: bool
    tag_id: uuid.UUID | None = None
    tag: TagOut | None = None

    model_config = {"from_attributes": True}


class PantryItemCreate(BaseModel):
    name: str
    in_stock: bool = True
    tag_id: uuid.UUID | None = None


class PantryItemUpdate(BaseModel):
    name: str | None = None
    in_stock: bool | None = None
    tag_id: uuid.UUID | None = None
