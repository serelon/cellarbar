# Cellar & Bar Tracker — Design Document

## Project Overview

A self-hosted, Dockerized web app for tracking a home wine and liquor collection. Two users (a couple), shared collection, individual tasting notes and ratings. Runs locally on the home network. Responsive web UI (phone, tablet, desktop). Exposes an MCP server for conversational access via Claude.

Both interfaces are first-class: the web UI handles management, browsing, and maintenance tasks; Claude via MCP acts as a conversational sommelier and bar assistant ("I just cooked X, what should I open?").

---

## Architecture

### Docker Compose Stack (4 services)

- **postgres** — PostgreSQL database
- **backend** — Python (FastAPI), REST API, all business logic, database access via SQLAlchemy + Alembic migrations
- **frontend** — React (Vite build), served via nginx or the backend on port `5177`
- **mcp** — FastMCP with Streamable HTTP transport, exposes `/mcp` endpoint on port `5178`

The MCP server shares the Docker network with the backend and calls its REST API directly. Claude connects to the MCP server via URL (`http://localhost:5178/mcp`) — nothing to install on the host.

### Auth

Profile-pick in v1: app loads with "Who's here?" and you tap your name. No password. Session cookie tracks the active user.

Implemented behind an auth middleware abstraction so Google SSO can be swapped in later without touching route logic.

### Enrichment

No server-side AI / no Anthropic API key. Enrichment flow:

1. **Barcode lookup** — backend calls open barcode databases automatically when a barcode is scanned
2. **Claude-assisted** — user asks Claude to enrich bottles from the enrichment queue. Claude researches via web search, proposes structured data through the MCP `enrich_bottle` tool. User confirms before it's saved.
3. **Manual** — user fills in fields directly in the web UI

Human-in-the-loop by design: Claude proposes, user confirms, then it's written.

Each bottle tracks its enrichment source (`pending` / `auto_enriched` / `claude_enriched` / `manual` / `confirmed`).

---

## Data Model

### bottles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| created_at | timestamp | |
| updated_at | timestamp | |
| name | text | Required |
| producer | text | |
| type | enum | wine / spirit / liqueur / beer / other |
| subtype | text | e.g. red, gin, bourbon |
| vintage | int | Nullable |
| region | text | |
| country | text | |
| grape_or_base | text | |
| abv | float | |
| sugar_content_g_per_100ml | float | |
| volume_ml | int | |
| purchase_price_kr | float | |
| purchase_date | date | |
| source_shop | text | |
| quantity | float | e.g. 0.1 for nearly empty, 2.0 for two full bottles |
| quantity_purchased | float | Original amount for consumption tracking |
| status | enum | in_stock / consumed / gifted |
| status_changed_at | timestamp | |
| barcode | text | Nullable |
| enrichment_status | enum | pending / auto_enriched / claude_enriched / manual / confirmed |
| serving_temp | text | |
| drink_window_start | date | |
| drink_window_end | date | |
| awards_scores | text | |
| notes | text | |
| suggested_pairings | text | |

### tags

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Unique, e.g. "gin", "navy-strength", "fruity", "spicy" |
| category | enum | flavor / type / ingredient |

Tags are shared across bottles, recipe ingredients, and pantry items. A tag like "gin" can be both a bottle type-tag and a recipe ingredient-tag.

### bottle_tags

| Column | Type | Notes |
|--------|------|-------|
| bottle_id | uuid | FK → bottles |
| tag_id | uuid | FK → tags |

### tasting_notes

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| bottle_id | uuid | FK → bottles |
| user_id | uuid | FK → users |
| tasted_at | date | |
| occasion | text | Optional |
| notes | text | |
| rating | int | 0–10 (displayed as 0–5 half-stars) |
| food_pairing | text | What was eaten with it |
| pairing_rating | int | 0–10 (separate rating for the food+bottle combo) |
| would_drink_again | bool | |

### cocktail_recipes

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| created_at | timestamp | |
| updated_at | timestamp | |
| name | text | |
| description | text | |
| method | enum | shake / stir / build / blend |
| glass_type | text | |
| garnish | text | |
| difficulty | enum | easy / medium / advanced |
| rating | int | 0–10 (displayed as 0–5 half-stars) |
| would_make_again | bool | |
| notes | text | |

### recipe_ingredients

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| recipe_id | uuid | FK → cocktail_recipes |
| name | text | Display text, e.g. "London Dry Gin" |
| amount_cl | float | Amounts in centiliters |
| tag_id | uuid | Nullable FK → tags. Links to tag for inventory matching |
| is_pantry_item | bool | If true, matched against pantry instead of bottles |

### pantry_items

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | e.g. "Angostura bitters", "Simple syrup", "Limes" |
| in_stock | bool | Simple toggle |
| tag_id | uuid | Nullable FK → tags |

### shopping_list_items

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Display name |
| bottle_id | uuid | Nullable FK → bottles (if from inventory) |
| barcode | text | Nullable (carried over from scanned bottle) |
| source | enum | manual / scan / cocktail |
| is_bought | bool | |
| added_at | timestamp | |

### users

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| created_at | timestamp | |

---

## UI Structure

### Navigation

- **Mobile:** Bottom tab bar
- **Desktop:** Sidebar

### Sections

1. **Dashboard** — Stock summary (count by category), recently added, recently tasted, drink window alerts, low stock warnings, pending enrichment count, cocktails you can make right now
2. **Collection** — Browsable/filterable list with tab dividers: Wines | Spirits | Liqueurs | Beer | Other. Each category has its own filters/sort. Tap for bottle detail page (full info, both users' ratings side by side, tasting history, tags). Quantity adjustment and status changes on detail page. Quick-add button lives here (not global).
3. **Tastings** — Personal tasting log, chronological feed. Start new tasting: pick bottle → star rating → notes → food pairing → pairing rating → would drink again → save.
4. **Cocktails** — Recipe library. "Can make tonight" filter. Shopping list generator ("buy X to unlock Y"). Filter by tags, base spirit, difficulty.
5. **Shopping List** — Standalone view designed for use at the store. Big checkboxes, barcode shown for each item where available.

### Key Interaction Flows

**Quick-add (from Collection):**
Quick-add button → sheet slides up → name, type, quantity, price (minimal fields) → save immediately. Optional "Scan barcode" button in the sheet.

**Scan-to-shopping-list:**
From shopping list → tap scan → camera opens → barcode captured → item added with bottle name if matched in inventory, raw barcode if not.

**Log tasting:**
From bottle detail or Tastings tab → pick bottle (if not in context) → tap stars → write notes → log food pairing → rate pairing → toggle would-drink-again → save.

**Quantity adjustment:**
From bottle detail → preset buttons: "Open one" / "Finish bottle" / "Half left" + freeform "Other" input for custom values.

---

## MCP Server — Tool Design

The backend is a dumb data layer. Claude does the reasoning. Bulk data dumps are the primary interface for complex questions.

### Bulk / Context Tools

- `get_full_inventory()` — dumps all bottles with tags, ratings, tasting notes, quantities. Claude reasons over the full picture.
- `get_full_cocktail_library()` — all recipes with ingredients, ratings, notes.
- `bulk_update_bottles(updates[])` — Claude can make multiple changes in one call after reasoning.

### Inventory

- `search_bottles(query, type?, tags?, status?)` — filtered search for when the collection is large
- `get_bottle(id)` — full detail for one bottle
- `add_bottle(name, type, quantity, ...)` — add via conversation
- `update_bottle(id, ...)` — update any fields
- `adjust_quantity(id, quantity)` — quick quantity change

### Tastings

- `log_tasting(bottle_id, user, rating, notes?, pairing?, pairing_rating?, would_drink_again?)` — log via conversation
- `get_tasting_history(bottle_id?, user?)` — view history

### Cocktails

- `get_makeable_cocktails()` — what can be made with current stock
- `get_cocktail(id)` — recipe detail
- `find_cocktails_by_tag(tags)` — filter by ingredient tags

### Shopping & Pantry

- `get_shopping_list()` — current list
- `add_to_shopping_list(name, barcode?)` — add items

### Enrichment

- `get_enrichment_queue()` — bottles with pending/incomplete data
- `enrich_bottle(id, data)` — write enrichment data after user confirms

### Export

- `export_markdown(type)` — generate wine guide or bar inventory markdown

---

## Feature Tiers

### Tier 1 — Core (must ship)

- Inventory CRUD (add, edit, archive bottles)
- Quick-add flow (minimal fields, save fast)
- Barcode scanning (mobile camera, stores barcode)
- Barcode-to-shopping-list flow (scan empty → add to list)
- Quantity adjustment (preset buttons + freeform)
- Tasting notes & ratings (per user, per bottle)
- Profile-pick auth with middleware abstraction
- Shopping list (manual add, scan add, cocktail-derived, bought toggle)
- Dashboard (stock summary, recent activity, alerts)
- Tag system (shared tags across bottles, recipes, pantry)
- MCP server with bulk dump + all core tools
- Responsive UI (mobile-first, bottom tabs / sidebar)

### Tier 2 — Important (soon after)

- Cocktail recipe library with tag-based ingredient matching
- "Can I make this tonight?" check
- Cocktail shopping list generator ("buy X to unlock Y")
- Pantry item checklist
- Filter/search (by type, region, tags, rating, price, status)
- Drink window alerts
- Low stock warnings
- Markdown export (wine guide + bar inventory)

### Tier 3 — Later

- Bulk CSV/JSON import
- Insights & analytics (consumption trends, spend, pairing patterns)
- Google Drive export
- Google SSO auth upgrade

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | Python + FastAPI | Fits well with MCP tooling, good async support, clean API design |
| Frontend | React + Vite | Largest component ecosystem (star ratings, barcode scanner libs), no SSR needed |
| Database | PostgreSQL | Relational structure fits the data model, Alembic for migrations |
| MCP | FastMCP + Streamable HTTP | Runs inside Docker, no host installation, Claude connects via URL |
| Auth | Profile-pick (v1) | Zero friction for local use, middleware abstraction for future SSO |
| Currency | Single (kr) | Multi-currency adds conversion complexity for marginal value |
| Cocktail matching | Tag-based | More expressive than subtype-only, allows partial/specific matches |
| Pantry tracking | Simple toggle | In-stock yes/no, no quantity tracking |
| Enrichment | MCP-only (no API key) | Human-in-the-loop, no cost, Claude proposes and user confirms |
| Ports | 5177 (web), 5178 (MCP) | Uncommon, unlikely to conflict |

---

## Open Questions for Implementation Planning

- Best open barcode databases for wine/spirits (coverage, API, licensing)
- Specific barcode scanning JS library (quagga2 vs zxing-js vs html5-qrcode)
- React component library choice (shadcn/ui, MUI, Mantine, or lightweight custom)
- FastMCP Streamable HTTP Docker configuration specifics
- Alembic migration strategy (auto-generate vs manual)
