import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus, BottleType, EnrichmentStatus
from app.models.tag import Tag
from app.schemas.bottle import BottleCreate, BottleOut, BottleUpdate, QuantityAdjust

router = APIRouter(prefix="/api/bottles", tags=["bottles"])


@router.get("", response_model=list[BottleOut])
def list_bottles(
    status: BottleStatus | None = None,
    type: BottleType | None = None,
    search: str | None = None,
    region: str | None = None,
    country: str | None = None,
    subtype: str | None = None,
    tag_ids: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Bottle)
    if status:
        q = q.filter(Bottle.status == status)
    if type:
        q = q.filter(Bottle.type == type)
    if search:
        q = q.filter(Bottle.name.ilike(f"%{search}%"))
    if region:
        q = q.filter(Bottle.region.ilike(f"%{region}%"))
    if country:
        q = q.filter(Bottle.country.ilike(f"%{country}%"))
    if subtype:
        q = q.filter(Bottle.subtype.ilike(f"%{subtype}%"))
    if tag_ids:
        tag_list = [uuid.UUID(t.strip()) for t in tag_ids.split(",") if t.strip()]
        for tid in tag_list:
            q = q.filter(Bottle.tags.any(id=tid))
    if min_price is not None:
        q = q.filter(Bottle.purchase_price_kr >= min_price)
    if max_price is not None:
        q = q.filter(Bottle.purchase_price_kr <= max_price)
    return q.order_by(Bottle.name).all()


@router.get("/{bottle_id}", response_model=BottleOut)
def get_bottle(bottle_id: str, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    return bottle


# Key enrichment fields — if 3+ are filled, the bottle is considered complete
_ENRICHMENT_FIELDS = ("producer", "region", "country", "grape_or_base", "abv")
_ENRICHMENT_THRESHOLD = 3


@router.post("", response_model=BottleOut, status_code=201)
def create_bottle(data: BottleCreate, db: Session = Depends(get_db)):
    fields = data.model_dump(exclude={"tag_ids"})
    fields["quantity_purchased"] = data.quantity

    # Auto-detect enrichment status if not explicitly set
    if data.enrichment_status is None:
        filled = sum(fields.get(f) is not None for f in _ENRICHMENT_FIELDS)
        if filled >= _ENRICHMENT_THRESHOLD:
            fields["enrichment_status"] = EnrichmentStatus.confirmed

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
