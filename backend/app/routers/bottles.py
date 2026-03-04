import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus, BottleType
from app.models.tag import Tag
from app.schemas.bottle import BottleCreate, BottleOut, BottleUpdate, QuantityAdjust

router = APIRouter(prefix="/api/bottles", tags=["bottles"])


@router.get("", response_model=list[BottleOut])
def list_bottles(
    status: BottleStatus | None = None,
    type: BottleType | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Bottle)
    if status:
        q = q.filter(Bottle.status == status)
    if type:
        q = q.filter(Bottle.type == type)
    if search:
        q = q.filter(Bottle.name.ilike(f"%{search}%"))
    return q.order_by(Bottle.name).all()


@router.get("/{bottle_id}", response_model=BottleOut)
def get_bottle(bottle_id: str, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    return bottle


@router.post("", response_model=BottleOut, status_code=201)
def create_bottle(data: BottleCreate, db: Session = Depends(get_db)):
    fields = data.model_dump(exclude={"tag_ids"})
    fields["quantity_purchased"] = data.quantity
    bottle = Bottle(**fields)
    if data.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all()
        bottle.tags = tags
    db.add(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle


@router.patch("/{bottle_id}", response_model=BottleOut)
def update_bottle(bottle_id: str, data: BottleUpdate, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)
    if "status" in update_data and update_data["status"] != bottle.status:
        update_data["status_changed_at"] = datetime.now(timezone.utc)
    for key, value in update_data.items():
        setattr(bottle, key, value)
    if tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        bottle.tags = tags
    db.commit()
    db.refresh(bottle)
    return bottle


@router.post("/{bottle_id}/adjust", response_model=BottleOut)
def adjust_quantity(bottle_id: str, data: QuantityAdjust, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    bottle.quantity = data.quantity
    if data.quantity <= 0:
        bottle.status = BottleStatus.consumed
        bottle.status_changed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(bottle)
    return bottle


@router.delete("/{bottle_id}", status_code=204)
def delete_bottle(bottle_id: str, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    db.delete(bottle)
    db.commit()
