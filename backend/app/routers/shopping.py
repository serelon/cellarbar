import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.shopping import ShoppingListItem
from app.schemas.shopping import ShoppingItemCreate, ShoppingItemOut, ShoppingItemUpdate

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


@router.get("", response_model=list[ShoppingItemOut])
def list_shopping(show_bought: bool = False, db: Session = Depends(get_db)):
    q = db.query(ShoppingListItem)
    if not show_bought:
        q = q.filter(ShoppingListItem.is_bought == False)
    return q.order_by(ShoppingListItem.added_at.desc()).all()


@router.post("", response_model=ShoppingItemOut, status_code=201)
def add_shopping_item(data: ShoppingItemCreate, db: Session = Depends(get_db)):
    item = ShoppingListItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ShoppingItemOut)
def update_shopping_item(item_id: str, data: ShoppingItemUpdate, db: Session = Depends(get_db)):
    item = db.get(ShoppingListItem, uuid.UUID(item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_shopping_item(item_id: str, db: Session = Depends(get_db)):
    item = db.get(ShoppingListItem, uuid.UUID(item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


@router.delete("", status_code=204)
def clear_bought(db: Session = Depends(get_db)):
    db.query(ShoppingListItem).filter(ShoppingListItem.is_bought == True).delete()
    db.commit()
