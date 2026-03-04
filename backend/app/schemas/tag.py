import uuid
from pydantic import BaseModel
from app.models.tag import TagCategory


class TagOut(BaseModel):
    id: uuid.UUID
    name: str
    category: TagCategory

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    category: TagCategory
