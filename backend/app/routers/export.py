from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus
from app.models.cocktail import CocktailRecipe
from app.models.shopping import ShoppingListItem
from app.models.pantry import PantryItem
from app.schemas.bottle import BottleOut
from app.schemas.cocktail import CocktailOut
from app.schemas.shopping import ShoppingItemOut
from app.schemas.pantry import PantryItemOut

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/full-inventory")
def full_inventory(db: Session = Depends(get_db)):
    bottles = db.query(Bottle).all()
    return {
        "bottles": [BottleOut.model_validate(b).model_dump(mode="json") for b in bottles],
        "total_count": len(bottles),
        "in_stock": sum(1 for b in bottles if b.status.value == "in_stock"),
    }


@router.get("/full-cocktails")
def full_cocktails(db: Session = Depends(get_db)):
    recipes = db.query(CocktailRecipe).all()
    return {
        "recipes": [CocktailOut.model_validate(r).model_dump(mode="json") for r in recipes],
        "total_count": len(recipes),
    }


@router.get("/full-shopping")
def full_shopping(db: Session = Depends(get_db)):
    items = db.query(ShoppingListItem).all()
    return {"items": [ShoppingItemOut.model_validate(i).model_dump(mode="json") for i in items]}


@router.get("/full-pantry")
def full_pantry(db: Session = Depends(get_db)):
    items = db.query(PantryItem).all()
    return {"items": [PantryItemOut.model_validate(i).model_dump(mode="json") for i in items]}


@router.get("/markdown/wine")
def export_wine_markdown(db: Session = Depends(get_db)):
    bottles = db.query(Bottle).filter(Bottle.type == "wine").order_by(Bottle.name).all()
    lines = ["# Wine Inventory Guide\n"]
    for b in bottles:
        lines.append(f"## {b.name}")
        if b.producer:
            lines.append(f"**Producer:** {b.producer}")
        if b.vintage:
            lines.append(f"**Vintage:** {b.vintage}")
        if b.region and b.country:
            lines.append(f"**Origin:** {b.region}, {b.country}")
        if b.grape_or_base:
            lines.append(f"**Grape:** {b.grape_or_base}")
        if b.abv:
            lines.append(f"**ABV:** {b.abv}%")
        lines.append(f"**Status:** {b.status.value} | **Qty:** {b.quantity}")
        if b.suggested_pairings:
            lines.append(f"**Pairings:** {b.suggested_pairings}")
        if b.serving_temp:
            lines.append(f"**Serving temp:** {b.serving_temp}")
        if b.notes:
            lines.append(f"**Notes:** {b.notes}")
        tags = [t.name for t in b.tags]
        if tags:
            lines.append(f"**Tags:** {', '.join(tags)}")
        lines.append("")
    return {"markdown": "\n".join(lines), "filename": "wine_inventory_guide.md"}


@router.get("/markdown/bar")
def export_bar_markdown(db: Session = Depends(get_db)):
    bottles = db.query(Bottle).filter(
        Bottle.type.in_(["spirit", "liqueur"]),
        Bottle.status == BottleStatus.in_stock,
    ).order_by(Bottle.type, Bottle.name).all()
    recipes = db.query(CocktailRecipe).all()

    lines = ["# Home Bar Inventory\n"]
    lines.append("## Spirits & Liqueurs\n")
    for b in bottles:
        detail = f"- **{b.name}**"
        if b.subtype:
            detail += f" ({b.subtype})"
        detail += f" — qty: {b.quantity}"
        if b.volume_ml:
            detail += f", {b.volume_ml}ml"
        lines.append(detail)
    lines.append("\n## Cocktail Recipes\n")
    for r in recipes:
        lines.append(f"### {r.name}")
        if r.description:
            lines.append(r.description)
        for ing in r.ingredients:
            amt = f"{ing.amount_cl}cl " if ing.amount_cl else ""
            lines.append(f"- {amt}{ing.name}")
        if r.method:
            lines.append(f"**Method:** {r.method.value}")
        lines.append("")
    return {"markdown": "\n".join(lines), "filename": "Home_Bar_Inventory.md"}
