# CellarBar

A self-hosted web app for tracking a home wine and spirits collection. Two users, shared inventory, individual tasting notes and ratings. Includes a cocktail recipe library with "can I make this tonight?" checks, a pantry tracker, and an MCP server for Claude integration.

## Quick Start

```bash
docker compose up -d postgres backend
```

Then open the frontend dev server:

```bash
cd frontend && npm install && npm run dev
```

App runs at `http://localhost:5173` (dev) with the API at `http://localhost:5177`.

## Stack

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **MCP:** FastMCP (stdio for Claude Desktop, HTTP for Docker)

## Services

| Service  | Port | Description              |
|----------|------|--------------------------|
| postgres | 5433 | PostgreSQL 16            |
| backend  | 5177 | FastAPI                  |
| frontend | 5180 | Nginx (production only)  |
| mcp      | 5178 | MCP server (HTTP mode)   |

## MCP Server

The MCP server provides Claude with full access to the collection. See [`mcp/README.md`](mcp/README.md) for Claude Desktop setup.

## License

MIT
