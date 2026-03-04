import uuid
from datetime import date
from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class TastingNoteOut(BaseModel):
    id: uuid.UUID
    bottle_id: uuid.UUID
    user_id: uuid.UUID
    user: UserOut
    tasted_at: date
    occasion: str | None = None
    notes: str | None = None
    rating: int
    food_pairing: str | None = None
    pairing_rating: int | None = None
    would_drink_again: bool | None = None

    model_config = {"from_attributes": True}


class TastingNoteCreate(BaseModel):
    bottle_id: uuid.UUID
    tasted_at: date | None = None
    occasion: str | None = None
    notes: str | None = None
    rating: int = Field(ge=0, le=10)
    food_pairing: str | None = None
    pairing_rating: int | None = Field(default=None, ge=0, le=10)
    would_drink_again: bool | None = None
