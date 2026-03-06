import uuid
from datetime import datetime
from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = None
    image_path: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str


class UserUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    image_path: str | None = None
