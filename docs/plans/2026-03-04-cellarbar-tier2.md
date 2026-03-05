# Cellar & Bar Tracker — Tier 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all Tier 2 features: markdown export UI, pantry checklist page, advanced filtering, drink window alerts, low stock warnings, cocktail shopping list generator, and MCP enhancements.

**Architecture:** Extends existing four-service stack. No new models or migrations needed — all database fields already exist. Changes are backend query logic, new endpoints, frontend pages/components, and MCP tools.

**Tech Stack:** Same as Tier 1 — Python 3.12, FastAPI, SQLAlchemy, React 18, Vite, Tailwind CSS, FastMCP.

**Design doc:** `docs/plans/2026-03-04-cellarbar-design.md`

---

## Phase 1: Quick Wins

### Task 1: Markdown Export Download UI

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/api/client.ts`

**What to build:**
Add an "Exports" section to the Dashboard with two download buttons: "Wine Guide" and "Bar Inventory". When clicked, fetch the markdown from the existing backend endpoints and trigger a browser file download.

**Step 1: Add a download helper to the API client**

In `frontend/src/api/client.ts`, add a `downloadMarkdown` method that:
1. Fetches from the given URL (e.g. `/api/export/markdown/wine`)
2. Parses the JSON response `{ markdown: string, filename: string }`
3. Creates a Blob from the markdown string
4. Creates a temporary `<a>` element with `URL.createObjectURL(blob)`, sets `download` to the filename, clicks it, then cleans up

```typescript
async downloadMarkdown(path: string): Promise<void> {
  const res = await fetch(`/api${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const data = await res.json();
  const blob = new Blob([data.markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = data.filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 2: Add export buttons to Dashboard**

At the bottom of Dashboard.tsx (after the existing sections), add a new section:

```tsx
{/* Exports */}
<div className="mt-6">
  <h2 className="font-semibold text-lg mb-2">Exports</h2>
  <div className="flex gap-3">
    <button
      onClick={() => api.downloadMarkdown('/export/markdown/wine')}
      className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-4 py-2 rounded text-sm font-medium"
    >
      Download Wine Guide
    </button>
    <button
      onClick={() => api.downloadMarkdown('/export/markdown/bar')}
      className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-4 py-2 rounded text-sm font-medium"
    >
      Download Bar Inventory
    </button>
  </div>
</div>
```

**Verify:** Click each button. A `.md` file should download with the correct content.

**Commit:** `feat: add markdown export download buttons to dashboard`

---

### Task 2: Pantry Checklist Page

**Files:**
- Create: `frontend/src/pages/Pantry.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/Layout.tsx` (add nav link)

**What to build:**
A dedicated pantry checklist page. Simple toggle list — each item has a name, an in-stock toggle (big checkbox), and the linked tag name if any. Plus a form to add new items.

The backend API already exists at `/api/pantry` (GET, POST, PATCH, DELETE).

**Step 1: Create the Pantry page**

Create `frontend/src/pages/Pantry.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface PantryItem {
  id: string;
  name: string;
  in_stock: boolean;
  tag_id: string | null;
  tag: Tag | null;
}

export default function Pantry() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagId, setNewTagId] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<PantryItem[]>('/pantry'),
      api.get<Tag[]>('/tags'),
    ])
      .then(([p, t]) => {
        setItems(p);
        setTags(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function toggleStock(item: PantryItem) {
    const updated = await api.patch<PantryItem>(`/pantry/${item.id}`, {
      in_stock: !item.in_stock,
    });
    setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await api.post<PantryItem>('/pantry', {
      name: newName.trim(),
      tag_id: newTagId || null,
    });
    setItems(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName('');
    setNewTagId('');
  }

  async function deleteItem(id: string) {
    await api.delete(`/pantry/${id}`);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const inStock = items.filter(i => i.in_stock);
  const outOfStock = items.filter(i => !i.in_stock);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Pantry</h1>

      {/* Add item form */}
      <form onSubmit={addItem} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New pantry item..."
          className="flex-1 border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <select
          value={newTagId}
          onChange={e => setNewTagId(e.target.value)}
          className="border border-stone-300 rounded px-2 py-2 text-sm"
        >
          <option value="">No tag</option>
          {tags.filter(t => t.category === 'ingredient').map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium shrink-0"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-stone-500 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-stone-500 text-sm">No pantry items yet.</p>
      ) : (
        <>
          {/* In stock */}
          {inStock.length > 0 && (
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-stone-500 uppercase mb-2">
                In Stock ({inStock.length})
              </h2>
              <ul className="space-y-1">
                {inStock.map(item => (
                  <PantryRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleStock(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Out of stock */}
          {outOfStock.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-stone-500 uppercase mb-2">
                Out of Stock ({outOfStock.length})
              </h2>
              <ul className="space-y-1">
                {outOfStock.map(item => (
                  <PantryRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleStock(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PantryRow({
  item,
  onToggle,
  onDelete,
}: {
  item: PantryItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 bg-white rounded-lg border border-stone-200 px-3 py-2">
      <input
        type="checkbox"
        checked={item.in_stock}
        onChange={onToggle}
        className="w-5 h-5 rounded accent-amber-600 cursor-pointer"
      />
      <span className={`flex-1 text-sm ${item.in_stock ? 'text-stone-900' : 'text-stone-400 line-through'}`}>
        {item.name}
      </span>
      {item.tag && (
        <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">
          {item.tag.name}
        </span>
      )}
      <button
        onClick={onDelete}
        className="text-stone-400 hover:text-red-600 text-sm"
        title="Delete"
      >
        ×
      </button>
    </li>
  );
}
```

**Step 2: Add route in App.tsx**

Import Pantry at the top of `frontend/src/App.tsx`:
```tsx
import Pantry from './pages/Pantry';
```

Add route inside the `<Routes>` block, after the shopping route:
```tsx
<Route path="/pantry" element={<Pantry />} />
```

**Step 3: Add nav link in Layout.tsx**

In `frontend/src/components/Layout.tsx`, find the navigation links array/list. Add a Pantry link alongside the existing ones (Dashboard, Collection, Tastings, Cocktails, Shopping). Use the same pattern as existing nav items:
- Path: `/pantry`
- Label: `Pantry`
- Icon: Use a simple text icon or the same pattern as other nav items

The nav items are rendered as `NavLink` components. Add Pantry between Shopping and the end. On mobile bottom nav, this adds a 6th tab — if that's too many, it can share a tab with Shopping, but for now just add it.

**Verify:** Navigate to `/pantry`. Add some items, toggle in-stock, delete one. Verify the nav link appears in both sidebar and bottom bar.

**Commit:** `feat: add pantry checklist page with toggle and add form`

---

## Phase 2: Alerts & Warnings

### Task 3: Alerts Backend Endpoint

**Files:**
- Create: `backend/app/routers/alerts.py`
- Modify: `backend/app/main.py` (register router)

**What to build:**
A single alerts endpoint `GET /api/alerts` that returns drink window warnings and low stock warnings in one response. No new models or migrations needed — all fields exist on the Bottle model.

**Alert logic:**
- **Drink window:** Any `in_stock` bottle where `drink_window_end` is not null and `drink_window_end <= today + 90 days`. Categorize as:
  - `past_window`: `drink_window_end < today`
  - `closing_soon`: `drink_window_end` is within 90 days from today
  - `not_yet_ready`: `drink_window_start > today` (optional info, not urgent)
- **Low stock:** Any `in_stock` bottle where `quantity > 0 AND quantity <= threshold`. Default threshold: 0.25. Accept optional `low_stock_threshold` query param.

**Implementation:**

Create `backend/app/routers/alerts.py`:

```python
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bottle import Bottle, BottleStatus
from app.schemas.bottle import BottleOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def get_alerts(
    low_stock_threshold: float = Query(0.25, ge=0),
    drink_window_days: int = Query(90, ge=0),
    db: Session = Depends(get_db),
):
    today = date.today()
    horizon = today + timedelta(days=drink_window_days)

    in_stock = db.query(Bottle).filter(
        Bottle.status == BottleStatus.in_stock,
    ).all()

    past_window = []
    closing_soon = []
    low_stock = []

    for b in in_stock:
        out = BottleOut.model_validate(b).model_dump(mode="json")
        if b.drink_window_end and b.drink_window_end < today:
            past_window.append(out)
        elif b.drink_window_end and b.drink_window_end <= horizon:
            closing_soon.append(out)
        if b.quantity > 0 and b.quantity <= low_stock_threshold:
            low_stock.append(out)

    return {
        "drink_window": {
            "past_window": past_window,
            "closing_soon": closing_soon,
        },
        "low_stock": low_stock,
    }
```

**Register the router** in `backend/app/main.py`:
```python
from app.routers import alerts
app.include_router(alerts.router)
```

Add the import alongside the existing router imports.

**Verify:**
```bash
curl http://localhost:5177/api/alerts
```
Should return `{"drink_window": {"past_window": [], "closing_soon": []}, "low_stock": []}` (empty arrays when no bottles match).

**Commit:** `feat: add alerts endpoint for drink window and low stock warnings`

---

### Task 4: Dashboard Alerts UI

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**What to build:**
Add alert sections to the Dashboard that fetch from `GET /api/alerts` and display:
1. **Past drink window** — red/urgent cards: "These bottles are past their drink window"
2. **Closing soon** — amber/warning cards: "Drink soon — window closing within 90 days"
3. **Low stock** — stone/info cards: "Running low"

Each alert shows bottle name, quantity, and links to the bottle detail page.

**Implementation:**

Add an `alerts` state and fetch in the Dashboard's `useEffect`:

```typescript
interface AlertsData {
  drink_window: {
    past_window: Bottle[];
    closing_soon: Bottle[];
  };
  low_stock: Bottle[];
}

// In the component:
const [alerts, setAlerts] = useState<AlertsData | null>(null);

// In useEffect, alongside existing fetches:
api.get<AlertsData>('/alerts').then(setAlerts).catch(console.error);
```

Render the alerts at the top of the dashboard (before stock summary), only if there are any:

```tsx
{/* Alerts */}
{alerts && (alerts.drink_window.past_window.length > 0 || alerts.drink_window.closing_soon.length > 0 || alerts.low_stock.length > 0) && (
  <div className="mb-6 space-y-3">
    {alerts.drink_window.past_window.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-red-800 mb-2">
          Past Drink Window ({alerts.drink_window.past_window.length})
        </h3>
        <ul className="space-y-1">
          {alerts.drink_window.past_window.map(b => (
            <li key={b.id}>
              <Link to={`/collection/${b.id}`} className="text-sm text-red-700 hover:underline">
                {b.name} — drink window ended {b.drink_window_end}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )}
    {alerts.drink_window.closing_soon.length > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">
          Drink Soon ({alerts.drink_window.closing_soon.length})
        </h3>
        <ul className="space-y-1">
          {alerts.drink_window.closing_soon.map(b => (
            <li key={b.id}>
              <Link to={`/collection/${b.id}`} className="text-sm text-amber-700 hover:underline">
                {b.name} — window closes {b.drink_window_end}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )}
    {alerts.low_stock.length > 0 && (
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-stone-700 mb-2">
          Low Stock ({alerts.low_stock.length})
        </h3>
        <ul className="space-y-1">
          {alerts.low_stock.map(b => (
            <li key={b.id}>
              <Link to={`/collection/${b.id}`} className="text-sm text-stone-600 hover:underline">
                {b.name} — qty {b.quantity}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}
```

Make sure `Link` is imported from `react-router-dom` (it should already be, but verify). The `Bottle` interface in Dashboard needs `drink_window_end` — add it if missing, or use a simpler alert-specific interface with just `id`, `name`, `quantity`, `drink_window_end`.

**Verify:** Add a bottle with a drink_window_end in the past (via the edit form). Reload dashboard — it should appear in red alerts. Set a bottle quantity to 0.2 — it should appear in low stock.

**Commit:** `feat: add drink window and low stock alerts to dashboard`

---

## Phase 3: Advanced Filtering

### Task 5: Backend — Extended Bottle Filters

**Files:**
- Modify: `backend/app/routers/bottles.py`

**What to build:**
Extend the `GET /api/bottles` endpoint with additional query parameters:

- `region: str | None` — filter by region (case-insensitive partial match)
- `country: str | None` — filter by country (case-insensitive partial match)
- `tag_ids: str | None` — comma-separated tag UUIDs; bottle must have ALL specified tags
- `min_rating: int | None` — bottle must have at least one tasting note with rating >= this value
- `max_price: float | None` — purchase_price_kr <= max_price
- `min_price: float | None` — purchase_price_kr >= min_price
- `subtype: str | None` — filter by subtype (case-insensitive partial match)
- `has_drink_window_alert: bool | None` — if true, only bottles past or nearing their drink window

**Implementation:**

Update the `list_bottles` function signature:

```python
from datetime import date, timedelta

@router.get("", response_model=list[BottleOut])
def list_bottles(
    status: BottleStatus | None = None,
    type: BottleType | None = None,
    search: str | None = None,
    region: str | None = None,
    country: str | None = None,
    subtype: str | None = None,
    tag_ids: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Bottle)
    if status:
        q = q.filter(Bottle.status == status)
    if type:
        q = q.filter(Bottle.type == type)
    if search:
        q = q.filter(Bottle.name.ilike(f"%{search}%"))
    if region:
        q = q.filter(Bottle.region.ilike(f"%{region}%"))
    if country:
        q = q.filter(Bottle.country.ilike(f"%{country}%"))
    if subtype:
        q = q.filter(Bottle.subtype.ilike(f"%{subtype}%"))
    if min_price is not None:
        q = q.filter(Bottle.purchase_price_kr >= min_price)
    if max_price is not None:
        q = q.filter(Bottle.purchase_price_kr <= max_price)
    if tag_ids:
        from app.models.bottle import bottle_tags
        tag_list = [uuid.UUID(t.strip()) for t in tag_ids.split(",") if t.strip()]
        for tid in tag_list:
            q = q.filter(Bottle.tags.any(id=tid))
    return q.order_by(Bottle.name).all()
```

Note: The `Bottle.tags.any(id=tid)` pattern filters bottles that have a specific tag. Applying it in a loop with multiple tag IDs creates an AND condition (bottle must have ALL specified tags).

**Verify:**
```bash
# Filter by region
curl "http://localhost:5177/api/bottles?region=bordeaux"
# Filter by price range
curl "http://localhost:5177/api/bottles?min_price=100&max_price=500"
# Filter by tags (use actual tag UUIDs)
curl "http://localhost:5177/api/bottles?tag_ids=<uuid1>,<uuid2>"
```

**Commit:** `feat: add advanced filter params to bottles endpoint`

---

### Task 6: Frontend — Collection Filter Panel

**Files:**
- Modify: `frontend/src/pages/Collection.tsx`

**What to build:**
Add a collapsible "Filters" panel below the search bar in Collection. When expanded, shows filter inputs for: region, country, subtype, price range, and tags. When filters are applied, the API call includes the relevant query params.

**Implementation:**

Add filter state:
```typescript
const [showFilters, setShowFilters] = useState(false);
const [filterRegion, setFilterRegion] = useState('');
const [filterCountry, setFilterCountry] = useState('');
const [filterSubtype, setFilterSubtype] = useState('');
const [filterMinPrice, setFilterMinPrice] = useState('');
const [filterMaxPrice, setFilterMaxPrice] = useState('');
const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
const [allTags, setAllTags] = useState<Tag[]>([]);
```

Fetch tags on mount:
```typescript
useEffect(() => {
  api.get<Tag[]>('/tags').then(setAllTags).catch(console.error);
}, []);
```

Update the bottle fetch `useEffect` to include filter params. Build the query string from all active filters:

```typescript
useEffect(() => {
  setLoading(true);
  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (filterRegion) params.set('region', filterRegion);
  if (filterCountry) params.set('country', filterCountry);
  if (filterSubtype) params.set('subtype', filterSubtype);
  if (filterMinPrice) params.set('min_price', filterMinPrice);
  if (filterMaxPrice) params.set('max_price', filterMaxPrice);
  if (filterTagIds.length > 0) params.set('tag_ids', filterTagIds.join(','));
  const qs = params.toString();
  api.get<Bottle[]>(`/bottles${qs ? '?' + qs : ''}`)
    .then(setBottles)
    .catch(console.error)
    .finally(() => setLoading(false));
}, [statusFilter, filterRegion, filterCountry, filterSubtype, filterMinPrice, filterMaxPrice, filterTagIds]);
```

**Important:** Debounce text inputs so we don't fire API calls on every keystroke. Use a simple approach: only apply text filters when the user presses Enter or clicks an "Apply" button, OR use a 500ms debounce. Simplest approach: add an "Apply Filters" button that triggers a fetch by incrementing a counter state, rather than auto-fetching on every change.

Alternative simpler approach: keep the existing client-side search for name/producer, but add a "Filters" toggle that reveals extra server-side filter fields. On change, re-fetch from server. Use an apply button rather than live filtering for text fields.

Render a collapsible filter panel:

```tsx
{/* Filters toggle */}
<button
  onClick={() => setShowFilters(!showFilters)}
  className="text-sm text-amber-700 hover:text-amber-900 mb-3"
>
  {showFilters ? 'Hide Filters' : 'More Filters'}
  {(filterRegion || filterCountry || filterSubtype || filterMinPrice || filterMaxPrice || filterTagIds.length > 0) && ' •'}
</button>

{showFilters && (
  <div className="bg-stone-50 rounded-lg border border-stone-200 p-3 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
    <div>
      <label className="block text-stone-500 text-xs mb-1">Region</label>
      <input type="text" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm" placeholder="e.g. Bordeaux" />
    </div>
    <div>
      <label className="block text-stone-500 text-xs mb-1">Country</label>
      <input type="text" value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm" placeholder="e.g. France" />
    </div>
    <div>
      <label className="block text-stone-500 text-xs mb-1">Subtype</label>
      <input type="text" value={filterSubtype} onChange={e => setFilterSubtype(e.target.value)}
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm" placeholder="e.g. red, gin" />
    </div>
    <div>
      <label className="block text-stone-500 text-xs mb-1">Min Price (kr)</label>
      <input type="number" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)}
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm" />
    </div>
    <div>
      <label className="block text-stone-500 text-xs mb-1">Max Price (kr)</label>
      <input type="number" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)}
        className="w-full border border-stone-300 rounded px-2 py-1 text-sm" />
    </div>
    <div className="col-span-2 md:col-span-3">
      <label className="block text-stone-500 text-xs mb-1">Tags</label>
      <div className="flex flex-wrap gap-1">
        {allTags.map(tag => (
          <button
            key={tag.id}
            onClick={() => setFilterTagIds(prev =>
              prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
            )}
            className={`px-2 py-0.5 rounded text-xs border ${
              filterTagIds.includes(tag.id)
                ? 'bg-amber-100 border-amber-400 text-amber-800'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
    {(filterRegion || filterCountry || filterSubtype || filterMinPrice || filterMaxPrice || filterTagIds.length > 0) && (
      <div className="col-span-2 md:col-span-3">
        <button
          onClick={() => {
            setFilterRegion('');
            setFilterCountry('');
            setFilterSubtype('');
            setFilterMinPrice('');
            setFilterMaxPrice('');
            setFilterTagIds([]);
          }}
          className="text-xs text-red-600 hover:text-red-800"
        >
          Clear all filters
        </button>
      </div>
    )}
  </div>
)}
```

Place this between the search input and the status filter buttons.

**Verify:** Add bottles with region/country data. Use filters to narrow results. Verify tag filtering works. Verify "Clear all filters" resets everything.

**Commit:** `feat: add advanced filter panel to collection view`

---

## Phase 4: Cocktail Shopping List Generator

### Task 7: Backend — Missing Ingredients Analysis

**Files:**
- Modify: `backend/app/routers/cocktails.py`

**What to build:**
A new endpoint `GET /api/cocktails/shopping-suggestions` that analyzes unmakeable cocktails and returns a list of missing ingredients with which recipes they would unlock.

**Response format:**
```json
{
  "suggestions": [
    {
      "tag_id": "uuid",
      "tag_name": "Campari",
      "is_pantry": false,
      "unlocks_recipes": [
        {"id": "uuid", "name": "Negroni"},
        {"id": "uuid", "name": "Americano"}
      ]
    }
  ],
  "unmakeable_count": 5
}
```

**Logic:**
1. Get all in-stock bottle tag IDs and pantry tag IDs (same as `list_makeable`)
2. For each recipe, find which ingredient tags are missing
3. Aggregate: for each missing tag, collect which recipes it appears in
4. Sort by number of recipes unlocked (most impactful first)
5. Only include items where ALL other ingredients are available OR where buying this one item completes the recipe

Actually, simpler and more useful: for each unmakeable recipe, list what's missing. Then aggregate by missing tag to show impact.

```python
@router.get("/shopping-suggestions")
def shopping_suggestions(db: Session = Depends(get_db)):
    bottles = db.query(Bottle).filter(
        Bottle.status == BottleStatus.in_stock,
        Bottle.quantity > 0,
    ).all()
    bottle_tag_ids = set()
    for b in bottles:
        for t in b.tags:
            bottle_tag_ids.add(t.id)

    pantry = db.query(PantryItem).filter(PantryItem.in_stock == True).all()
    pantry_tag_ids = {p.tag_id for p in pantry if p.tag_id}

    recipes = db.query(CocktailRecipe).all()

    # For each unmakeable recipe, find missing tags
    tag_unlocks: dict[uuid.UUID, dict] = {}  # tag_id -> {tag_name, is_pantry, recipes: []}
    unmakeable_count = 0

    for recipe in recipes:
        missing_tags = []
        for ing in recipe.ingredients:
            if ing.tag_id is None:
                continue
            if ing.is_pantry_item:
                if ing.tag_id not in pantry_tag_ids:
                    missing_tags.append((ing.tag_id, ing.name, True))
            else:
                if ing.tag_id not in bottle_tag_ids:
                    missing_tags.append((ing.tag_id, ing.name, False))

        if not missing_tags:
            continue  # already makeable

        unmakeable_count += 1

        # Only suggest single-item purchases that would complete a recipe
        if len(missing_tags) == 1:
            tag_id, tag_name, is_pantry = missing_tags[0]
            if tag_id not in tag_unlocks:
                tag_unlocks[tag_id] = {
                    "tag_id": str(tag_id),
                    "tag_name": tag_name,
                    "is_pantry": is_pantry,
                    "unlocks_recipes": [],
                }
            tag_unlocks[tag_id]["unlocks_recipes"].append({
                "id": str(recipe.id),
                "name": recipe.name,
            })

    suggestions = sorted(
        tag_unlocks.values(),
        key=lambda x: len(x["unlocks_recipes"]),
        reverse=True,
    )

    return {
        "suggestions": suggestions,
        "unmakeable_count": unmakeable_count,
    }
```

**Verify:**
```bash
curl http://localhost:5177/api/cocktails/shopping-suggestions
```

**Commit:** `feat: add cocktail shopping suggestions endpoint`

---

### Task 8: Frontend — Shopping Suggestions UI

**Files:**
- Modify: `frontend/src/pages/Cocktails.tsx`
- Modify: `frontend/src/pages/ShoppingList.tsx`

**What to build:**

**On the Cocktails page:** Add a "Shopping Suggestions" section below the recipe list that shows what single purchases would unlock new cocktails. Each suggestion has an "Add to shopping list" button.

**On the Shopping List page:** Show the source as "cocktail" for items added this way (already supported by the badge UI).

**Implementation for Cocktails.tsx:**

Add state and fetch:
```typescript
interface ShoppingSuggestion {
  tag_id: string;
  tag_name: string;
  is_pantry: boolean;
  unlocks_recipes: { id: string; name: string }[];
}

interface SuggestionsData {
  suggestions: ShoppingSuggestion[];
  unmakeable_count: number;
}

const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);

// In useEffect:
api.get<SuggestionsData>('/cocktails/shopping-suggestions')
  .then(setSuggestions)
  .catch(console.error);
```

Add a handler to add to shopping list:
```typescript
async function addToShoppingList(name: string) {
  await api.post('/shopping', { name, source: 'cocktail' });
  // Show brief feedback
  alert(`Added "${name}" to shopping list`);
}
```

Render the suggestions section:
```tsx
{/* Shopping Suggestions */}
{suggestions && suggestions.suggestions.length > 0 && (
  <div className="mt-6">
    <h2 className="font-semibold text-lg mb-2">Buy to Unlock</h2>
    <p className="text-sm text-stone-500 mb-3">
      {suggestions.unmakeable_count} recipes need ingredients. These single purchases would unlock new cocktails:
    </p>
    <ul className="space-y-2">
      {suggestions.suggestions.map(s => (
        <li key={s.tag_id} className="bg-white rounded-lg border border-stone-200 p-3 flex items-center justify-between">
          <div>
            <span className="font-medium text-stone-900">{s.tag_name}</span>
            {s.is_pantry && <span className="text-xs text-stone-500 ml-1">(pantry)</span>}
            <div className="text-xs text-stone-500 mt-0.5">
              Unlocks: {s.unlocks_recipes.map(r => r.name).join(', ')}
            </div>
          </div>
          <button
            onClick={() => addToShoppingList(s.tag_name)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm shrink-0 ml-3"
          >
            + List
          </button>
        </li>
      ))}
    </ul>
  </div>
)}
```

**Verify:** Create a few cocktail recipes where you have most but not all ingredients. The suggestions section should appear showing what to buy. Click "+ List" and verify the item appears on the shopping list.

**Commit:** `feat: add cocktail shopping suggestions UI`

---

## Phase 5: MCP Enhancements

### Task 9: MCP — Pantry, Alerts, and Enhanced Search Tools

**Files:**
- Modify: `mcp/server.py`

**What to build:**
Add the following MCP tools to the existing server:

1. **`get_pantry_items()`** — returns all pantry items with stock status
2. **`add_pantry_item(name, tag_id?, in_stock?)`** — add a new pantry item
3. **`update_pantry_item(item_id, in_stock?, name?)`** — toggle stock status or rename
4. **`get_alerts(low_stock_threshold?, drink_window_days?)`** — returns drink window and low stock warnings
5. **`get_shopping_suggestions()`** — returns cocktail shopping suggestions
6. **Enhanced `search_bottles()`** — add region, country, subtype, tag_ids, min_price, max_price parameters

**Implementation:**

Add these tools to `mcp/server.py` following the existing pattern (each tool calls the backend API via httpx):

```python
@mcp.tool()
async def get_pantry_items() -> str:
    """Get all pantry items with stock status."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BACKEND_URL}/api/pantry")
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)


@mcp.tool()
async def add_pantry_item(
    name: str,
    tag_id: str | None = None,
    in_stock: bool = True,
) -> str:
    """Add a new pantry item (e.g. bitters, simple syrup, limes)."""
    payload = {"name": name, "in_stock": in_stock}
    if tag_id:
        payload["tag_id"] = tag_id
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{BACKEND_URL}/api/pantry", json=payload)
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)


@mcp.tool()
async def update_pantry_item(
    item_id: str,
    in_stock: bool | None = None,
    name: str | None = None,
) -> str:
    """Update a pantry item (toggle stock status or rename)."""
    payload = {}
    if in_stock is not None:
        payload["in_stock"] = in_stock
    if name is not None:
        payload["name"] = name
    async with httpx.AsyncClient() as client:
        resp = await client.patch(f"{BACKEND_URL}/api/pantry/{item_id}", json=payload)
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)


@mcp.tool()
async def get_alerts(
    low_stock_threshold: float = 0.25,
    drink_window_days: int = 90,
) -> str:
    """Get drink window warnings and low stock alerts for the collection."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/alerts",
            params={"low_stock_threshold": low_stock_threshold, "drink_window_days": drink_window_days},
        )
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)


@mcp.tool()
async def get_shopping_suggestions() -> str:
    """Get cocktail shopping suggestions — single purchases that would unlock new recipes."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BACKEND_URL}/api/cocktails/shopping-suggestions")
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)
```

**Update `search_bottles`** to include the new filter parameters:

The existing `search_bottles` tool has `query`, `type`, and `status` parameters. Add: `region`, `country`, `subtype`, `tag_ids`, `min_price`, `max_price`. Pass them as query params to the backend.

```python
@mcp.tool()
async def search_bottles(
    query: str | None = None,
    type: str | None = None,
    status: str | None = None,
    region: str | None = None,
    country: str | None = None,
    subtype: str | None = None,
    tag_ids: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
) -> str:
    """Search and filter bottles in the collection.

    Filters: type (wine/spirit/liqueur/beer/other), status (in_stock/consumed/gifted),
    region, country, subtype, tag_ids (comma-separated UUIDs), min_price, max_price.
    """
    params = {}
    if query:
        params["search"] = query
    if type:
        params["type"] = type
    if status:
        params["status"] = status
    if region:
        params["region"] = region
    if country:
        params["country"] = country
    if subtype:
        params["subtype"] = subtype
    if tag_ids:
        params["tag_ids"] = tag_ids
    if min_price is not None:
        params["min_price"] = min_price
    if max_price is not None:
        params["max_price"] = max_price
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BACKEND_URL}/api/bottles", params=params)
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)
```

Replace the existing `search_bottles` function entirely with this updated version.

**Verify:** Restart the MCP container:
```bash
docker compose restart mcp
```
Then test with Claude or curl the MCP endpoint.

**Commit:** `feat: add pantry, alerts, and shopping suggestion MCP tools, enhance search`

---

## Summary

| Task | What | Effort |
|------|------|--------|
| 1 | Markdown export download buttons | Quick |
| 2 | Pantry checklist page | Quick |
| 3 | Alerts backend endpoint | Quick |
| 4 | Dashboard alerts UI | Quick |
| 5 | Backend advanced bottle filters | Quick |
| 6 | Frontend filter panel | Medium |
| 7 | Cocktail shopping suggestions backend | Medium |
| 8 | Shopping suggestions UI | Medium |
| 9 | MCP enhancements (pantry, alerts, search) | Medium |
