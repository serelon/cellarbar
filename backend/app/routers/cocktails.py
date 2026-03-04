import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus
from app.models.cocktail import CocktailRecipe, RecipeIngredient
from app.models.pantry import PantryItem
from app.schemas.cocktail import CocktailCreate, CocktailOut, CocktailUpdate

router = APIRouter(prefix="/api/cocktails", tags=["cocktails"])


@router.get("", response_model=list[CocktailOut])
def list_cocktails(db: Session = Depends(get_db)):
    return db.query(CocktailRecipe).order_by(CocktailRecipe.name).all()


@router.get("/makeable", response_model=list[CocktailOut])
def list_makeable(db: Session = Depends(get_db)):
    bottles = db.query(Bottle).filter(
        Bottle.status == BottleStatus.in_stock,
        Bottle.quantity > 0,
    ).all()
    bottle_tag_ids = set()
    for b in bottles:
        for t in b.tags:
            bottle_tag_ids.add(t.id)

    pantry = db.query(PantryItem).filter(PantryItem.in_stock == True).all()
    pantry_tag_ids = {p.tag_id for p in pantry if p.tag_id}

    recipes = db.query(CocktailRecipe).all()
    makeable = []
    for recipe in recipes:
        can_make = True
        for ing in recipe.ingredients:
            if ing.tag_id is None:
                continue
            if ing.is_pantry_item:
                if ing.tag_id not in pantry_tag_ids:
                    can_make = False
                    break
            else:
                if ing.tag_id not in bottle_tag_ids:
                    can_make = False
                    break
        if can_make:
            makeable.append(recipe)
    return makeable


@router.get("/{recipe_id}", response_model=CocktailOut)
def get_cocktail(recipe_id: str, db: Session = Depends(get_db)):
    recipe = db.get(CocktailRecipe, uuid.UUID(recipe_id))
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("", response_model=CocktailOut, status_code=201)
def create_cocktail(data: CocktailCreate, db: Session = Depends(get_db)):
    recipe = CocktailRecipe(
        name=data.name,
        description=data.description,
        method=data.method,
        glass_type=data.glass_type,
        garnish=data.garnish,
        difficulty=data.difficulty,
        rating=data.rating,
        would_make_again=data.would_make_again,
        notes=data.notes,
    )
    for ing_data in data.ingredients:
        recipe.ingredients.append(RecipeIngredient(**ing_data.model_dump()))
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.patch("/{recipe_id}", response_model=CocktailOut)
def update_cocktail(recipe_id: str, data: CocktailUpdate, db: Session = Depends(get_db)):
    recipe = db.get(CocktailRecipe, uuid.UUID(recipe_id))
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    update_data = data.model_dump(exclude_unset=True)
    ingredients_data = update_data.pop("ingredients", None)
    for key, value in update_data.items():
        setattr(recipe, key, value)
    if ingredients_data is not None:
        recipe.ingredients.clear()
        for ing_data in ingredients_data:
            recipe.ingredients.append(RecipeIngredient(**ing_data))
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=204)
def delete_cocktail(recipe_id: str, db: Session = Depends(get_db)):
    recipe = db.get(CocktailRecipe, uuid.UUID(recipe_id))
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()
