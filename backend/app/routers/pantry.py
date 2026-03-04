import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pantry import PantryItem
from app.schemas.pantry import PantryItemCreate, PantryItemOut, PantryItemUpdate

router = APIRouter(prefix="/api/pantry", tags=["pantry"])


@router.get("", response_model=list[PantryItemOut])
def list_pantry(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.name).all()


@router.post("", response_model=PantryItemOut, status_code=201)
def create_pantry_item(data: PantryItemCreate, db: Session = Depends(get_db)):
    item = PantryItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=PantryItemOut)
def update_pantry_item(item_id: str, data: PantryItemUpdate, db: Session = Depends(get_db)):
    item = db.get(PantryItem, uuid.UUID(item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_pantry_item(item_id: str, db: Session = Depends(get_db)):
    item = db.get(PantryItem, uuid.UUID(item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
