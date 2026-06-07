# Issue Fixes: MCP Tags, Enrichment Defaults, Cocktail Edit UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three open issues: add tag assignment to MCP bottle tools (#5), smarter enrichment defaults (#6), and cocktail editing UI (#8).

**Architecture:** Issue #5 is a MCP-only change (backend already supports `tag_ids`). Issue #6 adds auto-detection of enrichment completeness in the backend create endpoint. Issue #8 converts the existing `NewCocktail.tsx` form into a shared form component usable for both create and edit, plus adds a route and edit button.

**Tech Stack:** Python/FastAPI backend, React/TypeScript frontend, FastMCP server

---

## Task 1: Add `tag_ids` to MCP bottle tools (#5)

The backend API already accepts `tag_ids` on create and update. The MCP tools just don't pass it through.

**Files:**
- Modify: `mcp/server.py:113-176` (add_bottle, update_bottle) and `:434-456` (enrich_bottle)

**Step 1: Add `tag_ids` parameter to `add_bottle`**

In `mcp/server.py`, update the `add_bottle` function signature and body:

```python
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
    Set enrichment_status to 'manual' or 'confirmed' to skip the enrichment queue.
    Pass tag_ids as a list of tag UUIDs to link ingredient/flavor tags."""
    data = {"name": name, "type": type, "quantity": quantity}
    for field in ["purchase_price_kr", "producer", "subtype", "vintage", "region",
                  "country", "grape_or_base", "abv", "volume_ml", "barcode", "notes",
                  "serving_temp", "suggested_pairings", "enrichment_status"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    if tag_ids is not None:
        data["tag_ids"] = tag_ids
    return _post("/api/bottles", json=data)
```

**Step 2: Add `tag_ids` parameter to `update_bottle`**

```python
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
    Pass tag_ids as a list of tag UUIDs to replace the bottle's tags."""
    updates = {}
    for field in ["name", "producer", "type", "subtype", "vintage", "region", "country",
                  "grape_or_base", "abv", "volume_ml", "purchase_price_kr", "barcode",
                  "notes", "serving_temp", "suggested_pairings", "enrichment_status", "status"]:
        val = locals()[field]
        if val is not None:
            updates[field] = val
    if tag_ids is not None:
        updates["tag_ids"] = tag_ids
    return _patch(f"/api/bottles/{bottle_id}", json=updates)
```

**Step 3: Add `tag_ids` parameter to `enrich_bottle`**

```python
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
    Pass tag_ids to link ingredient/flavor tags (e.g. 'gin', 'fruity')."""
    data = {"enrichment_status": "claude_enriched"}
    for field in ["producer", "region", "country", "grape_or_base", "abv",
                  "volume_ml", "subtype", "serving_temp", "suggested_pairings", "notes"]:
        val = locals()[field]
        if val is not None:
            data[field] = val
    if tag_ids is not None:
        data["tag_ids"] = tag_ids
    return _patch(f"/api/bottles/{bottle_id}", json=data)
```

**Step 4: Commit**

```bash
git add mcp/server.py
git commit -m "feat: add tag_ids to MCP bottle tools (closes #5)"
```

---

## Task 2: Smarter enrichment defaults (#6)

Bottles added with substantial data shouldn't default to `pending`. Auto-detect completeness.

**Files:**
- Modify: `backend/app/routers/bottles.py:60-71` (create_bottle endpoint)
- Test: `backend/tests/test_bottles.py`

**Step 1: Write the failing tests**

Add to `backend/tests/test_bottles.py`:

```python
def test_create_bottle_minimal_defaults_to_pending(client):
    """Bottles with just name+type should be pending enrichment."""
    r = client.post("/api/bottles", json={"name": "Mystery Wine", "type": "wine", "quantity": 1})
    assert r.json()["enrichment_status"] == "pending"


def test_create_bottle_complete_defaults_to_confirmed(client):
    """Bottles with enough fields filled should auto-confirm."""
    r = client.post("/api/bottles", json={
        "name": "Barolo Riserva", "type": "wine", "quantity": 1,
        "producer": "Giacomo Conterno", "region": "Piedmont", "country": "Italy",
        "grape_or_base": "Nebbiolo", "abv": 14.0,
    })
    assert r.json()["enrichment_status"] == "confirmed"


def test_create_bottle_explicit_enrichment_status_overrides(client):
    """Explicit enrichment_status should always win, even for incomplete bottles."""
    r = client.post("/api/bottles", json={
        "name": "Quick Add", "type": "spirit", "quantity": 1,
        "enrichment_status": "manual",
    })
    assert r.json()["enrichment_status"] == "manual"
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_bottles.py::test_create_bottle_complete_defaults_to_confirmed -v`
Expected: FAIL — returns `"pending"` instead of `"confirmed"`

**Step 3: Implement auto-detection in create endpoint**

Modify `backend/app/routers/bottles.py`, update the `create_bottle` function:

```python
# Key enrichment fields — if 3+ are filled, the bottle is considered complete
_ENRICHMENT_FIELDS = ("producer", "region", "country", "grape_or_base", "abv")
_ENRICHMENT_THRESHOLD = 3


@router.post("", response_model=BottleOut, status_code=201)
def create_bottle(data: BottleCreate, db: Session = Depends(get_db)):
    fields = data.model_dump(exclude={"tag_ids"})
    fields["quantity_purchased"] = data.quantity
    # Auto-detect enrichment status if not explicitly set
    if data.enrichment_status is None:
        filled = sum(1 for f in _ENRICHMENT_FIELDS if fields.get(f) is not None)
        if filled >= _ENRICHMENT_THRESHOLD:
            fields["enrichment_status"] = EnrichmentStatus.confirmed
    bottle = Bottle(**fields)
    if data.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all()
        bottle.tags = tags
    db.add(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle
```

Note: Add `EnrichmentStatus` to the import at the top of the file:
```python
from app.models.bottle import Bottle, BottleStatus, BottleType, EnrichmentStatus
```

Also add `enrichment_status` to `BottleCreate` in `backend/app/schemas/bottle.py` if not already present (it is already there implicitly — check that `BottleCreate` does NOT currently have it, and add it):

In `backend/app/schemas/bottle.py`, add to `BottleCreate`:
```python
    enrichment_status: EnrichmentStatus | None = None
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_bottles.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/app/routers/bottles.py backend/app/schemas/bottle.py backend/tests/test_bottles.py
git commit -m "feat: auto-detect enrichment status on bottle creation (closes #6)"
```

---

## Task 3: Cocktail edit UI (#8)

The backend PATCH endpoint already works. We need to: (a) refactor `NewCocktail.tsx` into a shared form, (b) create an edit page that loads existing data, (c) add an edit button and route.

**Files:**
- Create: `frontend/src/pages/EditCocktail.tsx`
- Modify: `frontend/src/pages/Cocktails.tsx` (add edit button in expanded view)
- Modify: `frontend/src/App.tsx` (add route)

**Approach:** Rather than extract a shared form component (YAGNI — we have only 2 pages), create `EditCocktail.tsx` as a copy of `NewCocktail.tsx` that pre-populates from the API and PATCHes instead of POSTs. This avoids refactoring the create form.

**Step 1: Create `EditCocktail.tsx`**

Create `frontend/src/pages/EditCocktail.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface IngredientRow {
  key: number;
  name: string;
  amount_cl: string;
  tag_id: string;
  is_pantry_item: boolean;
}

interface CocktailData {
  id: string;
  name: string;
  description: string | null;
  method: string | null;
  glass_type: string | null;
  garnish: string | null;
  difficulty: string | null;
  notes: string | null;
  ingredients: {
    id: string;
    name: string;
    amount_cl: number | null;
    tag: { id: string; name: string; category: string } | null;
    is_pantry_item: boolean;
  }[];
}

let nextKey = 0;

function emptyIngredient(): IngredientRow {
  return { key: nextKey++, name: '', amount_cl: '', tag_id: '', is_pantry_item: false };
}

export default function EditCocktail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('');
  const [glassType, setGlassType] = useState('');
  const [garnish, setGarnish] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Tag[]>('/tags?category=ingredient'),
      api.get<CocktailData>(`/cocktails/${id}`),
    ])
      .then(([tagList, cocktail]) => {
        setTags(tagList);
        setName(cocktail.name);
        setDescription(cocktail.description || '');
        setMethod(cocktail.method || '');
        setGlassType(cocktail.glass_type || '');
        setGarnish(cocktail.garnish || '');
        setDifficulty(cocktail.difficulty || '');
        setNotes(cocktail.notes || '');
        if (cocktail.ingredients.length > 0) {
          setIngredients(
            cocktail.ingredients.map(ing => ({
              key: nextKey++,
              name: ing.name,
              amount_cl: ing.amount_cl != null ? String(ing.amount_cl) : '',
              tag_id: ing.tag?.id || '',
              is_pantry_item: ing.is_pantry_item,
            })),
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function updateIngredient(key: number, field: keyof IngredientRow, value: string | boolean) {
    setIngredients(prev =>
      prev.map(ing => (ing.key === key ? { ...ing, [field]: value } : ing)),
    );
  }

  function addIngredient() {
    setIngredients(prev => [...prev, emptyIngredient()]);
  }

  function removeIngredient(key: number) {
    setIngredients(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(ing => ing.key !== key);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const validIngredients = ingredients
      .filter(ing => ing.name.trim())
      .map(ing => ({
        name: ing.name.trim(),
        amount_cl: ing.amount_cl ? parseFloat(ing.amount_cl) : null,
        tag_id: ing.tag_id || null,
        is_pantry_item: ing.is_pantry_item,
      }));

    setSubmitting(true);
    setError('');

    try {
      await api.patch(`/cocktails/${id}`, {
        name: name.trim(),
        description: description.trim() || null,
        method: method || null,
        glass_type: glassType.trim() || null,
        garnish: garnish.trim() || null,
        difficulty: difficulty || null,
        notes: notes.trim() || null,
        ingredients: validIngredients,
      });
      navigate('/cocktails');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe');
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-stone-500 text-sm">Loading recipe...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/cocktails" className="text-amber-700 hover:underline text-sm">
        &larr; Back to cocktails
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-4">Edit Cocktail Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Method & Difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select --</option>
              <option value="shake">Shake</option>
              <option value="stir">Stir</option>
              <option value="build">Build</option>
              <option value="blend">Blend</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select --</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Glass type & Garnish */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Glass Type</label>
            <input
              type="text"
              value={glassType}
              onChange={e => setGlassType(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Garnish</label>
            <input
              type="text"
              value={garnish}
              onChange={e => setGarnish(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={ing.key} className="flex gap-2 items-start bg-stone-50 rounded-lg p-2 border border-stone-100">
                <div className="text-xs text-stone-400 mt-2 w-4 text-center shrink-0">{idx + 1}</div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={e => updateIngredient(ing.key, 'name', e.target.value)}
                    placeholder="Ingredient name"
                    className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="number"
                    value={ing.amount_cl}
                    onChange={e => updateIngredient(ing.key, 'amount_cl', e.target.value)}
                    placeholder="Amount (cl)"
                    min="0"
                    step="0.5"
                    className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    value={ing.tag_id}
                    onChange={e => updateIngredient(ing.key, 'tag_id', e.target.value)}
                    className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Tag (optional) --</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-sm text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ing.is_pantry_item}
                      onChange={e => updateIngredient(ing.key, 'is_pantry_item', e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    Pantry item
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredient(ing.key)}
                  className="text-stone-400 hover:text-red-600 text-sm mt-1 shrink-0 px-1"
                  title="Remove ingredient"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            + Add ingredient
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2.5 rounded font-medium text-sm"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Add route in App.tsx**

In `frontend/src/App.tsx`, add the import and route:

```tsx
import EditCocktail from './pages/EditCocktail';
```

Add this route after the `NewCocktail` route (line 46):
```tsx
<Route path="/cocktails/:id/edit" element={<EditCocktail />} />
```

**Step 3: Add edit button in Cocktails.tsx expanded view**

In `frontend/src/pages/Cocktails.tsx`, add a `Link` import (already has it) and an Edit button next to the Delete button in the expanded detail section. Find the `<div className="pt-2">` near line 278 and replace:

```tsx
                    <div className="pt-2 flex items-center gap-4">
                      <Link
                        to={`/cocktails/${recipe.id}/edit`}
                        className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                      >
                        Edit recipe
                      </Link>
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete recipe
                      </button>
                    </div>
```

**Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/pages/EditCocktail.tsx frontend/src/pages/Cocktails.tsx frontend/src/App.tsx
git commit -m "feat: add cocktail recipe editing UI (closes #8)"
```
