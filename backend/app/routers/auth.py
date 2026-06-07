"""OIDC login (Authorization Code + PKCE against Authentik).

All endpoints 404 unless OIDC is configured via env (OIDC_ISSUER,
OIDC_CLIENT_ID, OIDC_CLIENT_SECRET) — local dev keeps profile-pick auth.
"""
import base64
import hashlib
import secrets
import time
from urllib.parse import urlencode, urlparse

import httpx
from authlib.jose import JsonWebToken
from authlib.jose.errors import JoseError
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

_discovery_cache: dict | None = None
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
JWKS_TTL = 3600  # re-fetch hourly so IdP key rotation doesn't break logins

STATE_COOKIE = "cellarbar_oidc"


def _require_oidc():
    if not settings.oidc_enabled:
        raise HTTPException(status_code=404, detail="OIDC not configured")


def _discovery() -> dict:
    global _discovery_cache
    if _discovery_cache is None:
        resp = httpx.get(
            f"{settings.oidc_issuer.rstrip('/')}/.well-known/openid-configuration",
            timeout=10,
        )
        resp.raise_for_status()
        _discovery_cache = resp.json()
    return _discovery_cache


def _jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache is None or time.monotonic() - _jwks_fetched_at > JWKS_TTL:
        resp = httpx.get(_discovery()["jwks_uri"], timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = time.monotonic()
    return _jwks_cache


def _exchange_code(code: str, code_verifier: str) -> dict:
    resp = httpx.post(
        _discovery()["token_endpoint"],
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.oidc_redirect_url,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
            "code_verifier": code_verifier,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _validate_id_token(id_token: str) -> dict:
    jwt = JsonWebToken(["RS256", "ES256"])
    try:
        claims = jwt.decode(
            id_token,
            _jwks(),
            claims_options={
                "iss": {"essential": True, "value": _discovery()["issuer"]},
                "aud": {"essential": True, "value": settings.oidc_client_id},
            },
        )
        claims.validate()
    except JoseError as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {e}")
    return dict(claims)


@router.get("/config")
def auth_config():
    return {"oidc": settings.oidc_enabled}


@router.get("/login")
def login():
    _require_oidc()
    state = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    params = urlencode({
        "response_type": "code",
        "client_id": settings.oidc_client_id,
        "redirect_uri": settings.oidc_redirect_url,
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    resp = RedirectResponse(f"{_discovery()['authorization_endpoint']}?{params}")
    resp.set_cookie(
        key=STATE_COOKIE,
        value=f"{state}.{verifier}",
        httponly=True,
        samesite="lax",
        secure=(settings.oidc_redirect_url or "").startswith("https://"),
        max_age=600,
    )
    return resp


@router.get("/callback")
def callback(
    state: str | None = None,
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    oidc_cookie: str | None = Cookie(None, alias=STATE_COOKIE),
    db: Session = Depends(get_db),
):
    _require_oidc()
    if error:
        raise HTTPException(status_code=400, detail=f"OIDC error: {error_description or error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code parameter")
    if not state:
        raise HTTPException(status_code=400, detail="Missing state parameter")
    if not oidc_cookie or "." not in oidc_cookie:
        raise HTTPException(status_code=400, detail="Missing login state")
    expected_state, verifier = oidc_cookie.split(".", 1)
    if not secrets.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="State mismatch")

    try:
        tokens = _exchange_code(code, verifier)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to exchange authorization code: {e}")
    id_token = tokens.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing id_token in token response")
    claims = _validate_id_token(id_token)

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email claim in ID token")
    email = email.lower()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        username = claims.get("preferred_username") or email.split("@")[0]
        display_name = claims.get("name")
        user = User(
            name=username[:100],
            display_name=display_name[:100] if display_name else None,
            email=email,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    user_id = str(user.id)

    resp = RedirectResponse("/")
    resp.delete_cookie(STATE_COOKIE)
    resp.set_cookie(
        key="cellarbar_user",
        value=user_id,
        httponly=True,
        samesite="lax",
        # secure only when the app is actually served over HTTPS — the stack
        # is plain HTTP until its TLS phase; hardcoding True would break login
        secure=(settings.oidc_redirect_url or "").startswith("https://"),
        max_age=60 * 60 * 24 * 365,
    )
    return resp


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("cellarbar_user")
    end_session = _discovery().get("end_session_endpoint") if settings.oidc_enabled else None
    if end_session and settings.oidc_redirect_url:
        # Send the user back to the app root after IdP logout, not Authentik's page
        parsed = urlparse(settings.oidc_redirect_url)
        separator = "&" if "?" in end_session else "?"
        end_session += separator + urlencode({
            "post_logout_redirect_uri": f"{parsed.scheme}://{parsed.netloc}/",
            # required so the OP can validate the redirect URI against the client
            "client_id": settings.oidc_client_id,
        })
    return {"end_session_endpoint": end_session}
