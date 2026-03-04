import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.shopping import ShoppingSource


class ShoppingItemOut(BaseModel):
    id: uuid.UUID
    name: str
    bottle_id: uuid.UUID | None = None
    barcode: str | None = None
    source: ShoppingSource
    is_bought: bool
    added_at: datetime

    model_config = {"from_attributes": True}


class ShoppingItemCreate(BaseModel):
    name: str
    bottle_id: uuid.UUID | None = None
    barcode: str | None = None
    source: ShoppingSource = ShoppingSource.manual


class ShoppingItemUpdate(BaseModel):
    is_bought: bool | None = None
    name: str | None = None
