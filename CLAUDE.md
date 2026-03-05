# CellarBar — Development Guide

## Project Structure

```
backend/          Python FastAPI backend
  app/
    main.py       App entry, routers, middleware
    models.py     SQLAlchemy models
    routers/      API route modules (bottles, cocktails, tastings, etc.)
  alembic/        Database migrations
frontend/         React + Vite + TypeScript frontend
  src/
    pages/        Page components (Collection, Dashboard, Cocktails, etc.)
    components/   Shared components (Layout, etc.)
    api/client.ts API client
mcp/              MCP server (FastMCP, standalone script)
  server.py       All MCP tools
docs/plans/       Design docs and implementation plans
```

## Running Locally

```bash
# Start backend + database
docker compose up -d postgres backend

# Start frontend dev server
cd frontend && npm run dev
```

- Backend API: http://localhost:5177
- Frontend dev: http://localhost:5173
- Database: localhost:5433 (cellarbar/cellarbar_dev)

## Key Conventions

- **Measurements:** cl for cocktails, ml for bottles, kr for prices
- **Ratings:** 0-10 integer stored, displayed as 0-5 half-stars
- **Quantities:** float (0.1 = nearly empty, 2.0 = two bottles)
- **Auth:** Cookie-based profile-pick (`cellarbar_user` cookie), no passwords
- **Enrichment:** MCP-only (Claude enriches bottles via conversation)
- **Cocktail matching:** Tag-based (shared tags across bottles, recipes, pantry)

## Database

- PostgreSQL 16, managed via Alembic
- Models in `backend/app/models.py`
- Migrations in `backend/alembic/versions/`
- Run migrations: `alembic upgrade head` (runs automatically on container start)

## API Patterns

- All routes under `/api/`
- Bottles: `/api/bottles`, Cocktails: `/api/cocktails`, Tastings: `/api/tastings`
- Export endpoints: `/api/export/markdown/{type}`, `/api/export/full-inventory`
- Alerts: `/api/alerts`

## Git Workflow (Gitflow)

- **`main`** — Production-ready releases only. Never commit directly.
- **`develop`** — Integration branch. Feature branches merge here via PR.
- **Feature branches:** `feature/<name>` off `develop`
- **Bugfix branches:** `fix/<name>` off `develop`
- **Release branches:** `release/<version>` off `develop`, merge to both `main` and `develop`
- **Hotfix branches:** `hotfix/<name>` off `main`, merge to both `main` and `develop`

### Branch naming

```
feature/add-csv-import
fix/quantity-validation
release/1.0.0
hotfix/login-crash
```

### Commit messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`

## Testing

```bash
cd backend && pytest
```

## MCP Server

- Standalone script at `mcp/server.py` with PEP 723 inline metadata
- Run with `uv run mcp/server.py` (auto-installs deps)
- Transport: stdio (default, for Claude Desktop) or HTTP (set `MCP_TRANSPORT=http`)
- All tools proxy to the backend API via httpx
