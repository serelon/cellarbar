import os
import httpx
from fastmcp import FastMCP

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5177")

mcp = FastMCP(
    name="CellarBar",
    instructions="""You are a sommelier and bar assistant for a home wine and spirits collection.
    You can search the collection, add bottles, log tastings, check what cocktails can be made,
    and manage the shopping list. Use get_full_inventory() for complex questions about the collection.
    Measurements: cl for cocktails, ml for bottles, kr for prices. Ratings are 0-10 (0-5 half-stars).""",
)


def _get(path: str):
    with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
        r = client.get(path)
        r.raise_for_status()
        return r.json()


def _post(path: str, json=None, cookies=None):
    with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
        r = client.post(path, json=json, cookies=cookies)
        r.raise_for_status()
        return r.json()


def _patch(path: str, json=None):
    with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
        r = client.patch(path, json=json)
        r.raise_for_status()
        return r.json()


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


# --- Inventory ---

@mcp.tool
def search_bottles(query: str = "", type: str = "", status: str = "in_stock") -> list:
    """Search bottles by name. Optionally filter by type (wine/spirit/liqueur/beer/other)
    and status (in_stock/consumed/gifted)."""
    params = []
    if query:
        params.append(f"search={query}")
    if type:
        params.append(f"type={type}")
    if status:
        params.append(f"status={status}")
    path = "/api/bottles" + ("?" + "&".join(params) if params else "")
    return _get(path)


@mcp.tool
def get_bottle(bottle_id: str) -> dict:
    """Get full details for a specific bottle by ID."""
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
) -> dict:
    """Add a new bottle to the collection. Type must be: wine, spirit, liqueur, beer, or other.
    Only name and type are required; fill in what you know."""
    data = {"name": name, "type": type, "quantity": quantity}
    for field in ["purchase_price_kr", "producer", "subtype", "vintage", "region",
                  "country", "grape_or_base", "abv", "volume_ml", "barcode", "notes"]:
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
) -> dict:
    """Update any fields on a bottle. Pass only the fields you want to change.
    Type: wine/spirit/liqueur/beer/other. Status: in_stock/consumed/gifted."""
    updates = {}
    for field in ["name", "producer", "type", "subtype", "vintage", "region", "country",
                  "grape_or_base", "abv", "volume_ml", "purchase_price_kr", "barcode",
                  "notes", "serving_temp", "suggested_pairings", "enrichment_status", "status"]:
        val = locals()[field]
        if val is not None:
            updates[field] = val
    return _patch(f"/api/bottles/{bottle_id}", json=updates)


@mcp.tool
def adjust_quantity(bottle_id: str, quantity: float) -> dict:
    """Adjust a bottle's quantity. Set to 0 to mark as consumed."""
    return _post(f"/api/bottles/{bottle_id}/adjust", json={"quantity": quantity})


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
) -> dict:
    """Update a bottle with enrichment data after researching it.
    Call this after getting user confirmation. Sets enrichment_status to 'claude_enriched'."""
    data = {"enrichment_status": "claude_enriched"}
    for field in ["producer", "region", "country", "grape_or_base", "abv",
                  "volume_ml", "subtype", "serving_temp", "suggested_pairings", "notes"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    return _patch(f"/api/bottles/{bottle_id}", json=data)


# --- Export ---

@mcp.tool
def export_markdown(type: str = "wine") -> dict:
    """Generate markdown export. Type: 'wine' for wine inventory guide, 'bar' for home bar inventory."""
    return _get(f"/api/export/markdown/{type}")


if __name__ == "__main__":
    mcp.run(
        transport="http",
        host="0.0.0.0",
        port=5178,
        path="/mcp",
    )
