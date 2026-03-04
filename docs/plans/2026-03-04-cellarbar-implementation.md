# Cellar & Bar Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted Dockerized web app for tracking a home wine/spirits collection with tasting notes, cocktail recipes, shopping list, and MCP server for Claude access.

**Architecture:** Four-service Docker Compose stack — PostgreSQL, FastAPI backend, React+Vite frontend (served via nginx), FastMCP server with Streamable HTTP transport. Profile-pick auth with middleware abstraction. Backend is a dumb data layer; Claude reasons over bulk dumps via MCP.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (sync), Alembic, PostgreSQL 16, React 18, Vite, Tailwind CSS, Quagga2 (barcode scanning), FastMCP, Docker Compose.

**Design doc:** `docs/plans/2026-03-04-cellarbar-design.md`

---

## Directory Structure

```
cellarbar/
├── docker-compose.yml
├── .gitignore
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── bottle.py
│   │   │   ├── tag.py
│   │   │   ├── tasting.py
│   │   │   ├── cocktail.py
│   │   │   ├── shopping.py
│   │   │   ├── pantry.py
│   │   │   └── user.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── bottle.py
│   │   │   ├── tag.py
│   │   │   ├── tasting.py
│   │   │   ├── cocktail.py
│   │   │   ├── shopping.py
│   │   │   ├── pantry.py
│   │   │   └── user.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── bottles.py
│   │   │   ├── tags.py
│   │   │   ├── tastings.py
│   │   │   ├── cocktails.py
│   │   │   ├── shopping.py
│   │   │   ├── pantry.py
│   │   │   ├── users.py
│   │   │   └── export.py
│   │   └── middleware/
│   │       ├── __init__.py
│   │       └── auth.py
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_bottles.py
│       ├── test_tags.py
│       ├── test_tastings.py
│       ├── test_shopping.py
│       └── test_users.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── api/
│       │   └── client.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── BottomNav.tsx
│       │   ├── Sidebar.tsx
│       │   ├── StarRating.tsx
│       │   └── BarcodeScanner.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Collection.tsx
│       │   ├── BottleDetail.tsx
│       │   ├── QuickAdd.tsx
│       │   ├── Tastings.tsx
│       │   ├── NewTasting.tsx
│       │   ├── Cocktails.tsx
│       │   ├── ShoppingList.tsx
│       │   └── ProfilePick.tsx
│       └── hooks/
│           └── useAuth.ts
├── mcp/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── server.py
└── docs/
    └── plans/
```

---

## Phase 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `backend/pyproject.toml`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `mcp/Dockerfile`
- Create: `mcp/pyproject.toml`

**Step 1: Create `.gitignore`**

```gitignore
__pycache__/
*.pyc
.env
*.egg-info/
dist/
build/
.venv/
node_modules/
frontend/dist/
.pytest_cache/
alembic/versions/__pycache__/
```

**Step 2: Create `.env.example`**

```env
POSTGRES_USER=cellarbar
POSTGRES_PASSWORD=cellarbar_dev
POSTGRES_DB=cellarbar
DATABASE_URL=postgresql://cellarbar:cellarbar_dev@postgres:5432/cellarbar
```

**Step 3: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-cellarbar}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-cellarbar_dev}
      POSTGRES_DB: ${POSTGRES_DB:-cellarbar}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-cellarbar}"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgresql://cellarbar:cellarbar_dev@postgres:5432/cellarbar}
    ports:
      - "5177:8000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "5177:80"
    depends_on:
      - backend

  mcp:
    build: ./mcp
    environment:
      BACKEND_URL: http://backend:8000
    ports:
      - "5178:5178"
    depends_on:
      - backend

volumes:
  pgdata:
```

Note: In dev mode, run frontend via `npm run dev` on host (port 5173) and backend on 5177. In production, nginx serves frontend and proxies `/api` to backend — both on port 5177. The compose file above is the production layout; for dev, comment out the `frontend` service and run it locally.

**Step 4: Create `backend/pyproject.toml`**

```toml
[project]
name = "cellarbar-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "sqlalchemy>=2.0",
    "psycopg2-binary>=2.9",
    "alembic>=1.14",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "python-multipart>=0.0.9",
    "httpx>=0.28",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "httpx>=0.28",
]

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.backends._legacy:_Backend"
```

**Step 5: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 6: Create `frontend/package.json`** (placeholder — will be replaced by `npm create vite` in Task 9)

```json
{
  "name": "cellarbar-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

**Step 7: Create `frontend/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Step 8: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Step 9: Create `mcp/pyproject.toml`**

```toml
[project]
name = "cellarbar-mcp"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastmcp>=2.0",
    "httpx>=0.28",
]

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.backends._legacy:_Backend"
```

**Step 10: Create `mcp/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY . .

EXPOSE 5178
CMD ["python", "server.py"]
```

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Docker Compose, backend, frontend, and MCP service configs"
```

---

### Task 2: Backend Core — Database, Models, Config

**Files:**
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/tag.py`
- Create: `backend/app/models/bottle.py`
- Create: `backend/app/models/tasting.py`
- Create: `backend/app/models/cocktail.py`
- Create: `backend/app/models/shopping.py`
- Create: `backend/app/models/pantry.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

**Step 1: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://cellarbar:cellarbar_dev@localhost:5432/cellarbar"

    model_config = {"env_file": ".env"}


settings = Settings()
```

**Step 2: Create `backend/app/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 3: Create `backend/app/models/base.py`**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()
```

**Step 4: Create `backend/app/models/user.py`**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    tasting_notes = relationship("TastingNote", back_populates="user")
```

**Step 5: Create `backend/app/models/tag.py`**

```python
import uuid
import enum

from sqlalchemy import String, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class TagCategory(str, enum.Enum):
    flavor = "flavor"
    type = "type"
    ingredient = "ingredient"


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    category: Mapped[TagCategory] = mapped_column(Enum(TagCategory))
```

**Step 6: Create `backend/app/models/bottle.py`**

```python
import uuid
import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Column, Date, DateTime, Enum, Float, ForeignKey,
    Integer, String, Table, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

bottle_tags = Table(
    "bottle_tags",
    Base.metadata,
    Column("bottle_id", ForeignKey("bottles.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class BottleType(str, enum.Enum):
    wine = "wine"
    spirit = "spirit"
    liqueur = "liqueur"
    beer = "beer"
    other = "other"


class BottleStatus(str, enum.Enum):
    in_stock = "in_stock"
    consumed = "consumed"
    gifted = "gifted"


class EnrichmentStatus(str, enum.Enum):
    pending = "pending"
    auto_enriched = "auto_enriched"
    claude_enriched = "claude_enriched"
    manual = "manual"
    confirmed = "confirmed"


class Bottle(Base, TimestampMixin):
    __tablename__ = "bottles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(300))
    producer: Mapped[str | None] = mapped_column(String(300))
    type: Mapped[BottleType] = mapped_column(Enum(BottleType))
    subtype: Mapped[str | None] = mapped_column(String(100))
    vintage: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String(200))
    country: Mapped[str | None] = mapped_column(String(100))
    grape_or_base: Mapped[str | None] = mapped_column(String(200))
    abv: Mapped[float | None] = mapped_column(Float)
    sugar_content_g_per_100ml: Mapped[float | None] = mapped_column(Float)
    volume_ml: Mapped[int | None] = mapped_column(Integer)
    purchase_price_kr: Mapped[float | None] = mapped_column(Float)
    purchase_date: Mapped[date | None] = mapped_column(Date)
    source_shop: Mapped[str | None] = mapped_column(String(200))
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    quantity_purchased: Mapped[float | None] = mapped_column(Float)
    status: Mapped[BottleStatus] = mapped_column(
        Enum(BottleStatus), default=BottleStatus.in_stock
    )
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    barcode: Mapped[str | None] = mapped_column(String(50))
    enrichment_status: Mapped[EnrichmentStatus] = mapped_column(
        Enum(EnrichmentStatus), default=EnrichmentStatus.pending
    )
    serving_temp: Mapped[str | None] = mapped_column(String(50))
    drink_window_start: Mapped[date | None] = mapped_column(Date)
    drink_window_end: Mapped[date | None] = mapped_column(Date)
    awards_scores: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    suggested_pairings: Mapped[str | None] = mapped_column(Text)

    tags = relationship("Tag", secondary=bottle_tags, lazy="selectin")
    tasting_notes = relationship("TastingNote", back_populates="bottle", lazy="selectin")
```

**Step 7: Create `backend/app/models/tasting.py`**

```python
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid


class TastingNote(Base):
    __tablename__ = "tasting_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    bottle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bottles.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tasted_at: Mapped[date] = mapped_column(Date, default=lambda: date.today())
    occasion: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(Integer)  # 0-10, displayed as 0-5 half-stars
    food_pairing: Mapped[str | None] = mapped_column(Text)
    pairing_rating: Mapped[int | None] = mapped_column(Integer)  # 0-10
    would_drink_again: Mapped[bool | None] = mapped_column(Boolean)

    bottle = relationship("Bottle", back_populates="tasting_notes")
    user = relationship("User", back_populates="tasting_notes")
```

**Step 8: Create `backend/app/models/cocktail.py`**

```python
import uuid
import enum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class CocktailMethod(str, enum.Enum):
    shake = "shake"
    stir = "stir"
    build = "build"
    blend = "blend"


class CocktailDifficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    advanced = "advanced"


class CocktailRecipe(Base, TimestampMixin):
    __tablename__ = "cocktail_recipes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    method: Mapped[CocktailMethod | None] = mapped_column(Enum(CocktailMethod))
    glass_type: Mapped[str | None] = mapped_column(String(100))
    garnish: Mapped[str | None] = mapped_column(String(200))
    difficulty: Mapped[CocktailDifficulty | None] = mapped_column(Enum(CocktailDifficulty))
    rating: Mapped[int | None] = mapped_column(Integer)  # 0-10
    would_make_again: Mapped[bool | None] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(Text)

    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan", lazy="selectin")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    recipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cocktail_recipes.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    amount_cl: Mapped[float | None] = mapped_column(Float)
    tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tags.id"))
    is_pantry_item: Mapped[bool] = mapped_column(Boolean, default=False)

    recipe = relationship("CocktailRecipe", back_populates="ingredients")
    tag = relationship("Tag", lazy="selectin")
```

**Step 9: Create `backend/app/models/shopping.py`**

```python
import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class ShoppingSource(str, enum.Enum):
    manual = "manual"
    scan = "scan"
    cocktail = "cocktail"


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(300))
    bottle_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bottles.id", ondelete="SET NULL"))
    barcode: Mapped[str | None] = mapped_column(String(50))
    source: Mapped[ShoppingSource] = mapped_column(Enum(ShoppingSource), default=ShoppingSource.manual)
    is_bought: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
```

**Step 10: Create `backend/app/models/pantry.py`**

```python
import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200))
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tags.id"))

    tag = relationship("Tag", lazy="selectin")
```

**Step 11: Create `backend/app/models/__init__.py`**

```python
from app.models.base import Base
from app.models.user import User
from app.models.tag import Tag
from app.models.bottle import Bottle, bottle_tags
from app.models.tasting import TastingNote
from app.models.cocktail import CocktailRecipe, RecipeIngredient
from app.models.shopping import ShoppingListItem
from app.models.pantry import PantryItem

__all__ = [
    "Base", "User", "Tag", "Bottle", "bottle_tags",
    "TastingNote", "CocktailRecipe", "RecipeIngredient",
    "ShoppingListItem", "PantryItem",
]
```

**Step 12: Set up Alembic**

Create `backend/alembic.ini`:
```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://cellarbar:cellarbar_dev@localhost:5432/cellarbar

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

Create `backend/alembic/env.py`:
```python
from logging.config import fileConfig
from alembic import context
from app.config import settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    from sqlalchemy import engine_from_config, pool
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Create `backend/alembic/versions/` directory (empty, with `__init__.py`).

**Step 13: Generate initial migration**

Run: `cd backend && alembic revision --autogenerate -m "initial schema"`
Verify the generated migration creates all tables.

Run: `alembic upgrade head`
Verify all tables exist in the database.

**Step 14: Commit**

```bash
git add -A
git commit -m "feat: database models, Alembic setup, and initial migration for all entities"
```

---

### Task 3: Backend Core — FastAPI App, Auth Middleware, User Endpoints

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/middleware/__init__.py` (empty)
- Create: `backend/app/middleware/auth.py`
- Create: `backend/app/schemas/__init__.py` (empty)
- Create: `backend/app/schemas/user.py`
- Create: `backend/app/routers/__init__.py` (empty)
- Create: `backend/app/routers/users.py`
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_users.py`

**Step 1: Create `backend/app/schemas/user.py`**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str
```

**Step 2: Create `backend/app/middleware/auth.py`**

The auth middleware resolves the current user from a session cookie. In v1, this is a simple user ID stored in a cookie. The abstraction point is `get_current_user` — swap this dependency to check a JWT/OAuth token later.

```python
import uuid
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User


def get_current_user(
    user_id: str | None = Cookie(None, alias="cellarbar_user"),
    db: Session = Depends(get_db),
) -> User:
    if not user_id:
        raise HTTPException(status_code=401, detail="No user selected")
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    user_id: str | None = Cookie(None, alias="cellarbar_user"),
    db: Session = Depends(get_db),
) -> User | None:
    if not user_id:
        return None
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    return db.get(User, uid)
```

**Step 3: Create `backend/app/routers/users.py`**

```python
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    user = User(name=data.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/select")
def select_user(user_id: str, response: Response, db: Session = Depends(get_db)):
    import uuid as _uuid
    user = db.get(User, _uuid.UUID(user_id))
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    response.set_cookie(
        key="cellarbar_user",
        value=str(user.id),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,  # 1 year
    )
    return {"message": f"Switched to {user.name}"}


@router.get("/me", response_model=UserOut)
def get_current(user: User = Depends(get_db)):
    # This will be wired up after auth middleware is imported
    pass
```

**Step 4: Create `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import users

app = FastAPI(title="Cellar & Bar Tracker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5177"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

**Step 5: Create `backend/tests/conftest.py`**

Uses a separate test database. Requires PostgreSQL running (via `docker compose up -d postgres`).

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base

TEST_DATABASE_URL = "postgresql://cellarbar:cellarbar_dev@localhost:5432/cellarbar_test"

engine = create_engine(TEST_DATABASE_URL)
TestSession = sessionmaker(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    # Create test database tables
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Note: You need to create the `cellarbar_test` database before running tests:
```bash
docker compose exec postgres createdb -U cellarbar cellarbar_test
```

**Step 6: Write failing test `backend/tests/test_users.py`**

```python
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_user(client):
    r = client.post("/api/users", json={"name": "Alice"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Alice"
    assert "id" in data


def test_list_users(client):
    client.post("/api/users", json={"name": "Bob"})
    r = client.get("/api/users")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_select_user(client):
    r = client.post("/api/users", json={"name": "Charlie"})
    user_id = r.json()["id"]
    r = client.post(f"/api/users/{user_id}/select")
    assert r.status_code == 200
    assert "cellarbar_user" in r.cookies
```

**Step 7: Run tests**

Run: `cd backend && pytest tests/test_users.py -v`
Expected: All pass.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: FastAPI app with user endpoints, auth middleware, and test infrastructure"
```

---

## Phase 2: Core Backend APIs

### Task 4: Tags CRUD API

**Files:**
- Create: `backend/app/schemas/tag.py`
- Create: `backend/app/routers/tags.py`
- Modify: `backend/app/main.py` (register router)
- Create: `backend/tests/test_tags.py`

**Step 1: Create `backend/app/schemas/tag.py`**

```python
import uuid
from pydantic import BaseModel
from app.models.tag import TagCategory


class TagOut(BaseModel):
    id: uuid.UUID
    name: str
    category: TagCategory

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    category: TagCategory
```

**Step 2: Create `backend/app/routers/tags.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tag import Tag
from app.schemas.tag import TagCreate, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(category: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Tag)
    if category:
        q = q.filter(Tag.category == category)
    return q.order_by(Tag.name).all()


@router.post("", response_model=TagOut, status_code=201)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag already exists")
    tag = Tag(name=data.name, category=data.category)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: str, db: Session = Depends(get_db)):
    import uuid
    tag = db.get(Tag, uuid.UUID(tag_id))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
```

**Step 3: Register router in `backend/app/main.py`**

Add `from app.routers import tags` and `app.include_router(tags.router)`.

**Step 4: Write tests `backend/tests/test_tags.py`**

```python
def test_create_tag(client):
    r = client.post("/api/tags", json={"name": "fruity", "category": "flavor"})
    assert r.status_code == 201
    assert r.json()["name"] == "fruity"


def test_list_tags(client):
    client.post("/api/tags", json={"name": "gin", "category": "ingredient"})
    r = client.get("/api/tags")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_filter_tags_by_category(client):
    client.post("/api/tags", json={"name": "spicy", "category": "flavor"})
    client.post("/api/tags", json={"name": "rum", "category": "ingredient"})
    r = client.get("/api/tags?category=flavor")
    assert all(t["category"] == "flavor" for t in r.json())


def test_duplicate_tag_rejected(client):
    client.post("/api/tags", json={"name": "unique_tag", "category": "flavor"})
    r = client.post("/api/tags", json={"name": "unique_tag", "category": "flavor"})
    assert r.status_code == 409
```

**Step 5: Run tests, verify pass**

Run: `cd backend && pytest tests/test_tags.py -v`

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: tags CRUD API with category filtering"
```

---

### Task 5: Bottles CRUD API

**Files:**
- Create: `backend/app/schemas/bottle.py`
- Create: `backend/app/routers/bottles.py`
- Modify: `backend/app/main.py` (register router)
- Create: `backend/tests/test_bottles.py`

**Step 1: Create `backend/app/schemas/bottle.py`**

```python
import uuid
from datetime import date, datetime
from pydantic import BaseModel

from app.models.bottle import BottleType, BottleStatus, EnrichmentStatus
from app.schemas.tag import TagOut


class BottleOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    name: str
    producer: str | None
    type: BottleType
    subtype: str | None
    vintage: int | None
    region: str | None
    country: str | None
    grape_or_base: str | None
    abv: float | None
    sugar_content_g_per_100ml: float | None
    volume_ml: int | None
    purchase_price_kr: float | None
    purchase_date: date | None
    source_shop: str | None
    quantity: float
    quantity_purchased: float | None
    status: BottleStatus
    status_changed_at: datetime | None
    barcode: str | None
    enrichment_status: EnrichmentStatus
    serving_temp: str | None
    drink_window_start: date | None
    drink_window_end: date | None
    awards_scores: str | None
    notes: str | None
    suggested_pairings: str | None
    tags: list[TagOut] = []

    model_config = {"from_attributes": True}


class BottleCreate(BaseModel):
    name: str
    type: BottleType
    quantity: float = 1.0
    purchase_price_kr: float | None = None
    producer: str | None = None
    subtype: str | None = None
    vintage: int | None = None
    region: str | None = None
    country: str | None = None
    grape_or_base: str | None = None
    abv: float | None = None
    sugar_content_g_per_100ml: float | None = None
    volume_ml: int | None = None
    purchase_date: date | None = None
    source_shop: str | None = None
    barcode: str | None = None
    serving_temp: str | None = None
    drink_window_start: date | None = None
    drink_window_end: date | None = None
    awards_scores: str | None = None
    notes: str | None = None
    suggested_pairings: str | None = None
    tag_ids: list[uuid.UUID] = []


class BottleUpdate(BaseModel):
    name: str | None = None
    producer: str | None = None
    type: BottleType | None = None
    subtype: str | None = None
    vintage: int | None = None
    region: str | None = None
    country: str | None = None
    grape_or_base: str | None = None
    abv: float | None = None
    sugar_content_g_per_100ml: float | None = None
    volume_ml: int | None = None
    purchase_price_kr: float | None = None
    purchase_date: date | None = None
    source_shop: str | None = None
    quantity: float | None = None
    status: BottleStatus | None = None
    barcode: str | None = None
    enrichment_status: EnrichmentStatus | None = None
    serving_temp: str | None = None
    drink_window_start: date | None = None
    drink_window_end: date | None = None
    awards_scores: str | None = None
    notes: str | None = None
    suggested_pairings: str | None = None
    tag_ids: list[uuid.UUID] | None = None


class QuantityAdjust(BaseModel):
    quantity: float
```

**Step 2: Create `backend/app/routers/bottles.py`**

```python
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus, BottleType
from app.models.tag import Tag
from app.schemas.bottle import BottleCreate, BottleOut, BottleUpdate, QuantityAdjust

router = APIRouter(prefix="/api/bottles", tags=["bottles"])


@router.get("", response_model=list[BottleOut])
def list_bottles(
    status: BottleStatus | None = None,
    type: BottleType | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Bottle)
    if status:
        q = q.filter(Bottle.status == status)
    if type:
        q = q.filter(Bottle.type == type)
    if search:
        q = q.filter(Bottle.name.ilike(f"%{search}%"))
    return q.order_by(Bottle.name).all()


@router.get("/{bottle_id}", response_model=BottleOut)
def get_bottle(bottle_id: str, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    return bottle


@router.post("", response_model=BottleOut, status_code=201)
def create_bottle(data: BottleCreate, db: Session = Depends(get_db)):
    fields = data.model_dump(exclude={"tag_ids"})
    fields["quantity_purchased"] = data.quantity
    bottle = Bottle(**fields)
    if data.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all()
        bottle.tags = tags
    db.add(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle


@router.patch("/{bottle_id}", response_model=BottleOut)
def update_bottle(bottle_id: str, data: BottleUpdate, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)
    if "status" in update_data and update_data["status"] != bottle.status:
        update_data["status_changed_at"] = datetime.now(timezone.utc)
    for key, value in update_data.items():
        setattr(bottle, key, value)
    if tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        bottle.tags = tags
    db.commit()
    db.refresh(bottle)
    return bottle


@router.post("/{bottle_id}/adjust", response_model=BottleOut)
def adjust_quantity(bottle_id: str, data: QuantityAdjust, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    bottle.quantity = data.quantity
    if data.quantity <= 0:
        bottle.status = BottleStatus.consumed
        bottle.status_changed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(bottle)
    return bottle


@router.delete("/{bottle_id}", status_code=204)
def delete_bottle(bottle_id: str, db: Session = Depends(get_db)):
    bottle = db.get(Bottle, uuid.UUID(bottle_id))
    if not bottle:
        raise HTTPException(status_code=404, detail="Bottle not found")
    db.delete(bottle)
    db.commit()
```

**Step 3: Register router in `backend/app/main.py`**

**Step 4: Write tests `backend/tests/test_bottles.py`**

```python
def test_create_bottle_quick_add(client):
    r = client.post("/api/bottles", json={
        "name": "Barolo 2019", "type": "wine", "quantity": 1.0, "purchase_price_kr": 299,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Barolo 2019"
    assert data["quantity_purchased"] == 1.0
    assert data["status"] == "in_stock"
    assert data["enrichment_status"] == "pending"


def test_list_bottles_filter_by_type(client):
    client.post("/api/bottles", json={"name": "Wine A", "type": "wine", "quantity": 1})
    client.post("/api/bottles", json={"name": "Spirit A", "type": "spirit", "quantity": 1})
    r = client.get("/api/bottles?type=wine")
    assert all(b["type"] == "wine" for b in r.json())


def test_update_bottle(client):
    r = client.post("/api/bottles", json={"name": "Update Me", "type": "wine", "quantity": 1})
    bid = r.json()["id"]
    r = client.patch(f"/api/bottles/{bid}", json={"region": "Burgundy", "vintage": 2020})
    assert r.json()["region"] == "Burgundy"


def test_adjust_quantity_to_zero_marks_consumed(client):
    r = client.post("/api/bottles", json={"name": "Finish Me", "type": "wine", "quantity": 1.0})
    bid = r.json()["id"]
    r = client.post(f"/api/bottles/{bid}/adjust", json={"quantity": 0})
    assert r.json()["status"] == "consumed"


def test_create_bottle_with_tags(client):
    t = client.post("/api/tags", json={"name": "bold_test", "category": "flavor"})
    tag_id = t.json()["id"]
    r = client.post("/api/bottles", json={
        "name": "Tagged Wine", "type": "wine", "quantity": 1, "tag_ids": [tag_id],
    })
    assert len(r.json()["tags"]) == 1


def test_search_bottles(client):
    client.post("/api/bottles", json={"name": "Château Margaux", "type": "wine", "quantity": 1})
    r = client.get("/api/bottles?search=margaux")
    assert len(r.json()) >= 1
```

**Step 5: Run tests, commit**

```bash
git add -A
git commit -m "feat: bottles CRUD API with filtering, tags, quantity adjustment"
```

---

### Task 6: Tasting Notes API

**Files:**
- Create: `backend/app/schemas/tasting.py`
- Create: `backend/app/routers/tastings.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_tastings.py`

**Step 1: Create schemas and router**

Follow the pattern from Tasks 4-5. Key points:
- `TastingNoteCreate` requires `bottle_id` and `rating` (0-10). Other fields optional.
- `POST /api/tastings` uses `get_current_user` dependency to auto-set `user_id` from cookie.
- `GET /api/tastings` supports `?bottle_id=` and `?user_id=` query filters.
- Rating is validated `ge=0, le=10` via Pydantic `Field`.

See Phase 2 detail in the first write for full code.

**Step 2: Key test — tasting requires auth**

```python
def test_tasting_requires_auth(client):
    b = client.post("/api/bottles", json={"name": "No Auth Wine", "type": "wine", "quantity": 1})
    client.cookies.clear()
    r = client.post("/api/tastings", json={"bottle_id": b.json()["id"], "rating": 5})
    assert r.status_code == 401
```

**Step 3: Run tests, commit**

```bash
git add -A
git commit -m "feat: tasting notes API with per-user auth and food pairing ratings"
```

---

### Task 7: Shopping List API

Follow pattern from Tasks 4-5. Key endpoints:
- `GET /api/shopping` — list items, `?show_bought=true` to include bought
- `POST /api/shopping` — add item with `source` (manual/scan/cocktail)
- `PATCH /api/shopping/{id}` — toggle `is_bought`
- `DELETE /api/shopping` — clear all bought items

```bash
git commit -m "feat: shopping list API with scan source tracking and clear-bought"
```

---

### Task 8: Cocktail Recipes & Pantry API

Follow pattern. Key feature is the **makeable endpoint**:

`GET /api/cocktails/makeable` — collects tag IDs from in-stock bottles and in-stock pantry items, then checks each recipe's ingredients against those sets. Only returns recipes where all tagged ingredients are satisfied.

Pantry is simple CRUD with `in_stock` toggle.

Key test:
```python
def test_makeable_cocktails(client):
    gin_tag = client.post("/api/tags", json={"name": "gin_mk", "category": "ingredient"}).json()
    vermouth_tag = client.post("/api/tags", json={"name": "vermouth_mk", "category": "ingredient"}).json()
    client.post("/api/bottles", json={
        "name": "Beefeater", "type": "spirit", "quantity": 1, "tag_ids": [gin_tag["id"]],
    })
    client.post("/api/cocktails", json={
        "name": "Martini", "method": "stir",
        "ingredients": [
            {"name": "Gin", "amount_cl": 6, "tag_id": gin_tag["id"]},
            {"name": "Dry Vermouth", "amount_cl": 1, "tag_id": vermouth_tag["id"]},
        ],
    })
    r = client.get("/api/cocktails/makeable")
    assert "Martini" not in [c["name"] for c in r.json()]
    # Add vermouth → now makeable
    client.post("/api/bottles", json={
        "name": "Noilly Prat", "type": "spirit", "quantity": 1, "tag_ids": [vermouth_tag["id"]],
    })
    r = client.get("/api/cocktails/makeable")
    assert "Martini" in [c["name"] for c in r.json()]
```

```bash
git commit -m "feat: cocktail recipes with ingredient matching and pantry items API"
```

---

### Task 9: Bulk Data & Markdown Export Endpoints

**Files:**
- Create: `backend/app/routers/export.py`

Endpoints:
- `GET /api/export/full-inventory` — all bottles with tags, notes, quantities
- `GET /api/export/full-cocktails` — all recipes with ingredients
- `GET /api/export/full-shopping` — shopping list
- `GET /api/export/full-pantry` — pantry items
- `GET /api/export/markdown/wine` — wine inventory guide as markdown
- `GET /api/export/markdown/bar` — home bar inventory as markdown

```bash
git commit -m "feat: bulk data export endpoints and markdown generation"
```

---

## Phase 3: Frontend Foundation

### Task 10: React Project Scaffolding

**Step 1: Initialize React + Vite + TypeScript project**

Run inside `frontend/`:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom
```

**Step 2: Configure Tailwind**

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5177',
    },
  },
})
```

`frontend/src/index.css`:
```css
@import "tailwindcss";
```

**Step 3: Create API client `frontend/src/api/client.ts`**

```typescript
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) =>
    request<void>(path, { method: 'DELETE' }),
};
```

**Step 4: Create auth hook `frontend/src/hooks/useAuth.ts`**

```typescript
import { createContext, useContext } from 'react';

export interface User {
  id: string;
  name: string;
}

export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
});

export const useAuth = () => useContext(AuthContext);
```

**Step 5: Create Layout `frontend/src/components/Layout.tsx`**

```tsx
import { Outlet, NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/collection', label: 'Collection', icon: '🍷' },
  { to: '/tastings', label: 'Tastings', icon: '📝' },
  { to: '/cocktails', label: 'Cocktails', icon: '🍸' },
  { to: '/shopping', label: 'Shopping', icon: '🛒' },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-56 bg-stone-900 text-stone-100 p-4 gap-1">
        <h1 className="text-lg font-bold mb-6 px-3">Cellar & Bar</h1>
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? 'bg-stone-700' : 'hover:bg-stone-800'}`
            }
          >
            {t.icon} {t.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 p-4 md:p-6 bg-stone-50 min-h-screen">
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-50">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? 'text-amber-700' : 'text-stone-500'}`
            }
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

**Step 6: Create `frontend/src/App.tsx` with routing**

```tsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, User } from './hooks/useAuth';
import Layout from './components/Layout';
import ProfilePick from './pages/ProfilePick';
import Dashboard from './pages/Dashboard';
import Collection from './pages/Collection';
import Tastings from './pages/Tastings';
import Cocktails from './pages/Cocktails';
import ShoppingList from './pages/ShoppingList';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already selected via cookie
    fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          {!user ? (
            <Route path="*" element={<ProfilePick />} />
          ) : (
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/tastings" element={<Tastings />} />
              <Route path="/cocktails" element={<Cocktails />} />
              <Route path="/shopping" element={<ShoppingList />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
```

**Step 7: Create placeholder pages**

Each page file (`Dashboard.tsx`, `Collection.tsx`, `Tastings.tsx`, `Cocktails.tsx`, `ShoppingList.tsx`) starts as:

```tsx
export default function Dashboard() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
```

**Step 8: Create `frontend/src/pages/ProfilePick.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth, User } from '../hooks/useAuth';

export default function ProfilePick() {
  const { setUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get<User[]>('/users').then(setUsers);
  }, []);

  const selectUser = async (u: User) => {
    await api.post(`/users/${u.id}/select`);
    setUser(u);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Who's here?</h1>
        <div className="flex flex-col gap-3">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => selectUser(u)}
              className="py-3 px-4 rounded-lg bg-stone-100 hover:bg-amber-100 text-lg font-medium transition"
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 9: Verify the app starts**

Run: `cd frontend && npm run dev`
Open `http://localhost:5173` — should show the profile pick screen.

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: React frontend with routing, Tailwind, profile-pick auth, responsive layout"
```

---

### Task 11: Collection View with Category Tabs

**Files:**
- Create: `frontend/src/pages/Collection.tsx`
- Create: `frontend/src/pages/BottleDetail.tsx`
- Create: `frontend/src/pages/QuickAdd.tsx`
- Create: `frontend/src/components/StarRating.tsx`

**Step 1: Create `frontend/src/components/StarRating.tsx`**

```tsx
interface Props {
  value: number;  // 0-10 (half-stars)
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ value, onChange, size = 'md' }: Props) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

  return (
    <div className={`flex gap-0.5 ${sizes[size]}`}>
      {[1, 2, 3, 4, 5].map(star => {
        const halfVal = star * 2;
        const filled = value >= halfVal;
        const half = value === halfVal - 1;

        return (
          <span
            key={star}
            className={`cursor-pointer select-none ${filled ? 'text-amber-500' : half ? 'text-amber-300' : 'text-stone-300'}`}
            onClick={() => onChange?.(halfVal)}
            onContextMenu={(e) => { e.preventDefault(); onChange?.(halfVal - 1); }}
          >
            {filled ? '★' : half ? '★' : '☆'}
          </span>
        );
      })}
      <span className="text-sm text-stone-500 ml-1">{(value / 2).toFixed(1)}</span>
    </div>
  );
}
```

Note: Left-click = full star, right-click = half star. Simple approach — can refine UX later.

**Step 2: Create `frontend/src/pages/Collection.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Bottle {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  quantity: float;
  status: string;
  producer: string | null;
  vintage: number | null;
  purchase_price_kr: number | null;
  tags: { id: string; name: string }[];
}

const CATEGORIES = ['wine', 'spirit', 'liqueur', 'beer', 'other'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  wine: 'Wines', spirit: 'Spirits', liqueur: 'Liqueurs', beer: 'Beer', other: 'Other',
};

export default function Collection() {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [activeTab, setActiveTab] = useState<string>('wine');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<Bottle[]>('/bottles?status=in_stock').then(setBottles);
  }, []);

  const filtered = bottles.filter(b =>
    b.type === activeTab &&
    (search === '' || b.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Collection</h1>
        <Link
          to="/collection/add"
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Quick Add
        </Link>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              activeTab === cat ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            {CATEGORY_LABELS[cat]} ({bottles.filter(b => b.type === cat).length})
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 border rounded-lg"
      />

      {/* Bottle list */}
      <div className="flex flex-col gap-2">
        {filtered.map(b => (
          <Link
            key={b.id}
            to={`/collection/${b.id}`}
            className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center"
          >
            <div>
              <div className="font-medium">{b.name}</div>
              <div className="text-sm text-stone-500">
                {b.producer && `${b.producer} · `}
                {b.vintage && `${b.vintage} · `}
                {b.subtype}
              </div>
              {b.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {b.tags.map(t => (
                    <span key={t.id} className="text-xs bg-stone-100 px-2 py-0.5 rounded-full">
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">×{b.quantity}</div>
              {b.purchase_price_kr && <div className="text-stone-500">{b.purchase_price_kr} kr</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create BottleDetail and QuickAdd pages**

`BottleDetail.tsx` — shows full bottle info, both users' tasting notes, quantity adjust buttons, edit fields. Uses `useParams()` to get bottle ID and fetches from `/api/bottles/{id}` and `/api/tastings?bottle_id={id}`.

`QuickAdd.tsx` — form with name, type dropdown, quantity, price, optional barcode scan button. POSTs to `/api/bottles`. On success, navigates back to collection.

**Step 4: Add routes for detail and quick-add in `App.tsx`**

```tsx
import BottleDetail from './pages/BottleDetail';
import QuickAdd from './pages/QuickAdd';

// Inside the Layout route:
<Route path="/collection/:id" element={<BottleDetail />} />
<Route path="/collection/add" element={<QuickAdd />} />
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: collection view with category tabs, search, bottle detail, quick-add"
```

---

### Task 12: Tasting Log UI

**Files:**
- Create: `frontend/src/pages/Tastings.tsx`
- Create: `frontend/src/pages/NewTasting.tsx`

`Tastings.tsx` — fetches `/api/tastings?user_id={current user}`, shows chronological feed of tasting notes with star ratings, bottle name, date, pairing info.

`NewTasting.tsx` — form with bottle picker (search dropdown), star rating (using StarRating component), notes textarea, food pairing text, pairing rating, would-drink-again toggle. POSTs to `/api/tastings`.

Accessible from Tastings tab or from BottleDetail page (pre-fills bottle).

```bash
git commit -m "feat: tasting log feed and new tasting form with star ratings"
```

---

### Task 13: Shopping List UI

**Files:**
- Create: `frontend/src/pages/ShoppingList.tsx`

Design for use at the store: big checkboxes, barcode shown per item, "clear bought" button.

```tsx
// Key interactions:
// - Tap checkbox → PATCH /api/shopping/{id} { is_bought: true/false }
// - Add item → POST /api/shopping { name, source: "manual" }
// - Scan button → opens BarcodeScanner, captures code, adds item
// - Clear bought → DELETE /api/shopping
```

```bash
git commit -m "feat: shopping list UI with big checkboxes and manual add"
```

---

### Task 14: Barcode Scanner Component

**Files:**
- Create: `frontend/src/components/BarcodeScanner.tsx`

**Step 1: Install Quagga2**

```bash
cd frontend && npm install @ericblade/quagga2
```

**Step 2: Create `frontend/src/components/BarcodeScanner.tsx`**

```tsx
import Quagga from '@ericblade/quagga2';
import { useEffect, useRef, useCallback } from 'react';

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const detectedRef = useRef(false);

  const handleDetected = useCallback((result: any) => {
    if (detectedRef.current) return;
    const code = result.codeResult?.code;
    if (code) {
      detectedRef.current = true;
      Quagga.stop();
      onDetected(code);
    }
  }, [onDetected]);

  useEffect(() => {
    if (!scannerRef.current) return;
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        decoder: {
          readers: ['ean_reader', 'upc_reader', 'upc_e_reader'],
        },
      },
      (err) => {
        if (err) { console.error(err); return; }
        Quagga.start();
      },
    );
    Quagga.onDetected(handleDetected);
    return () => {
      Quagga.offDetected(handleDetected);
      Quagga.stop();
    };
  }, [handleDetected]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
      <div ref={scannerRef} className="w-full max-w-md aspect-video rounded-lg overflow-hidden" />
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 bg-white rounded-lg font-medium"
      >
        Cancel
      </button>
    </div>
  );
}
```

**Step 3: Integrate into QuickAdd and ShoppingList pages**

Both pages get a "Scan" button that toggles `<BarcodeScanner>`. On detection:
- QuickAdd: sets barcode field, optionally looks up product info via `/api/barcode/{code}` (Task 15)
- ShoppingList: adds item with barcode and source "scan"

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: barcode scanner component using Quagga2 with camera access"
```

---

### Task 15: Barcode Lookup Service

**Files:**
- Create: `backend/app/routers/barcode.py`
- Modify: `backend/app/main.py`

Backend endpoint that looks up a barcode against open databases.

```python
import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/barcode", tags=["barcode"])


@router.get("/{code}")
async def lookup_barcode(code: str):
    """Try Open Food Facts, then UPCitemdb."""
    # Try Open Food Facts first
    async with httpx.AsyncClient() as client:
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

        # Fallback: UPCitemdb (100 free req/day, no key needed)
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
                    "image_url": (item.get("images") or [""])[0],
                }

    return {"found": False}
```

```bash
git commit -m "feat: barcode lookup via Open Food Facts and UPCitemdb"
```

---

### Task 16: Dashboard Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

Fetches from multiple endpoints and shows:
- Stock summary cards (count by type)
- Recently added bottles (last 5)
- Recently tasted (last 5 tasting notes)
- Pending enrichment count
- Cocktails you can make right now (from `/api/cocktails/makeable`)

```bash
git commit -m "feat: dashboard with stock summary, recent activity, and makeable cocktails"
```

---

### Task 17: Cocktails UI

**Files:**
- Modify: `frontend/src/pages/Cocktails.tsx`

Recipe list with "Can make tonight" toggle filter. Recipe detail as expandable card or modal showing ingredients, method, garnish. Filter by difficulty and tags.

Create/edit recipe form with dynamic ingredient list (add/remove rows, each with name, amount_cl, tag picker, pantry toggle).

```bash
git commit -m "feat: cocktail library UI with recipe management and makeable filter"
```

---

## Phase 4: MCP Server

### Task 18: MCP Server with FastMCP

**Files:**
- Create: `mcp/server.py`

**Step 1: Create `mcp/server.py`**

```python
import httpx
from fastmcp import FastMCP

BACKEND_URL = "http://backend:8000"  # Docker internal network

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


def _post(path: str, json=None):
    with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
        r = client.post(path, json=json)
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
def update_bottle(bottle_id: str, **updates) -> dict:
    """Update any fields on a bottle. Pass only the fields you want to change."""
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
    User name must match an existing user (e.g. 'Alice' or 'Bob').
    Pairing rating is also 0-10."""
    # Look up user by name
    users = _get("/api/users")
    user = next((u for u in users if u["name"].lower() == user_name.lower()), None)
    if not user:
        return {"error": f"User '{user_name}' not found. Available: {[u['name'] for u in users]}"}

    # Set user cookie for this request
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

    with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
        r = client.post(
            "/api/tastings",
            json=data,
            cookies={"cellarbar_user": user["id"]},
        )
        r.raise_for_status()
        return r.json()


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
    """Get bottles with pending or incomplete enrichment data."""
    return _get("/api/bottles?status=in_stock")  # filter for pending enrichment on client side


@mcp.tool
def enrich_bottle(bottle_id: str, **enrichment_data) -> dict:
    """Update a bottle with enrichment data (producer, region, abv, etc.).
    Call this after researching a bottle and getting user confirmation.
    Set enrichment_status to 'claude_enriched' or 'confirmed'."""
    if "enrichment_status" not in enrichment_data:
        enrichment_data["enrichment_status"] = "claude_enriched"
    return _patch(f"/api/bottles/{bottle_id}", json=enrichment_data)


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
```

**Step 2: Verify MCP server starts**

```bash
cd mcp && pip install -e . && python server.py
```

Should start listening on port 5178.

**Step 3: Test MCP connection**

```python
# Quick test script
from fastmcp import Client
import asyncio

async def test():
    async with Client("http://localhost:5178/mcp") as client:
        tools = await client.list_tools()
        print(f"Tools: {[t.name for t in tools]}")

asyncio.run(test())
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: MCP server with full tool suite for inventory, tastings, cocktails, and enrichment"
```

---

## Phase 5: Integration & Polish

### Task 19: User Seeding & /api/users/me Endpoint

**Files:**
- Modify: `backend/app/routers/users.py` — fix the `/me` endpoint to use `get_current_user`
- Create: `backend/app/seed.py` — seed script to create the two user accounts

```python
# backend/app/seed.py
from app.database import SessionLocal
from app.models.user import User

def seed_users():
    db = SessionLocal()
    if db.query(User).count() == 0:
        db.add_all([
            User(name="Alice"),  # Replace with actual names
            User(name="Bob"),
        ])
        db.commit()
    db.close()
```

Call `seed_users()` from `main.py` on startup via a `@app.on_event("startup")` handler.

```bash
git commit -m "feat: user seeding on startup and /me endpoint"
```

---

### Task 20: Docker Compose Integration Test

**Step 1: Verify full stack starts**

```bash
docker compose up --build -d
```

Wait for all services to be healthy.

**Step 2: Test backend**

```bash
curl http://localhost:5177/api/health
curl http://localhost:5177/api/users
```

**Step 3: Test MCP**

```bash
curl http://localhost:5178/mcp
```

**Step 4: Test frontend** (in dev mode)

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`, verify profile pick → dashboard flow works.

**Step 5: Fix any issues, commit**

```bash
git commit -m "feat: docker compose integration verified, all services running"
```

---

### Task 21: Frontend Polish — Quantity Adjustment, Status Changes

**Files:**
- Modify: `frontend/src/pages/BottleDetail.tsx`

Add preset quantity buttons to bottle detail page:
- "Open one" → quantity - 1
- "Finish bottle" → quantity = 0 (marks consumed)
- "Half left" → quantity = 0.5
- "Other..." → shows input for custom value

Add "Mark as gifted" button. Add "Edit" mode for all bottle fields.

```bash
git commit -m "feat: bottle detail with quantity presets, status changes, and edit mode"
```

---

### Task 22: End-to-End Smoke Test

Run through all major flows manually:

1. Start stack: `docker compose up --build -d`, `cd frontend && npm run dev`
2. Profile pick → select user
3. Quick-add a wine bottle
4. View it in collection
5. Open bottle detail, adjust quantity
6. Log a tasting note with food pairing
7. View tasting in feed
8. Add item to shopping list
9. Toggle bought
10. Check dashboard shows correct counts
11. Verify MCP tools work: `get_full_inventory()` via test script

Fix any issues found.

```bash
git commit -m "chore: end-to-end smoke test pass, bug fixes"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Foundation | 1-3 | Project scaffold, database, auth, user endpoints |
| 2: Core Backend | 4-9 | All API endpoints: tags, bottles, tastings, shopping, cocktails, pantry, export |
| 3: Frontend | 10-17 | Full React app: layout, auth, collection with tabs, tastings, shopping, barcode scan, dashboard, cocktails |
| 4: MCP | 18 | Complete MCP server with 15+ tools for Claude access |
| 5: Integration | 19-22 | User seeding, Docker integration, UI polish, smoke test |

**Total: 22 tasks covering Tier 1 + Tier 2 features.**

After completing this plan, remaining Tier 2 items (filters, drink window alerts, low stock warnings) and Tier 3 (CSV import, insights, Google Drive, SSO) can be planned as follow-up iterations.
