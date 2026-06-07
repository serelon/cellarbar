# OIDC Support — Design

**Date:** 2026-06-07
**Status:** Approved
**Context:** CellarBar runs as a tenant in the E:\Stack homelab behind Traefik
(`cellarbar.localhost`, future `cellarbar.azarea.dev`). Authentik is being deployed
as the stack's IdP. CellarBar's profile-pick cookie auth was always "abstracted for
future SSO" — this is that future.

## Goals

- Replace profile-pick login with Authentik OIDC (web).
- Authenticate MCP clients (Claude) against Authentik; attribute MCP calls to real users.
- Zero-config fallback: without `OIDC_*` env vars, everything behaves exactly as today
  (required — local dev has no Authentik).

## Decisions

| Question | Decision |
|---|---|
| Provider | Authentik (self-hosted, parallel deployment in E:\Stack) |
| Web auth mode | OIDC **replaces** profile-pick when configured; env-gated fallback otherwise |
| User mapping | Match by **email** (new `User.email` column); auto-create on no match |
| Provisioning | Auto-create — access control lives in Authentik |
| MCP | Spec-compliant resource server, NOT token passthrough (forbidden by MCP spec): MCP validates Authentik JWT, then calls backend with service token + `X-On-Behalf-Of: <email>` |
| Session | Keep the existing `cellarbar_user` cookie as the session; `get_current_user` cookie path unchanged |

## Phase 1 — Web OIDC

### Backend

- **`backend/app/routers/auth.py`**
  - `GET /api/auth/login` — build Authentik authorize URL (state + PKCE in short-lived
    signed cookie), 302 redirect.
  - `GET /api/auth/callback` — validate state, exchange code (httpx, server-side),
    verify ID token (authlib, JWKS), extract `email` + `name`; find-or-create user by
    email; set `cellarbar_user` cookie; redirect to `/`.
  - `POST /api/auth/logout` — clear cookie; return Authentik `end_session_endpoint`.
  - `GET /api/auth/config` — public; `{"oidc": bool}` so the frontend adapts.
- **Config:** `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URL`.
  Discovery doc fetched lazily + cached.
- **Library:** `authlib` (token exchange + ID-token validation).
- **Migration:** `User.email: str | None`, unique index.
- **Security:** state (CSRF) + PKCE; cookie stays `httponly` + `samesite=lax`.
  No session table — revocation = delete user (couple-scale).

### Frontend

- Fetch `/api/auth/config` on load; login page is mode-aware:
  - OIDC: "Sign in with Authentik" → `/api/auth/login`; profile-pick + switch-user hidden;
    logout follows end-session URL.
  - Local: today's behavior, unchanged.
- Profile management stays; OIDC claims seed `name`/`display_name` on creation only.

### ⚠ Migration sequencing

Set emails on the 2 existing users **before** the first OIDC login, or email-match
will auto-create duplicate users. (PATCH /api/users/{id} once email is in the schema.)

## Phase 2 — MCP auth

- **MCP server:** env-gated `RemoteAuthProvider(JWTVerifier(jwks_uri, issuer,
  audience="cellarbar-mcp"))` (FastMCP built-ins). Without the env vars: unauthenticated,
  as today (stdio/dev).
- **MCP → backend:** every call sends `Authorization: Bearer ${MCP_SERVICE_TOKEN}` +
  `X-On-Behalf-Of: <email from validated JWT>` (FastMCP `get_access_token()`).
- **Backend middleware:** new path in `get_current_user`/`get_optional_user` —
  bearer matches `MCP_SERVICE_TOKEN` env + on-behalf-of email resolves a user.
  Service token without the header → no user (user-less, as today).
- **Caveat:** Claude clients doing OAuth to an MCP server effectively need HTTPS;
  goes live when the stack's TLS lands. The `mcp-remote` shim era stays unauthenticated
  or service-token-only until then.

## Authentik configuration (runbook, not code)

1. App + OAuth2 provider "cellarbar-web": confidential client, redirect URIs
   `http://cellarbar.localhost/api/auth/callback` (bootstrap) and
   `https://cellarbar.azarea.dev/api/auth/callback`. Scopes: `openid email profile`.
2. Provider "cellarbar-mcp": audience `cellarbar-mcp`; DCR or static client for
   Claude — **verify on deploy** (least-certain corner).
3. Access policies on both apps decide who may log in at all.

## Testing

- pytest: callback logic (mocked token endpoint), email match vs auto-create,
  state mismatch rejection, service-token + on-behalf-of path, mode gating
  (no env → endpoints 404/disabled, old behavior intact).
- Manual e2e against live Authentik for both phases.
