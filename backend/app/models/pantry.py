import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200))
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tags.id"))

    tag = relationship("Tag", lazy="selectin")
