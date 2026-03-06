import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    user = User(name=data.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str, response: Response, db: Session = Depends(get_db)):
    user = db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    response.delete_cookie("cellarbar_user")


@router.post("/{user_id}/select")
def select_user(user_id: str, response: Response, db: Session = Depends(get_db)):
    user = db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    response.set_cookie(
        key="cellarbar_user",
        value=str(user.id),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
    )
    return {"message": f"Switched to {user.name}"}


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user
