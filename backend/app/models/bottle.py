import uuid
import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Column, Date, DateTime, Enum, Float, ForeignKey,
    Integer, String, Table, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

bottle_tags = Table(
    "bottle_tags",
    Base.metadata,
    Column("bottle_id", ForeignKey("bottles.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class BottleType(str, enum.Enum):
    wine = "wine"
    spirit = "spirit"
    liqueur = "liqueur"
    beer = "beer"
    other = "other"


class BottleStatus(str, enum.Enum):
    in_stock = "in_stock"
    consumed = "consumed"
    gifted = "gifted"


class EnrichmentStatus(str, enum.Enum):
    pending = "pending"
    auto_enriched = "auto_enriched"
    claude_enriched = "claude_enriched"
    manual = "manual"
    confirmed = "confirmed"


class Bottle(Base, TimestampMixin):
    __tablename__ = "bottles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(300))
    producer: Mapped[str | None] = mapped_column(String(300))
    type: Mapped[BottleType] = mapped_column(Enum(BottleType, native_enum=False))
    subtype: Mapped[str | None] = mapped_column(String(100))
    vintage: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String(200))
    country: Mapped[str | None] = mapped_column(String(100))
    grape_or_base: Mapped[str | None] = mapped_column(String(200))
    abv: Mapped[float | None] = mapped_column(Float)
    sugar_content_g_per_100ml: Mapped[float | None] = mapped_column(Float)
    volume_ml: Mapped[int | None] = mapped_column(Integer)
    purchase_price_kr: Mapped[float | None] = mapped_column(Float)
    purchase_date: Mapped[date | None] = mapped_column(Date)
    source_shop: Mapped[str | None] = mapped_column(String(200))
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    quantity_purchased: Mapped[float | None] = mapped_column(Float)
    status: Mapped[BottleStatus] = mapped_column(
        Enum(BottleStatus, native_enum=False), default=BottleStatus.in_stock
    )
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    barcode: Mapped[str | None] = mapped_column(String(50))
    enrichment_status: Mapped[EnrichmentStatus] = mapped_column(
        Enum(EnrichmentStatus, native_enum=False), default=EnrichmentStatus.pending
    )
    serving_temp: Mapped[str | None] = mapped_column(String(50))
    drink_window_start: Mapped[date | None] = mapped_column(Date)
    drink_window_end: Mapped[date | None] = mapped_column(Date)
    awards_scores: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    suggested_pairings: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500))

    tags = relationship("Tag", secondary=bottle_tags, lazy="selectin")
    tasting_notes = relationship("TastingNote", back_populates="bottle", lazy="selectin")
