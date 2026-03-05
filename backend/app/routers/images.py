import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

IMAGES_DIR = os.environ.get("IMAGES_DIR", "/data/images")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/api/images", tags=["images"])


@router.post("")
async def upload_image(file: UploadFile):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "File too large (max 10 MB)")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }[file.content_type]

    filename = f"{uuid.uuid4().hex}{ext}"
    os.makedirs(IMAGES_DIR, exist_ok=True)
    filepath = os.path.join(IMAGES_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(data)

    return {"path": f"/api/images/{filename}"}


def _safe_filepath(filename: str) -> str:
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    return os.path.join(IMAGES_DIR, filename)


@router.get("/{filename}")
def get_image(filename: str):
    filepath = _safe_filepath(filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Image not found")
    return FileResponse(filepath)


@router.delete("/{filename}", status_code=204)
def delete_image(filename: str):
    filepath = _safe_filepath(filename)
    try:
        os.remove(filepath)
    except OSError:
        pass
