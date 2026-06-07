# /// script
# requires-python = ">=3.12"
# dependencies = ["fastmcp>=2.0", "httpx>=0.28"]
# ///

import os
import re
import time

import httpx
from fastmcp import FastMCP

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def _validate_uuid(value: str, name: str = "id") -> None:
    if not _UUID_RE.match(value):
        raise ValueError(f"Invalid {name}: must be a UUID")


def _validate_tag_ids(tag_ids: list[str] | None) -> None:
    if tag_ids:
        for tid in tag_ids:
            _validate_uuid(tid, "tag_id")

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5177")

# --- Auth (env-gated; without these vars the server runs open, as before) ---
# MCP_OIDC_ISSUER   issuer URL of the *MCP* Authentik provider (per-provider in
#                   Authentik — NOT the same as the web app's OIDC_ISSUER)
# MCP_OIDC_AUDIENCE expected `aud` claim (e.g. the MCP provider's client ID)
# MCP_BASE_URL      this server's public base URL (e.g. https://mcp.cellarbar.azarea.dev)
# MCP_SERVICE_TOKEN shared secret the backend accepts for on-behalf-of calls
MCP_OIDC_ISSUER = os.environ.get("MCP_OIDC_ISSUER")
MCP_OIDC_AUDIENCE = os.environ.get("MCP_OIDC_AUDIENCE")
MCP_BASE_URL = os.environ.get("MCP_BASE_URL")
MCP_SERVICE_TOKEN = os.environ.get("MCP_SERVICE_TOKEN")

_auth = None
if MCP_OIDC_ISSUER and MCP_OIDC_AUDIENCE and MCP_BASE_URL:
    from fastmcp.server.auth import RemoteAuthProvider
    from fastmcp.server.auth.providers.jwt import JWTVerifier

    issuer = MCP_OIDC_ISSUER.rstrip("/")
    # Retry discovery: at `docker compose up` Authentik may not be healthy yet,
    # and a crash here would take the MCP server down with it.
    for attempt in range(5):
        try:
            resp = httpx.get(
                f"{issuer}/.well-known/openid-configuration", timeout=10
            )
            resp.raise_for_status()
            discovery = resp.json()
            break
        except (httpx.HTTPError, ValueError):
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    _auth = RemoteAuthProvider(
        token_verifier=JWTVerifier(
            jwks_uri=discovery["jwks_uri"],
            issuer=discovery["issuer"],
            audience=MCP_OIDC_AUDIENCE,
        ),
        authorization_servers=[issuer],
        base_url=MCP_BASE_URL,
    )


def _auth_headers() -> dict:
    """Service token + on-behalf-of identity for backend calls.

    The validated client JWT is never forwarded (MCP spec forbids passthrough);
    instead the backend trusts X-On-Behalf-Of only alongside the service token.
    """
    headers = {}
    if MCP_SERVICE_TOKEN:
        headers["Authorization"] = f"Bearer {MCP_SERVICE_TOKEN}"
    if _auth is not None:
        from fastmcp.server.dependencies import get_access_token

        try:
            token = get_access_token()
        except Exception:
            token = None
        claims = getattr(token, "claims", None) or {}
        email = claims.get("email")
        if email:
            headers["X-On-Behalf-Of"] = email
    return headers


mcp = FastMCP(
    auth=_auth,
    name="CellarBar",
    instructions="""You are a sommelier and bar assistant for a home wine and spirits collection.
    You can search the collection, add bottles, log tastings, check what cocktails can be made,
    manage the shopping list, track pantry items, check alerts for low stock and drink windows,
    and get shopping suggestions for unlocking more cocktail recipes.
    Use get_full_inventory() for complex questions about the collection.
    Measurements: cl for cocktails, ml for bottles, kr for prices. Ratings are 0-10 (0-5 half-stars).""",
)


# Shared client: connection pooling/keep-alive across tool calls.
# Auth headers are per-request — the on-behalf-of identity varies per caller.
_client = httpx.Client(base_url=BACKEND_URL, timeout=10)


def _get(path: str):
    r = _client.get(path, headers=_auth_headers())
    r.raise_for_status()
    return r.json()


def _post(path: str, json=None, cookies=None):
    r = _client.post(path, json=json, cookies=cookies, headers=_auth_headers())
    r.raise_for_status()
    return r.json()


def _patch(path: str, json=None):
    r = _client.patch(path, json=json, headers=_auth_headers())
    r.raise_for_status()
    return r.json()


def _delete(path: str):
    r = _client.delete(path, headers=_auth_headers())
    r.raise_for_status()
    return {"ok": True}


# --- Bulk / Context Tools ---

@mcp.tool
def get_full_inventory() -> dict:
    """Get the complete inventory with all bottles, tags, tasting notes, and quantities.
    Use this for complex questions like 'what wine should I open tonight?' or
    'what do we have from France?'. Returns everything so you can reason over it."""
    return _get("/api/export/full-inventory")


@mcp.tool
def get_full_cocktail_library() -> dict:
    """Get all cocktail recipes with ingredients, ratings, and notes."""
    return _get("/api/export/full-cocktails")


# --- Users ---

@mcp.tool
def list_users() -> list:
    """List all user profiles."""
    return _get("/api/users")


@mcp.tool
def create_user(name: str) -> dict:
    """Create a new user profile."""
    return _post("/api/users", json={"name": name})


@mcp.tool
def update_user(
    user_id: str,
    name: str | None = None,
    display_name: str | None = None,
) -> dict:
    """Update a user profile. Pass only fields to change."""
    _validate_uuid(user_id, "user_id")
    data: dict = {}
    if name is not None:
        data["name"] = name
    if display_name is not None:
        data["display_name"] = display_name
    return _patch(f"/api/users/{user_id}", json=data)


@mcp.tool
def delete_user(user_id: str) -> dict:
    """Delete a user profile. Their tasting notes will be permanently deleted."""
    _validate_uuid(user_id, "user_id")
    return _delete(f"/api/users/{user_id}")


# --- Inventory ---

@mcp.tool
def search_bottles(
    query: str = "",
    type: str = "",
    status: str = "in_stock",
    region: str = "",
    country: str = "",
    subtype: str = "",
    tag_ids: str = "",
    min_price: float | None = None,
    max_price: float | None = None,
) -> list:
    """Search bottles by name. Optionally filter by type (wine/spirit/liqueur/beer/other),
    status (in_stock/consumed/gifted), region, country, subtype, tag_ids (comma-separated),
    min_price and max_price (in kr)."""
    params = []
    if query:
        params.append(f"search={query}")
    if type:
        params.append(f"type={type}")
    if status:
        params.append(f"status={status}")
    if region:
        params.append(f"region={region}")
    if country:
        params.append(f"country={country}")
    if subtype:
        params.append(f"subtype={subtype}")
    if tag_ids:
        params.append(f"tag_ids={tag_ids}")
    if min_price is not None:
        params.append(f"min_price={min_price}")
    if max_price is not None:
        params.append(f"max_price={max_price}")
    path = "/api/bottles" + ("?" + "&".join(params) if params else "")
    return _get(path)


@mcp.tool
def get_bottle(bottle_id: str) -> dict:
    """Get full details for a specific bottle by ID."""
    _validate_uuid(bottle_id, "bottle_id")
    return _get(f"/api/bottles/{bottle_id}")


@mcp.tool
def add_bottle(
    name: str,
    type: str,
    quantity: float = 1.0,
    purchase_price_kr: float | None = None,
    producer: str | None = None,
    subtype: str | None = None,
    vintage: int | None = None,
    region: str | None = None,
    country: str | None = None,
    grape_or_base: str | None = None,
    abv: float | None = None,
    volume_ml: int | None = None,
    barcode: str | None = None,
    notes: str | None = None,
    serving_temp: str | None = None,
    suggested_pairings: str | None = None,
    enrichment_status: str | None = None,
    tag_ids: list[str] | None = None,
) -> dict:
    """Add a new bottle to the collection. Type must be: wine, spirit, liqueur, beer, or other.
    Only name and type are required; fill in what you know.
    tag_ids: list of tag UUIDs to assign (ingredient/flavor/type tags for cocktail matching).
    Set enrichment_status to 'manual' or 'confirmed' to skip the enrichment queue."""
    _validate_tag_ids(tag_ids)
    data = {"name": name, "type": type, "quantity": quantity}
    for field in ["purchase_price_kr", "producer", "subtype", "vintage", "region",
                  "country", "grape_or_base", "abv", "volume_ml", "barcode", "notes",
                  "serving_temp", "suggested_pairings", "enrichment_status", "tag_ids"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    return _post("/api/bottles", json=data)


@mcp.tool
def update_bottle(
    bottle_id: str,
    name: str | None = None,
    producer: str | None = None,
    type: str | None = None,
    subtype: str | None = None,
    vintage: int | None = None,
    region: str | None = None,
    country: str | None = None,
    grape_or_base: str | None = None,
    abv: float | None = None,
    volume_ml: int | None = None,
    purchase_price_kr: float | None = None,
    barcode: str | None = None,
    notes: str | None = None,
    serving_temp: str | None = None,
    suggested_pairings: str | None = None,
    enrichment_status: str | None = None,
    status: str | None = None,
    tag_ids: list[str] | None = None,
) -> dict:
    """Update any fields on a bottle. Pass only the fields you want to change.
    Type: wine/spirit/liqueur/beer/other. Status: in_stock/consumed/gifted.
    tag_ids: list of tag UUIDs to assign (replaces existing tags)."""
    _validate_uuid(bottle_id, "bottle_id")
    _validate_tag_ids(tag_ids)
    updates = {}
    for field in ["name", "producer", "type", "subtype", "vintage", "region", "country",
                  "grape_or_base", "abv", "volume_ml", "purchase_price_kr", "barcode",
                  "notes", "serving_temp", "suggested_pairings", "enrichment_status", "status", "tag_ids"]:
        val = locals()[field]
        if val is not None:
            updates[field] = val
    return _patch(f"/api/bottles/{bottle_id}", json=updates)


@mcp.tool
def adjust_quantity(bottle_id: str, quantity: float) -> dict:
    """Adjust a bottle's quantity. Set to 0 to mark as consumed."""
    _validate_uuid(bottle_id, "bottle_id")
    return _post(f"/api/bottles/{bottle_id}/adjust", json={"quantity": quantity})


@mcp.tool
def delete_bottle(bottle_id: str) -> dict:
    """Permanently delete a bottle from the collection."""
    _validate_uuid(bottle_id, "bottle_id")
    return _delete(f"/api/bottles/{bottle_id}")


# --- Tags ---

@mcp.tool
def list_tags() -> list:
    """List all tags. Tags have a category: flavor, type, or ingredient.
    Tags are used for cocktail ingredient matching and bottle categorization."""
    return _get("/api/tags")


@mcp.tool
def add_tag(name: str, category: str) -> dict:
    """Create a new tag. Category must be: flavor, type, or ingredient.
    Use 'ingredient' for cocktail recipe matching (e.g. 'gin', 'campari', 'lime-juice').
    Use 'flavor' for tasting profiles (e.g. 'fruity', 'spicy').
    Use 'type' for classification (e.g. 'navy-strength', 'single-malt')."""
    return _post("/api/tags", json={"name": name, "category": category})


# --- Tastings ---

@mcp.tool
def log_tasting(
    bottle_id: str,
    user_name: str,
    rating: int,
    notes: str = "",
    food_pairing: str = "",
    pairing_rating: int | None = None,
    would_drink_again: bool | None = None,
    occasion: str = "",
) -> dict:
    """Log a tasting note. Rating is 0-10 (displayed as 0-5 half-stars).
    User name must match an existing user.
    Pairing rating is also 0-10."""
    users = _get("/api/users")
    user = next((u for u in users if u["name"].lower() == user_name.lower()), None)
    if not user:
        return {"error": f"User '{user_name}' not found. Available: {[u['name'] for u in users]}"}

    data = {
        "bottle_id": bottle_id,
        "rating": rating,
        "notes": notes,
        "food_pairing": food_pairing,
        "occasion": occasion,
    }
    if pairing_rating is not None:
        data["pairing_rating"] = pairing_rating
    if would_drink_again is not None:
        data["would_drink_again"] = would_drink_again

    return _post("/api/tastings", json=data, cookies={"cellarbar_user": user["id"]})


@mcp.tool
def get_tasting_history(bottle_id: str = "", user_name: str = "") -> list:
    """Get tasting history. Filter by bottle_id and/or user_name."""
    params = []
    if bottle_id:
        params.append(f"bottle_id={bottle_id}")
    if user_name:
        users = _get("/api/users")
        user = next((u for u in users if u["name"].lower() == user_name.lower()), None)
        if user:
            params.append(f"user_id={user['id']}")
    path = "/api/tastings" + ("?" + "&".join(params) if params else "")
    return _get(path)


# --- Cocktails ---

@mcp.tool
def get_makeable_cocktails() -> list:
    """Get cocktails that can be made with current inventory and pantry items."""
    return _get("/api/cocktails/makeable")


@mcp.tool
def get_cocktail(recipe_id: str) -> dict:
    """Get a cocktail recipe by ID."""
    return _get(f"/api/cocktails/{recipe_id}")


@mcp.tool
def add_cocktail(
    name: str,
    ingredients_json: str,
    description: str | None = None,
    method: str | None = None,
    glass_type: str | None = None,
    garnish: str | None = None,
    difficulty: str | None = None,
    rating: int | None = None,
    would_make_again: bool | None = None,
    notes: str | None = None,
) -> dict:
    """Add a cocktail recipe.
    ingredients_json: JSON array of ingredients, each with 'name' (required),
    'amount_cl' (float), 'tag_id' (for inventory matching), 'is_pantry_item' (bool).
    Example: [{"name": "London Dry Gin", "amount_cl": 6, "tag_id": "uuid"}, {"name": "Tonic", "is_pantry_item": true}]
    method: shake/stir/build/blend. difficulty: easy/medium/advanced."""
    import json
    data: dict = {"name": name, "ingredients": json.loads(ingredients_json)}
    for field in ["description", "method", "glass_type", "garnish", "difficulty",
                  "rating", "would_make_again", "notes"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    return _post("/api/cocktails", json=data)


@mcp.tool
def update_cocktail(
    recipe_id: str,
    name: str | None = None,
    ingredients_json: str | None = None,
    description: str | None = None,
    method: str | None = None,
    glass_type: str | None = None,
    garnish: str | None = None,
    difficulty: str | None = None,
    rating: int | None = None,
    would_make_again: bool | None = None,
    notes: str | None = None,
) -> dict:
    """Update a cocktail recipe. Pass only fields to change.
    ingredients_json replaces all ingredients if provided (same format as add_cocktail)."""
    import json
    updates: dict = {}
    for field in ["name", "description", "method", "glass_type", "garnish",
                  "difficulty", "rating", "would_make_again", "notes"]:
        val = locals()[field]
        if val is not None:
            updates[field] = val
    if ingredients_json is not None:
        updates["ingredients"] = json.loads(ingredients_json)
    return _patch(f"/api/cocktails/{recipe_id}", json=updates)


@mcp.tool
def delete_cocktail(recipe_id: str) -> dict:
    """Delete a cocktail recipe."""
    return _delete(f"/api/cocktails/{recipe_id}")


# --- Shopping ---

@mcp.tool
def get_shopping_list() -> list:
    """Get the current shopping list (items not yet bought)."""
    return _get("/api/shopping")


@mcp.tool
def add_to_shopping_list(name: str, barcode: str = "") -> dict:
    """Add an item to the shopping list."""
    data = {"name": name, "source": "manual"}
    if barcode:
        data["barcode"] = barcode
        data["source"] = "scan"
    return _post("/api/shopping", json=data)


@mcp.tool
def mark_shopping_item_bought(item_id: str) -> dict:
    """Mark a shopping list item as bought."""
    return _patch(f"/api/shopping/{item_id}", json={"is_bought": True})


@mcp.tool
def delete_shopping_item(item_id: str) -> dict:
    """Remove an item from the shopping list."""
    return _delete(f"/api/shopping/{item_id}")


# --- Pantry ---

@mcp.tool
def get_pantry_items() -> list:
    """Get all pantry items (mixers, garnishes, etc.) with their in-stock status."""
    return _get("/api/pantry")


@mcp.tool
def add_pantry_item(
    name: str,
    tag_id: str | None = None,
    in_stock: bool = True,
) -> dict:
    """Add a new pantry item. Optionally link to a tag for cocktail matching."""
    data = {"name": name, "in_stock": in_stock}
    if tag_id is not None:
        data["tag_id"] = tag_id
    return _post("/api/pantry", json=data)


@mcp.tool
def update_pantry_item(
    item_id: str,
    name: str | None = None,
    in_stock: bool | None = None,
) -> dict:
    """Update a pantry item's name or in-stock status."""
    updates = {}
    if name is not None:
        updates["name"] = name
    if in_stock is not None:
        updates["in_stock"] = in_stock
    return _patch(f"/api/pantry/{item_id}", json=updates)


# --- Alerts ---

@mcp.tool
def get_alerts(
    low_stock_threshold: float = 0.25,
    drink_window_days: int = 90,
) -> dict:
    """Get alerts for low-stock bottles and bottles approaching their drink window.
    low_stock_threshold: quantity at or below which a bottle is considered low (default 0.25).
    drink_window_days: days within which a bottle's drink window closes (default 90)."""
    params = f"low_stock_threshold={low_stock_threshold}&drink_window_days={drink_window_days}"
    return _get(f"/api/alerts?{params}")


# --- Shopping Suggestions ---

@mcp.tool
def get_shopping_suggestions() -> dict:
    """Get cocktail-based shopping suggestions — items you could buy to unlock
    more cocktail recipes based on your current inventory and pantry."""
    return _get("/api/cocktails/shopping-suggestions")


# --- Enrichment ---

@mcp.tool
def get_enrichment_queue() -> list:
    """Get bottles with pending enrichment that need more data."""
    all_bottles = _get("/api/bottles?status=in_stock")
    return [b for b in all_bottles if b.get("enrichment_status") == "pending"]


@mcp.tool
def enrich_bottle(
    bottle_id: str,
    producer: str | None = None,
    region: str | None = None,
    country: str | None = None,
    grape_or_base: str | None = None,
    abv: float | None = None,
    volume_ml: int | None = None,
    subtype: str | None = None,
    serving_temp: str | None = None,
    suggested_pairings: str | None = None,
    notes: str | None = None,
    tag_ids: list[str] | None = None,
) -> dict:
    """Update a bottle with enrichment data after researching it.
    Call this after getting user confirmation. Sets enrichment_status to 'claude_enriched'.
    tag_ids: list of tag UUIDs for ingredient/flavor tags (enables cocktail matching)."""
    _validate_uuid(bottle_id, "bottle_id")
    _validate_tag_ids(tag_ids)
    data = {"enrichment_status": "claude_enriched"}
    for field in ["producer", "region", "country", "grape_or_base", "abv",
                  "volume_ml", "subtype", "serving_temp", "suggested_pairings", "notes", "tag_ids"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    return _patch(f"/api/bottles/{bottle_id}", json=data)


@mcp.tool
def get_cocktail_enrichment_queue() -> list:
    """Get cocktail recipes with pending enrichment that need more data.
    These are stub recipes where the user just saved a name and wants Claude to fill in
    description, method, glass type, garnish, difficulty, ingredients, etc."""
    all_cocktails = _get("/api/cocktails")
    return [c for c in all_cocktails if c.get("enrichment_status") == "pending"]


@mcp.tool
def enrich_cocktail(
    recipe_id: str,
    description: str | None = None,
    method: str | None = None,
    glass_type: str | None = None,
    garnish: str | None = None,
    difficulty: str | None = None,
    ingredients_json: str | None = None,
    notes: str | None = None,
    rating: int | None = None,
) -> dict:
    """Enrich a cocktail recipe with full details after researching it.
    Call this after getting user confirmation. Sets enrichment_status to 'claude_enriched'.
    ingredients_json: JSON array of objects with keys: name, amount_cl, tag_id, is_pantry_item."""
    import json
    _validate_uuid(recipe_id, "recipe_id")
    data: dict = {"enrichment_status": "claude_enriched"}
    for field in ["description", "method", "glass_type", "garnish", "difficulty", "notes", "rating"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    if ingredients_json is not None:
        data["ingredients"] = json.loads(ingredients_json)
    return _patch(f"/api/cocktails/{recipe_id}", json=data)


# --- Export ---

@mcp.tool
def export_markdown(type: str = "wine") -> dict:
    """Generate markdown export. Type: 'wine' for wine inventory guide, 'bar' for home bar inventory."""
    return _get(f"/api/export/markdown/{type}")


if __name__ == "__main__":
    transport = os.environ.get("MCP_TRANSPORT", "stdio")
    if transport == "http":
        mcp.run(
            transport="http",
            host="0.0.0.0",
            port=5178,
            path="/mcp",
        )
    else:
        mcp.run(transport="stdio")
