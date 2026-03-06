import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = None
    image_path: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    display_name: str | None = Field(default=None, max_length=100)
    image_path: str | None = Field(default=None, max_length=500)
