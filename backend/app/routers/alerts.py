from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus
from app.schemas.bottle import BottleOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def get_alerts(
    low_stock_threshold: float = Query(0.25, ge=0),
    drink_window_days: int = Query(90, ge=0),
    db: Session = Depends(get_db),
):
    today = date.today()
    horizon = today + timedelta(days=drink_window_days)

    in_stock = db.query(Bottle).filter(
        Bottle.status == BottleStatus.in_stock,
    ).all()

    past_window = []
    closing_soon = []
    low_stock = []

    for b in in_stock:
        out = BottleOut.model_validate(b).model_dump(mode="json")
        if b.drink_window_end and b.drink_window_end < today:
            past_window.append(out)
        elif b.drink_window_end and b.drink_window_end <= horizon:
            closing_soon.append(out)
        if b.quantity > 0 and b.quantity <= low_stock_threshold:
            low_stock.append(out)

    return {
        "drink_window": {
            "past_window": past_window,
            "closing_soon": closing_soon,
        },
        "low_stock": low_stock,
    }
