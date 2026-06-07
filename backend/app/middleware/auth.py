import secrets
import uuid

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User


def _service_token_user(
    authorization: str | None,
    on_behalf_of: str | None,
    db: Session,
) -> User | None:
    """Resolve a user from the MCP service-token path (bearer + X-On-Behalf-Of).

    Invalid tokens and unknown on-behalf-of users fail loudly (no silent
    fallback to cookie auth). A valid token *without* X-On-Behalf-Of is the
    deliberate user-less mode (MCP stdio/unauthenticated) and falls through.
    """
    if not settings.mcp_service_token or not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(
        token, settings.mcp_service_token
    ):
        raise HTTPException(status_code=401, detail="Invalid service token")
    if not on_behalf_of:
        return None
    user = db.query(User).filter(User.email == on_behalf_of.lower()).first()
    if not user:
        raise HTTPException(status_code=401, detail="On-behalf-of user not found")
    return user


def get_current_user(
    user_id: str | None = Cookie(None, alias="cellarbar_user"),
    authorization: str | None = Header(None),
    on_behalf_of: str | None = Header(None, alias="X-On-Behalf-Of"),
    db: Session = Depends(get_db),
) -> User:
    svc_user = _service_token_user(authorization, on_behalf_of, db)
    if svc_user:
        return svc_user
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
    authorization: str | None = Header(None),
    on_behalf_of: str | None = Header(None, alias="X-On-Behalf-Of"),
    db: Session = Depends(get_db),
) -> User | None:
    svc_user = _service_token_user(authorization, on_behalf_of, db)
    if svc_user:
        return svc_user
    if not user_id:
        return None
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    return db.get(User, uid)
