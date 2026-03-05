# CellarBar — Development Guide

## Project Structure

```
backend/            Python FastAPI backend
  app/
    main.py         App entry, routers, CORS, lifespan seed
    models/         SQLAlchemy models (bottle, cocktail, tasting, tag, pantry, shopping, user)
    schemas/        Pydantic schemas (request/response validation)
    routers/        API route modules (bottles, cocktails, tastings, images, etc.)
    database.py     DB session/engine setup
    seed.py         User seeding on startup
  alembic/          Database migrations
frontend/           React + Vite + TypeScript + Tailwind CSS
  src/
    pages/          Page components (Collection, BottleDetail, Cocktails, Dashboard, etc.)
    components/     Shared components (Layout, StarRating, ImageUpload, BarcodeScanner)
    api/client.ts   API client (JSON + multipart upload)
mcp/                MCP server (FastMCP, standalone script)
  server.py         All MCP tools — proxies to backend API
docs/plans/         Design docs and implementation plans
```

## Running Locally

```bash
# Start backend + database
docker compose up -d postgres backend

# Start frontend dev server
cd frontend && npm run dev
```

- Backend API: http://localhost:5177
- Frontend dev: http://localhost:5173 (binds 0.0.0.0 for LAN access)
- Database: localhost:5433 (cellarbar/cellarbar_dev)

### Alembic migrations (local, outside Docker)

```bash
cd backend
DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" python -m alembic revision --autogenerate -m "description"
DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" python -m alembic upgrade head
```

Inside Docker, migrations run automatically on container start (`alembic upgrade head` in docker-compose command).

## Key Conventions

- **Measurements:** cl for cocktails, ml for bottles, kr for prices
- **Ratings:** 0-10 integer stored, displayed as 0-5 half-stars via StarRating component
- **Quantities:** float (0.1 = nearly empty, 2.0 = two bottles)
- **Auth:** Cookie-based profile-pick (`cellarbar_user` cookie), no passwords. Abstracted for future SSO.
- **Enrichment:** MCP-only (Claude enriches bottles via conversation, no external API keys)
- **Cocktail matching:** Tag-based system — bottles, recipes, and pantry items share tags. A recipe is "makeable" when all its ingredient tags are covered by in-stock bottles or pantry items.
- **Pantry:** Simple in-stock toggle (no quantity tracking)

## Architecture Decisions

### Image handling
- Images stored on filesystem (`/data/images` in Docker, `backend/data/images` locally)
- Upload endpoint at `/api/images` returns path like `/api/images/{uuid}.jpg`
- Models store `image_path` (the API-relative URL), not raw filenames
- Served via FastAPI FileResponse, not a static files middleware
- Frontend uses `<input type="file" capture="environment">` for mobile camera — works over HTTP unlike getUserMedia/WebRTC
- Supported types: JPEG, PNG, WebP; max 10 MB

### Barcode scanning
- Uses Quagga2 (QuaggaJS fork) for client-side barcode reading
- **Known limitation:** getUserMedia requires HTTPS on non-localhost origins (GitHub issue #1)
- BarcodeScanner component shows user-visible error messages for camera failures
- Camera-based scanning only works on localhost or HTTPS; LAN HTTP access will show an error

### Frontend patterns
- No dedicated cocktail detail page — cocktails expand inline on the list page
- Collection view uses tab dividers: Wines | Spirits | Liqueurs | Beer | Other
- Quick-add button in Collection section only (not a global FAB)
- Vite dev server binds to `0.0.0.0` for LAN access from phones/tablets
- API client has separate methods: `get`, `post`, `patch`, `delete`, `upload` (multipart), `downloadMarkdown`

### MCP design philosophy
- Bulk data dumps as primary interface — let Claude reason over full datasets rather than building complex query APIs
- Both web UI and MCP are first-class interfaces for the app

## Database

- PostgreSQL 16, managed via Alembic
- Models split across `backend/app/models/` (one file per entity)
- Migrations in `backend/alembic/versions/`

## API Patterns

- All routes under `/api/`
- Bottles: `/api/bottles` (CRUD + filter by status/type/region/country/subtype/tags/price)
- Cocktails: `/api/cocktails` (CRUD), `/api/cocktails/makeable`, `/api/cocktails/shopping-suggestions`
- Tastings: `/api/tastings`
- Images: `/api/images` (upload POST, serve GET, delete DELETE)
- Tags: `/api/tags`
- Pantry: `/api/pantry`
- Shopping: `/api/shopping`
- Export: `/api/export/markdown/{type}`, `/api/export/full-inventory`
- Alerts: `/api/alerts`
- Barcode: `/api/barcode/{code}`

## Docker

Four services: `postgres`, `backend`, `frontend` (production only), `mcp`

Volumes:
- `pgdata` — PostgreSQL data
- `images` — Uploaded photos (mounted at `/data/images` on backend)

Ports: 5433 (postgres), 5177 (backend), 5180 (frontend/nginx), 5178 (mcp)

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
