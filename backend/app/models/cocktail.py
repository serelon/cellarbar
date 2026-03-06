import uuid
import enum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid
from app.models.bottle import EnrichmentStatus


class CocktailMethod(str, enum.Enum):
    shake = "shake"
    stir = "stir"
    build = "build"
    blend = "blend"


class CocktailDifficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    advanced = "advanced"


class CocktailRecipe(Base, TimestampMixin):
    __tablename__ = "cocktail_recipes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    method: Mapped[CocktailMethod | None] = mapped_column(Enum(CocktailMethod, native_enum=False))
    glass_type: Mapped[str | None] = mapped_column(String(100))
    garnish: Mapped[str | None] = mapped_column(String(200))
    difficulty: Mapped[CocktailDifficulty | None] = mapped_column(Enum(CocktailDifficulty, native_enum=False))
    rating: Mapped[int | None] = mapped_column(Integer)  # 0-10
    would_make_again: Mapped[bool | None] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500))
    enrichment_status: Mapped[EnrichmentStatus | None] = mapped_column(
        Enum(EnrichmentStatus, native_enum=False), default=None
    )

    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan", lazy="selectin")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    recipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cocktail_recipes.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    amount_cl: Mapped[float | None] = mapped_column(Float)
    tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tags.id"))
    is_pantry_item: Mapped[bool] = mapped_column(Boolean, default=False)

    recipe = relationship("CocktailRecipe", back_populates="ingredients")
    tag = relationship("Tag", lazy="selectin")
