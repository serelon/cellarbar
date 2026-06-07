import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.models.base import Base, new_uuid


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    image_path: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    tasting_notes = relationship("TastingNote", back_populates="user", cascade="all, delete-orphan")

    @validates("email")
    def _lowercase_email(self, key, value):
        # OIDC login matches by lowercased email; keep stored values consistent.
        # Empty/whitespace → None so the unique constraint allows multiple
        # users with no email.
        if value is None or not value.strip():
            return None
        return value.lower()
