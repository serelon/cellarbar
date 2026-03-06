import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.cocktail import CocktailMethod, CocktailDifficulty
from app.models.bottle import EnrichmentStatus
from app.schemas.tag import TagOut


class RecipeIngredientOut(BaseModel):
    id: uuid.UUID
    name: str
    amount_cl: float | None = None
    tag_id: uuid.UUID | None = None
    tag: TagOut | None = None
    is_pantry_item: bool

    model_config = {"from_attributes": True}


class RecipeIngredientCreate(BaseModel):
    name: str
    amount_cl: float | None = None
    tag_id: uuid.UUID | None = None
    is_pantry_item: bool = False


class CocktailOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    name: str
    description: str | None = None
    method: CocktailMethod | None = None
    glass_type: str | None = None
    garnish: str | None = None
    difficulty: CocktailDifficulty | None = None
    rating: int | None = None
    would_make_again: bool | None = None
    notes: str | None = None
    image_path: str | None = None
    enrichment_status: EnrichmentStatus | None = None
    ingredients: list[RecipeIngredientOut] = []

    model_config = {"from_attributes": True}


class CocktailCreate(BaseModel):
    name: str
    description: str | None = None
    method: CocktailMethod | None = None
    glass_type: str | None = None
    garnish: str | None = None
    difficulty: CocktailDifficulty | None = None
    rating: int | None = Field(default=None, ge=0, le=10)
    would_make_again: bool | None = None
    notes: str | None = None
    enrichment_status: EnrichmentStatus | None = None
    ingredients: list[RecipeIngredientCreate] = []


class CocktailUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    method: CocktailMethod | None = None
    glass_type: str | None = None
    garnish: str | None = None
    difficulty: CocktailDifficulty | None = None
    rating: int | None = Field(default=None, ge=0, le=10)
    would_make_again: bool | None = None
    notes: str | None = None
    image_path: str | None = None
    enrichment_status: EnrichmentStatus | None = None
    ingredients: list[RecipeIngredientCreate] | None = None
