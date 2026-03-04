import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class ShoppingSource(str, enum.Enum):
    manual = "manual"
    scan = "scan"
    cocktail = "cocktail"


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(300))
    bottle_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bottles.id", ondelete="SET NULL"))
    barcode: Mapped[str | None] = mapped_column(String(50))
    source: Mapped[ShoppingSource] = mapped_column(Enum(ShoppingSource, native_enum=False), default=ShoppingSource.manual)
    is_bought: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
