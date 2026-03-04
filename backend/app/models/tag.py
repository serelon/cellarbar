import uuid
import enum

from sqlalchemy import String, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class TagCategory(str, enum.Enum):
    flavor = "flavor"
    type = "type"
    ingredient = "ingredient"


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    category: Mapped[TagCategory] = mapped_column(Enum(TagCategory))
