# User Profile Management & Cocktail Enrichment Queue — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full user profile management UI (create/edit/delete/switch with avatars) and cocktail enrichment queue (enrichment_status field + UI checkbox + MCP tool).

**Architecture:** Extend existing User model with `display_name` and `image_path`, add PATCH/DELETE endpoints, build profile UI in nav sidebar/header. For cocktails, reuse the same `EnrichmentStatus` enum from bottles, add column via migration, expose in schemas/router/MCP.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React + TypeScript + Tailwind, FastMCP

---

## Issue #14: User Profile Management UI

### Task 1: Backend — Extend User model and API

**Files:**
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/schemas/user.py`
- Modify: `backend/app/routers/users.py`
- Create: `backend/alembic/versions/<auto>_add_user_profile_fields.py`
- Modify: `backend/tests/test_users.py`

**Step 1: Write failing tests for new endpoints**

Add to `backend/tests/test_users.py`:

```python
def test_update_user(client):
    r = client.post("/api/users", json={"name": "Eve"})
    user_id = r.json()["id"]
    r = client.patch(f"/api/users/{user_id}", json={"display_name": "Evelyn"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Evelyn"


def test_update_user_not_found(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = client.patch(f"/api/users/{fake_id}", json={"display_name": "Ghost"})
    assert r.status_code == 404


def test_delete_user(client):
    r = client.post("/api/users", json={"name": "Temp"})
    user_id = r.json()["id"]
    r = client.delete(f"/api/users/{user_id}")
    assert r.status_code == 204
    r = client.get("/api/users")
    names = [u["name"] for u in r.json()]
    assert "Temp" not in names


def test_delete_user_not_found(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = client.delete(f"/api/users/{fake_id}")
    assert r.status_code == 404


def test_user_has_display_name_and_image(client):
    r = client.post("/api/users", json={"name": "Frank"})
    data = r.json()
    assert "display_name" in data
    assert "image_path" in data
    assert data["display_name"] is None
    assert data["image_path"] is None
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" pytest tests/test_users.py -v
```

Expected: FAIL (no PATCH/DELETE endpoints, no display_name/image_path fields)

**Step 3: Update User model**

In `backend/app/models/user.py`, add two nullable columns:

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
    display_name: Mapped[str | None] = mapped_column(String(100))
    image_path: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    tasting_notes = relationship("TastingNote", back_populates="user")
```

**Step 4: Update schemas**

In `backend/app/schemas/user.py`:

```python
import uuid
from datetime import datetime
from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = None
    image_path: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str


class UserUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    image_path: str | None = None
```

**Step 5: Update router — add PATCH and DELETE**

In `backend/app/routers/users.py`:

```python
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

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


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, _uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, _uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.post("/{user_id}/select")
def select_user(user_id: str, response: Response, db: Session = Depends(get_db)):
    user = db.get(User, _uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    response.set_cookie(
        key="cellarbar_user",
        value=str(user.id),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
    )
    return {"message": f"Switched to {user.name}"}


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user
```

**Step 6: Generate Alembic migration**

```bash
cd backend
DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" python -m alembic revision --autogenerate -m "add user display_name and image_path"
DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" python -m alembic upgrade head
```

**Step 7: Run tests to verify they pass**

```bash
cd backend && DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" pytest tests/test_users.py -v
```

Expected: ALL PASS

**Step 8: Commit**

```bash
git add backend/app/models/user.py backend/app/schemas/user.py backend/app/routers/users.py backend/tests/test_users.py backend/alembic/versions/
git commit -m "feat: extend User model with display_name, image_path, PATCH and DELETE endpoints"
```

---

### Task 2: Frontend — Profile picker in Layout + profile management page

**Files:**
- Modify: `frontend/src/hooks/useAuth.ts` (add display_name, image_path to User type)
- Modify: `frontend/src/components/Layout.tsx` (add profile button to sidebar/mobile nav)
- Modify: `frontend/src/pages/ProfilePick.tsx` (show avatars, add "Add profile" button)
- Create: `frontend/src/pages/ProfileSettings.tsx` (edit name, display_name, avatar, delete)
- Modify: `frontend/src/App.tsx` (add route for /profile)

**Step 1: Update User type in useAuth**

In `frontend/src/hooks/useAuth.ts`, update the `User` interface:

```typescript
export interface User {
  id: string;
  name: string;
  display_name: string | null;
  image_path: string | null;
}
```

**Step 2: Add profile switcher to Layout**

In `frontend/src/components/Layout.tsx`, add a profile button at the bottom of the sidebar and a user avatar/name display. The profile button should link to `/profile`. On mobile, add a small profile icon to the top-right corner (not in the bottom tabs — too crowded).

Desktop sidebar: add below the nav links:
```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Inside Layout component:
const { user, setUser } = useAuth();

// At bottom of desktop sidebar, before closing </nav>:
<div className="mt-auto pt-4 border-t border-stone-700">
  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-stone-800 text-sm">
    {user?.image_path ? (
      <img src={user.image_path} className="w-7 h-7 rounded-full object-cover" />
    ) : (
      <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
        {(user?.display_name || user?.name || '?')[0].toUpperCase()}
      </div>
    )}
    <span className="truncate">{user?.display_name || user?.name}</span>
  </Link>
</div>
```

Mobile: add a fixed header bar with profile icon:
```tsx
// Above <main>, add:
<header className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b">
  <span className="font-bold text-stone-900">Cellar & Bar</span>
  <Link to="/profile">
    {user?.image_path ? (
      <img src={user.image_path} className="w-8 h-8 rounded-full object-cover" />
    ) : (
      <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
        {(user?.display_name || user?.name || '?')[0].toUpperCase()}
      </div>
    )}
  </Link>
</header>
```

**Step 3: Update ProfilePick page**

In `frontend/src/pages/ProfilePick.tsx`, enhance with avatars and an "Add profile" flow:

- Show avatar circle (image or initial) next to each user name
- Add a "Create profile" button below the user list
- When clicked, show a simple inline form: name input + create button
- After creation, add to the list and auto-select

**Step 4: Create ProfileSettings page**

Create `frontend/src/pages/ProfileSettings.tsx`:

This page should show:
- Current user's avatar (with ImageUpload to change it)
- Edit display_name (text input)
- "Switch profile" button (navigates back to ProfilePick, clears current user)
- "Delete profile" button (with confirmation, calls DELETE, clears user → ProfilePick)

The switch profile action should:
1. Call `setUser(null)` in auth context
2. Navigate to root → ProfilePick renders automatically (since `user` is null in App.tsx)

The delete action should:
1. Confirm with the user
2. Call `DELETE /api/users/{id}`
3. Call `setUser(null)` → ProfilePick renders

For avatar upload:
- Reuse the existing `ImageUpload` component
- On image changed, call `PATCH /api/users/{id}` with `{ image_path: path }`
- Update auth context with new user data

**Step 5: Add route in App.tsx**

In `frontend/src/App.tsx`, add inside the authenticated `<Route element={<Layout />}>`:

```tsx
import ProfileSettings from './pages/ProfileSettings';

// Add route:
<Route path="/profile" element={<ProfileSettings />} />
```

**Step 6: Verify manually**

- Navigate to the app, see profile in sidebar
- Click profile → settings page
- Upload avatar, change display_name
- Switch profile → go to ProfilePick
- Create new profile from ProfilePick
- Delete a profile

**Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: user profile management UI — avatar, display name, switch, create, delete"
```

---

### Task 3: MCP — Add user management tools

**Files:**
- Modify: `mcp/server.py`

**Step 1: Add user management tools to MCP**

Add these tools to `mcp/server.py` in a new `# --- Users ---` section:

```python
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
    for field in ["name", "display_name"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    return _patch(f"/api/users/{user_id}", json=data)


@mcp.tool
def delete_user(user_id: str) -> dict:
    """Delete a user profile. Their tasting notes will be orphaned."""
    _validate_uuid(user_id, "user_id")
    return _delete(f"/api/users/{user_id}")
```

**Step 2: Commit**

```bash
git add mcp/server.py
git commit -m "feat: add user management MCP tools (list, create, update, delete)"
```

---

## Issue #9: Cocktail Enrichment Queue

### Task 4: Backend — Add enrichment_status to CocktailRecipe

**Files:**
- Modify: `backend/app/models/cocktail.py`
- Modify: `backend/app/schemas/cocktail.py`
- Modify: `backend/app/routers/cocktails.py`
- Create: `backend/alembic/versions/<auto>_add_cocktail_enrichment_status.py`
- Modify: `backend/tests/test_cocktails.py`

**Step 1: Write failing tests**

Add to `backend/tests/test_cocktails.py`:

```python
def test_create_cocktail_with_enrichment_pending(client):
    r = client.post("/api/cocktails", json={
        "name": "Mystery Drink",
        "enrichment_status": "pending",
    })
    assert r.status_code == 201
    assert r.json()["enrichment_status"] == "pending"


def test_create_cocktail_default_enrichment_is_none(client):
    r = client.post("/api/cocktails", json={"name": "Classic Negroni"})
    assert r.status_code == 201
    assert r.json()["enrichment_status"] is None


def test_update_cocktail_enrichment_status(client):
    r = client.post("/api/cocktails", json={
        "name": "Stub Recipe",
        "enrichment_status": "pending",
    })
    recipe_id = r.json()["id"]
    r = client.patch(f"/api/cocktails/{recipe_id}", json={
        "enrichment_status": "claude_enriched",
        "description": "A classic aperitif cocktail.",
    })
    assert r.status_code == 200
    assert r.json()["enrichment_status"] == "claude_enriched"
    assert r.json()["description"] == "A classic aperitif cocktail."
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" pytest tests/test_cocktails.py -v -k enrichment
```

Expected: FAIL

**Step 3: Update CocktailRecipe model**

In `backend/app/models/cocktail.py`, reuse the `EnrichmentStatus` enum from bottles:

```python
from app.models.bottle import EnrichmentStatus

class CocktailRecipe(Base, TimestampMixin):
    # ... existing fields ...
    enrichment_status: Mapped[EnrichmentStatus | None] = mapped_column(
        Enum(EnrichmentStatus, native_enum=False), default=None
    )
```

Note: Default is `None` (not `pending`), because most cocktails are created complete. Only stub recipes get `pending`.

**Step 4: Update schemas**

In `backend/app/schemas/cocktail.py`, add `enrichment_status` to all three schemas:

```python
from app.models.bottle import EnrichmentStatus

class CocktailOut(BaseModel):
    # ... existing fields ...
    enrichment_status: EnrichmentStatus | None = None

class CocktailCreate(BaseModel):
    # ... existing fields ...
    enrichment_status: EnrichmentStatus | None = None

class CocktailUpdate(BaseModel):
    # ... existing fields ...
    enrichment_status: EnrichmentStatus | None = None
```

**Step 5: Update router — pass enrichment_status through create**

In `backend/app/routers/cocktails.py`, update `create_cocktail` to include `enrichment_status`:

```python
@router.post("", response_model=CocktailOut, status_code=201)
def create_cocktail(data: CocktailCreate, db: Session = Depends(get_db)):
    recipe = CocktailRecipe(
        name=data.name,
        description=data.description,
        method=data.method,
        glass_type=data.glass_type,
        garnish=data.garnish,
        difficulty=data.difficulty,
        rating=data.rating,
        would_make_again=data.would_make_again,
        notes=data.notes,
        enrichment_status=data.enrichment_status,
    )
    for ing_data in data.ingredients:
        recipe.ingredients.append(RecipeIngredient(**ing_data.model_dump()))
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe
```

The PATCH endpoint already uses `model_dump(exclude_unset=True)` + `setattr`, so `enrichment_status` will flow through automatically.

**Step 6: Generate Alembic migration**

```bash
cd backend
DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" python -m alembic revision --autogenerate -m "add cocktail enrichment_status"
DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" python -m alembic upgrade head
```

**Step 7: Run tests**

```bash
cd backend && DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" pytest tests/test_cocktails.py -v
```

Expected: ALL PASS

**Step 8: Commit**

```bash
git add backend/app/models/cocktail.py backend/app/schemas/cocktail.py backend/app/routers/cocktails.py backend/tests/test_cocktails.py backend/alembic/versions/
git commit -m "feat: add enrichment_status to cocktail recipes"
```

---

### Task 5: Frontend — "Queue for enrichment" checkbox on cocktail forms

**Files:**
- Modify: `frontend/src/pages/NewCocktail.tsx`
- Modify: `frontend/src/pages/EditCocktail.tsx`
- Modify: `frontend/src/pages/Cocktails.tsx` (show enrichment badge)

**Step 1: Add checkbox to NewCocktail**

In `frontend/src/pages/NewCocktail.tsx`:

- Add state: `const [enrichmentPending, setEnrichmentPending] = useState(false);`
- Add a checkbox below the Notes field, before the submit button:

```tsx
<label className="inline-flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
  <input
    type="checkbox"
    checked={enrichmentPending}
    onChange={e => setEnrichmentPending(e.target.checked)}
    className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
  />
  Queue for AI enrichment
</label>
```

- In the submit payload, add: `enrichment_status: enrichmentPending ? 'pending' : null`

**Step 2: Add checkbox to EditCocktail**

In `frontend/src/pages/EditCocktail.tsx`:

- Add state: `const [enrichmentStatus, setEnrichmentStatus] = useState<string | null>(null);`
- Populate from loaded data: `setEnrichmentStatus(cocktail.enrichment_status || null);`
- Show checkbox (checked when status is `pending`):

```tsx
<label className="inline-flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
  <input
    type="checkbox"
    checked={enrichmentStatus === 'pending'}
    onChange={e => setEnrichmentStatus(e.target.checked ? 'pending' : null)}
    className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
  />
  Queue for AI enrichment
  {enrichmentStatus && enrichmentStatus !== 'pending' && (
    <span className="text-xs text-stone-400 ml-1">({enrichmentStatus})</span>
  )}
</label>
```

- In the submit payload, add: `enrichment_status: enrichmentStatus`

**Step 3: Show enrichment badge on Cocktails list**

In `frontend/src/pages/Cocktails.tsx`:

- Add `enrichment_status` to the `CocktailRecipe` interface: `enrichment_status: string | null;`
- In the card header, next to the "can make" badge, add:

```tsx
{recipe.enrichment_status === 'pending' && (
  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
    needs enrichment
  </span>
)}
```

**Step 4: Verify manually**

- Create a cocktail with "Queue for AI enrichment" checked → verify enrichment_status is "pending"
- Edit it → verify checkbox is checked, status shows
- View list → verify "needs enrichment" badge shows

**Step 5: Commit**

```bash
git add frontend/src/pages/NewCocktail.tsx frontend/src/pages/EditCocktail.tsx frontend/src/pages/Cocktails.tsx
git commit -m "feat: cocktail enrichment checkbox on create/edit forms, badge on list"
```

---

### Task 6: MCP — Cocktail enrichment queue tool

**Files:**
- Modify: `mcp/server.py`

**Step 1: Add cocktail enrichment tools**

In `mcp/server.py`, add near the existing enrichment section:

```python
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
    ingredients_json: JSON array, same format as add_cocktail."""
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
```

**Step 2: Commit**

```bash
git add mcp/server.py
git commit -m "feat: add cocktail enrichment queue and enrich_cocktail MCP tools"
```

---

## Final: Run all tests

```bash
cd backend && DATABASE_URL="postgresql://cellarbar:cellarbar_dev@localhost:5433/cellarbar" pytest -v
```

Expected: ALL PASS

Then rebuild Docker to pick up migrations:

```bash
docker compose up -d --build backend
```
