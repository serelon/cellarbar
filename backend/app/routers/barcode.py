import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/barcode", tags=["barcode"])


@router.get("/{code}")
async def lookup_barcode(code: str):
    async with httpx.AsyncClient() as client:
        # Try Open Food Facts first
        try:
            r = await client.get(
                f"https://world.openfoodfacts.org/api/v2/product/{code}.json",
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == 1:
                    product = data["product"]
                    return {
                        "found": True,
                        "source": "openfoodfacts",
                        "name": product.get("product_name", ""),
                        "brand": product.get("brands", ""),
                        "categories": product.get("categories", ""),
                        "image_url": product.get("image_url", ""),
                        "alcohol": product.get("alcohol_100g", None),
                    }
        except httpx.TimeoutException:
            pass

        # Fallback: UPCitemdb
        try:
            r = await client.get(
                f"https://api.upcitemdb.com/prod/trial/lookup?upc={code}",
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json()
                items = data.get("items", [])
                if items:
                    item = items[0]
                    return {
                        "found": True,
                        "source": "upcitemdb",
                        "name": item.get("title", ""),
                        "brand": item.get("brand", ""),
                        "categories": item.get("category", ""),
                        "image_url": (item.get("images") or [""])[0] if item.get("images") else "",
                    }
        except httpx.TimeoutException:
            pass

    return {"found": False}
