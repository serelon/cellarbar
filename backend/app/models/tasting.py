import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid


class TastingNote(Base):
    __tablename__ = "tasting_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    bottle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bottles.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tasted_at: Mapped[date] = mapped_column(Date, default=lambda: date.today())
    occasion: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(Integer)  # 0-10, displayed as 0-5 half-stars
    food_pairing: Mapped[str | None] = mapped_column(Text)
    pairing_rating: Mapped[int | None] = mapped_column(Integer)  # 0-10
    would_drink_again: Mapped[bool | None] = mapped_column(Boolean)

    bottle = relationship("Bottle", back_populates="tasting_notes")
    user = relationship("User", back_populates="tasting_notes")
