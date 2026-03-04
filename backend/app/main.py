from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import users, tags, bottles, tastings, shopping, cocktails, pantry, export, barcode


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.seed import seed_users
    seed_users()
    yield


app = FastAPI(title="Cellar & Bar Tracker", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5177", "http://localhost:5180"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(tags.router)
app.include_router(bottles.router)
app.include_router(tastings.router)
app.include_router(shopping.router)
app.include_router(cocktails.router)
app.include_router(pantry.router)
app.include_router(export.router)
app.include_router(barcode.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
