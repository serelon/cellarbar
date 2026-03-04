import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.bottle import Bottle
from app.models.tasting import TastingNote
from app.models.user import User
from app.schemas.tasting import TastingNoteCreate, TastingNoteOut

router = APIRouter(prefix="/api/tastings", tags=["tastings"])


@router.get("", response_model=list[TastingNoteOut])
def list_tastings(
    bottle_id: str | None = None,
    user_id: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(TastingNote)
    if bottle_id:
        q = q.filter(TastingNote.bottle_id == uuid.UUID(bottle_id))
    if user_id:
        q = q.filter(TastingNote.user_id == uuid.UUID(user_id))
    return q.order_by(TastingNote.tasted_at.desc()).all()


@router.post("", response_model=TastingNoteOut, status_code=201)
def create_tasting(
    data: TastingNoteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bottle = db.get(Bottle, data.bottle_id)
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    note = TastingNote(
        bottle_id=data.bottle_id,
        user_id=user.id,
        tasted_at=data.tasted_at or date.today(),
        occasion=data.occasion,
        notes=data.notes,
        rating=data.rating,
        food_pairing=data.food_pairing,
        pairing_rating=data.pairing_rating,
        would_drink_again=data.would_drink_again,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{tasting_id}", status_code=204)
def delete_tasting(tasting_id: str, db: Session = Depends(get_db)):
    note = db.get(TastingNote, uuid.UUID(tasting_id))
    if not note:
        raise HTTPException(status_code=404, detail="Tasting note not found")
    db.delete(note)
    db.commit()
