import uuid
from datetime import date, datetime
from pydantic import BaseModel

from app.models.bottle import BottleType, BottleStatus, EnrichmentStatus
from app.schemas.tag import TagOut


class BottleOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    name: str
    producer: str | None = None
    type: BottleType
    subtype: str | None = None
    vintage: int | None = None
    region: str | None = None
    country: str | None = None
    grape_or_base: str | None = None
    abv: float | None = None
    sugar_content_g_per_100ml: float | None = None
    volume_ml: int | None = None
    purchase_price_kr: float | None = None
    purchase_date: date | None = None
    source_shop: str | None = None
    quantity: float
    quantity_purchased: float | None = None
    status: BottleStatus
    status_changed_at: datetime | None = None
    barcode: str | None = None
    enrichment_status: EnrichmentStatus
    serving_temp: str | None = None
    drink_window_start: date | None = None
    drink_window_end: date | None = None
    awards_scores: str | None = None
    notes: str | None = None
    suggested_pairings: str | None = None
    image_path: str | None = None
    tags: list[TagOut] = []

    model_config = {"from_attributes": True}


class BottleCreate(BaseModel):
    name: str
    type: BottleType
    quantity: float = 1.0
    purchase_price_kr: float | None = None
    producer: str | None = None
    subtype: str | None = None
    vintage: int | None = None
    region: str | None = None
    country: str | None = None
    grape_or_base: str | None = None
    abv: float | None = None
    sugar_content_g_per_100ml: float | None = None
    volume_ml: int | None = None
    purchase_date: date | None = None
    source_shop: str | None = None
    barcode: str | None = None
    serving_temp: str | None = None
    drink_window_start: date | None = None
    drink_window_end: date | None = None
    awards_scores: str | None = None
    notes: str | None = None
    suggested_pairings: str | None = None
    tag_ids: list[uuid.UUID] = []


class BottleUpdate(BaseModel):
    name: str | None = None
    producer: str | None = None
    type: BottleType | None = None
    subtype: str | None = None
    vintage: int | None = None
    region: str | None = None
    country: str | None = None
    grape_or_base: str | None = None
    abv: float | None = None
    sugar_content_g_per_100ml: float | None = None
    volume_ml: int | None = None
    purchase_price_kr: float | None = None
    purchase_date: date | None = None
    source_shop: str | None = None
    quantity: float | None = None
    status: BottleStatus | None = None
    barcode: str | None = None
    enrichment_status: EnrichmentStatus | None = None
    serving_temp: str | None = None
    drink_window_start: date | None = None
    drink_window_end: date | None = None
    awards_scores: str | None = None
    notes: str | None = None
    suggested_pairings: str | None = None
    tag_ids: list[uuid.UUID] | None = None


class QuantityAdjust(BaseModel):
    quantity: float
