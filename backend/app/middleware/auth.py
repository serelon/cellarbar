import uuid
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User


def get_current_user(
    user_id: str | None = Cookie(None, alias="cellarbar_user"),
    db: Session = Depends(get_db),
) -> User:
    if not user_id:
        raise HTTPException(status_code=401, detail="No user selected")
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    user_id: str | None = Cookie(None, alias="cellarbar_user"),
    db: Session = Depends(get_db),
) -> User | None:
    if not user_id:
        return None
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    return db.get(User, uid)
