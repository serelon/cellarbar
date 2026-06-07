"""Tests for OIDC auth endpoints and service-token auth."""
import uuid

import pytest

from app.config import settings
from app.models.user import User


# ---------------------------------------------------------------- mode gating

def test_auth_config_oidc_disabled_by_default(client):
    resp = client.get("/api/auth/config")
    assert resp.status_code == 200
    assert resp.json() == {"oidc": False}


def test_login_unavailable_when_oidc_disabled(client):
    resp = client.get("/api/auth/login", follow_redirects=False)
    assert resp.status_code == 404


def test_callback_unavailable_when_oidc_disabled(client):
    resp = client.get("/api/auth/callback?code=x&state=y", follow_redirects=False)
    assert resp.status_code == 404


def test_auth_config_oidc_enabled(client, oidc_settings):
    resp = client.get("/api/auth/config")
    assert resp.json() == {"oidc": True}


# ---------------------------------------------------------------- login flow

@pytest.fixture
def oidc_settings(monkeypatch):
    monkeypatch.setattr(settings, "oidc_issuer", "https://auth.example.com")
    monkeypatch.setattr(settings, "oidc_client_id", "cellarbar-web")
    monkeypatch.setattr(settings, "oidc_client_secret", "sekrit")
    monkeypatch.setattr(settings, "oidc_redirect_url", "http://testserver/api/auth/callback")
    # pre-seed the discovery cache so no network call happens
    import app.routers.auth as auth_mod
    monkeypatch.setattr(auth_mod, "_discovery_cache", {
        "authorization_endpoint": "https://auth.example.com/authorize",
        "token_endpoint": "https://auth.example.com/token",
        "jwks_uri": "https://auth.example.com/jwks",
        "end_session_endpoint": "https://auth.example.com/end-session",
        "issuer": "https://auth.example.com",
    })
    yield settings


def test_login_redirects_to_idp(client, oidc_settings):
    resp = client.get("/api/auth/login", follow_redirects=False)
    assert resp.status_code == 307
    loc = resp.headers["location"]
    assert loc.startswith("https://auth.example.com/authorize?")
    assert "client_id=cellarbar-web" in loc
    assert "code_challenge=" in loc
    assert "state=" in loc
    assert "cellarbar_oidc" in resp.headers.get("set-cookie", "")


def test_callback_rejects_state_mismatch(client, oidc_settings):
    client.get("/api/auth/login", follow_redirects=False)
    resp = client.get("/api/auth/callback?code=abc&state=WRONG", follow_redirects=False)
    assert resp.status_code == 400


def _do_callback(client, monkeypatch, claims):
    """Drive login → callback with the token exchange + claims mocked."""
    import app.routers.auth as auth_mod

    login = client.get("/api/auth/login", follow_redirects=False)
    state = [p.split("=")[1] for p in login.headers["location"].split("?")[1].split("&")
             if p.startswith("state=")][0]

    def fake_exchange(code, verifier):
        assert code == "abc"
        return {"id_token": "fake"}

    def fake_validate(id_token):
        return claims

    monkeypatch.setattr(auth_mod, "_exchange_code", fake_exchange)
    monkeypatch.setattr(auth_mod, "_validate_id_token", fake_validate)
    return client.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)


def test_callback_creates_user_and_sets_cookie(client, db, oidc_settings, monkeypatch):
    resp = _do_callback(client, monkeypatch, {
        "email": "tess@example.com", "name": "Tess", "preferred_username": "tess",
    })
    assert resp.status_code == 307
    assert resp.headers["location"] == "/"
    user = db.query(User).filter(User.email == "tess@example.com").one()
    assert user.name == "tess"
    assert user.display_name == "Tess"
    assert f"cellarbar_user={user.id}" in resp.headers["set-cookie"]


def test_callback_links_existing_user_by_email(client, db, oidc_settings, monkeypatch):
    existing = User(name="tess", email="tess@example.com")
    db.add(existing)
    db.commit()
    resp = _do_callback(client, monkeypatch, {"email": "tess@example.com", "name": "Tess"})
    assert resp.status_code == 307
    assert db.query(User).count() == 1
    assert f"cellarbar_user={existing.id}" in resp.headers["set-cookie"]


def test_callback_email_match_is_case_insensitive(client, db, oidc_settings, monkeypatch):
    existing = User(name="tess", email="tess@example.com")
    db.add(existing)
    db.commit()
    resp = _do_callback(client, monkeypatch, {"email": "Tess@Example.com", "name": "Tess"})
    assert resp.status_code == 307
    assert db.query(User).count() == 1


def test_callback_requires_email_claim(client, oidc_settings, monkeypatch):
    resp = _do_callback(client, monkeypatch, {"name": "NoEmail"})
    assert resp.status_code == 400


def test_user_model_lowercases_email(db):
    user = User(name="tess", email="Tess@Example.COM")
    db.add(user)
    db.commit()
    assert user.email == "tess@example.com"


def test_callback_idp_error_param(client, oidc_settings):
    client.get("/api/auth/login", follow_redirects=False)
    resp = client.get(
        "/api/auth/callback?state=x&error=access_denied&error_description=User+denied",
        follow_redirects=False,
    )
    assert resp.status_code == 400
    assert "User denied" in resp.json()["detail"]


def test_callback_missing_id_token(client, oidc_settings, monkeypatch):
    import app.routers.auth as auth_mod

    login = client.get("/api/auth/login", follow_redirects=False)
    state = [p.split("=")[1] for p in login.headers["location"].split("?")[1].split("&")
             if p.startswith("state=")][0]
    monkeypatch.setattr(auth_mod, "_exchange_code", lambda c, v: {"access_token": "x"})
    resp = client.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)
    assert resp.status_code == 400


def test_logout_clears_cookie(client, oidc_settings):
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    end_session = resp.json()["end_session_endpoint"]
    assert end_session.startswith("https://auth.example.com/end-session")
    assert "post_logout_redirect_uri=http%3A%2F%2Ftestserver%2F" in end_session
    assert "cellarbar_user=;" in resp.headers["set-cookie"] or 'cellarbar_user="";' in resp.headers["set-cookie"]


# ------------------------------------------------------- service-token auth

@pytest.fixture
def service_token(monkeypatch):
    monkeypatch.setattr(settings, "mcp_service_token", "svc-token-123")


def test_service_token_on_behalf_of(client, db, service_token):
    user = User(name="tess", email="tess@example.com")
    db.add(user)
    db.commit()
    resp = client.get("/api/users/me", headers={
        "Authorization": "Bearer svc-token-123",
        "X-On-Behalf-Of": "tess@example.com",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "tess"


def test_service_token_email_case_insensitive(client, db, service_token):
    user = User(name="tess", email="tess@example.com")
    db.add(user)
    db.commit()
    resp = client.get("/api/users/me", headers={
        "Authorization": "Bearer svc-token-123",
        "X-On-Behalf-Of": "Tess@Example.COM",
    })
    assert resp.status_code == 200


def test_service_token_unknown_email_401(client, service_token):
    resp = client.get("/api/users/me", headers={
        "Authorization": "Bearer svc-token-123",
        "X-On-Behalf-Of": "ghost@example.com",
    })
    assert resp.status_code == 401


def test_wrong_service_token_401(client, service_token):
    resp = client.get("/api/users/me", headers={
        "Authorization": "Bearer WRONG",
        "X-On-Behalf-Of": "tess@example.com",
    })
    assert resp.status_code == 401


def test_service_token_without_header_no_user(client, service_token):
    resp = client.get("/api/users/me", headers={"Authorization": "Bearer svc-token-123"})
    assert resp.status_code == 401
