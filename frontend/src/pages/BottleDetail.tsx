import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';
import ImageUpload from '../components/ImageUpload';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface Bottle {
  id: string;
  name: string;
  producer: string | null;
  type: string;
  subtype: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  grape_or_base: string | null;
  abv: number | null;
  volume_ml: number | null;
  purchase_price_kr: number | null;
  purchase_date: string | null;
  source_shop: string | null;
  quantity: number;
  status: string;
  barcode: string | null;
  enrichment_status: string;
  image_path: string | null;
  serving_temp: string | null;
  drink_window_start: string | null;
  drink_window_end: string | null;
  notes: string | null;
  suggested_pairings: string | null;
  tags: Tag[];
}

interface TastingUser {
  id: string;
  name: string;
}

interface Tasting {
  id: string;
  bottle_id: string;
  user_id: string;
  user: TastingUser;
  tasted_at: string;
  notes: string | null;
  rating: number;
  food_pairing: string | null;
  pairing_rating: number | null;
  would_drink_again: boolean | null;
}

interface EditForm {
  name: string;
  producer: string;
  type: string;
  subtype: string;
  vintage: string;
  region: string;
  country: string;
  grape_or_base: string;
  abv: string;
  volume_ml: string;
  purchase_price_kr: string;
  purchase_date: string;
  source_shop: string;
  barcode: string;
  serving_temp: string;
  drink_window_start: string;
  drink_window_end: string;
  notes: string;
  suggested_pairings: string;
}

const ENRICHMENT_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  auto_enriched: { label: 'Auto-enriched', bg: 'bg-blue-100', text: 'text-blue-800' },
  claude_enriched: { label: 'Claude-enriched', bg: 'bg-purple-100', text: 'text-purple-800' },
  manual: { label: 'Manual', bg: 'bg-stone-100', text: 'text-stone-700' },
  confirmed: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-800' },
};

const BOTTLE_TYPES = ['wine', 'spirit', 'liqueur', 'beer', 'other'];

function bottleToForm(b: Bottle): EditForm {
  return {
    name: b.name,
    producer: b.producer ?? '',
    type: b.type,
    subtype: b.subtype ?? '',
    vintage: b.vintage != null ? String(b.vintage) : '',
    region: b.region ?? '',
    country: b.country ?? '',
    grape_or_base: b.grape_or_base ?? '',
    abv: b.abv != null ? String(b.abv) : '',
    volume_ml: b.volume_ml != null ? String(b.volume_ml) : '',
    purchase_price_kr: b.purchase_price_kr != null ? String(b.purchase_price_kr) : '',
    purchase_date: b.purchase_date ?? '',
    source_shop: b.source_shop ?? '',
    barcode: b.barcode ?? '',
    serving_temp: b.serving_temp ?? '',
    drink_window_start: b.drink_window_start ?? '',
    drink_window_end: b.drink_window_end ?? '',
    notes: b.notes ?? '',
    suggested_pairings: b.suggested_pairings ?? '',
  };
}

export default function BottleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQty, setCustomQty] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Tag management state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagsLoaded, setTagsLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Bottle>(`/bottles/${id}`),
      api.get<Tasting[]>(`/tastings?bottle_id=${id}`),
    ])
      .then(([b, t]) => {
        setBottle(b);
        setTastings(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function enterEditMode() {
    if (!bottle) return;
    setEditForm(bottleToForm(bottle));
    setSelectedTagIds(new Set(bottle.tags.map(t => t.id)));
    if (!tagsLoaded) {
      api.get<Tag[]>('/tags').then(tags => {
        setAllTags(tags);
        setTagsLoaded(true);
      });
    }
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!id || !editForm) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      // Only send changed fields
      if (editForm.name) payload.name = editForm.name;
      if (editForm.producer) payload.producer = editForm.producer;
      else payload.producer = null;
      payload.type = editForm.type;
      if (editForm.subtype) payload.subtype = editForm.subtype;
      else payload.subtype = null;
      if (editForm.vintage) payload.vintage = parseInt(editForm.vintage);
      else payload.vintage = null;
      if (editForm.region) payload.region = editForm.region;
      else payload.region = null;
      if (editForm.country) payload.country = editForm.country;
      else payload.country = null;
      if (editForm.grape_or_base) payload.grape_or_base = editForm.grape_or_base;
      else payload.grape_or_base = null;
      if (editForm.abv) payload.abv = parseFloat(editForm.abv);
      else payload.abv = null;
      if (editForm.volume_ml) payload.volume_ml = parseInt(editForm.volume_ml);
      else payload.volume_ml = null;
      if (editForm.purchase_price_kr) payload.purchase_price_kr = parseFloat(editForm.purchase_price_kr);
      else payload.purchase_price_kr = null;
      if (editForm.purchase_date) payload.purchase_date = editForm.purchase_date;
      else payload.purchase_date = null;
      if (editForm.source_shop) payload.source_shop = editForm.source_shop;
      else payload.source_shop = null;
      if (editForm.barcode) payload.barcode = editForm.barcode;
      else payload.barcode = null;
      if (editForm.serving_temp) payload.serving_temp = editForm.serving_temp;
      else payload.serving_temp = null;
      if (editForm.drink_window_start) payload.drink_window_start = editForm.drink_window_start;
      else payload.drink_window_start = null;
      if (editForm.drink_window_end) payload.drink_window_end = editForm.drink_window_end;
      else payload.drink_window_end = null;
      if (editForm.notes) payload.notes = editForm.notes;
      else payload.notes = null;
      if (editForm.suggested_pairings) payload.suggested_pairings = editForm.suggested_pairings;
      else payload.suggested_pairings = null;

      payload.tag_ids = Array.from(selectedTagIds);

      const updated = await api.patch<Bottle>(`/bottles/${id}`, payload);
      setBottle(updated);
      setEditing(false);
      setEditForm(null);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EditForm, value: string) {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function adjustQuantity(qty: number) {
    if (!id) return;
    const updated = await api.post<Bottle>(`/bottles/${id}/adjust`, { quantity: qty });
    setBottle(updated);
    setShowCustomInput(false);
  }

  async function changeStatus(status: string) {
    if (!id) return;
    const updated = await api.patch<Bottle>(`/bottles/${id}`, { status });
    setBottle(updated);
  }

  if (loading) return <p className="text-stone-500 text-sm">Loading...</p>;
  if (!bottle) return <p className="text-red-600">Bottle not found.</p>;

  const enrichment = ENRICHMENT_BADGE[bottle.enrichment_status] ?? ENRICHMENT_BADGE.pending;

  return (
    <div>
      <Link to="/collection" className="text-amber-700 hover:underline text-sm">
        &larr; Back to collection
      </Link>

      <div className="flex items-center gap-3 mt-3">
        <h1 className="text-2xl font-bold">{bottle.name}</h1>
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${enrichment.bg} ${enrichment.text}`}>
          {enrichment.label}
        </span>
      </div>

      {/* Edit toggle */}
      <div className="mt-2">
        {!editing ? (
          <button
            onClick={enterEditMode}
            className="text-sm text-amber-700 hover:text-amber-900 underline"
          >
            Edit details
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Photo */}
      <div className="mt-3">
        {editing ? (
          <ImageUpload
            currentImage={bottle.image_path}
            onImageChanged={async (path) => {
              if (!id) return;
              const updated = await api.patch<Bottle>(`/bottles/${id}`, { image_path: path });
              setBottle(updated);
            }}
          />
        ) : bottle.image_path ? (
          <img
            src={bottle.image_path}
            alt={bottle.name}
            className="w-full max-w-xs rounded-lg object-cover aspect-square"
          />
        ) : null}
      </div>

      {/* Info grid */}
      <div className="bg-white rounded-lg border border-stone-200 p-4 mt-3">
        {editing && editForm ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <EditField label="Name" value={editForm.name} onChange={v => updateField('name', v)} />
            <EditField label="Producer" value={editForm.producer} onChange={v => updateField('producer', v)} />
            <div>
              <label className="block text-stone-500 text-xs mb-1">Type</label>
              <select
                value={editForm.type}
                onChange={e => updateField('type', e.target.value)}
                className="border border-stone-300 rounded px-2 py-1 text-sm w-full"
              >
                {BOTTLE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <EditField label="Subtype" value={editForm.subtype} onChange={v => updateField('subtype', v)} />
            <EditField label="Vintage" value={editForm.vintage} onChange={v => updateField('vintage', v)} type="number" />
            <EditField label="Region" value={editForm.region} onChange={v => updateField('region', v)} />
            <EditField label="Country" value={editForm.country} onChange={v => updateField('country', v)} />
            <EditField label="Grape / Base" value={editForm.grape_or_base} onChange={v => updateField('grape_or_base', v)} />
            <EditField label="ABV (%)" value={editForm.abv} onChange={v => updateField('abv', v)} type="number" />
            <EditField label="Volume (ml)" value={editForm.volume_ml} onChange={v => updateField('volume_ml', v)} type="number" />
            <EditField label="Price (kr)" value={editForm.purchase_price_kr} onChange={v => updateField('purchase_price_kr', v)} type="number" />
            <EditField label="Purchase date" value={editForm.purchase_date} onChange={v => updateField('purchase_date', v)} type="date" />
            <EditField label="Shop" value={editForm.source_shop} onChange={v => updateField('source_shop', v)} />
            <EditField label="Barcode" value={editForm.barcode} onChange={v => updateField('barcode', v)} />
            <EditField label="Serving temp" value={editForm.serving_temp} onChange={v => updateField('serving_temp', v)} />
            <EditField label="Drink window start" value={editForm.drink_window_start} onChange={v => updateField('drink_window_start', v)} type="date" />
            <EditField label="Drink window end" value={editForm.drink_window_end} onChange={v => updateField('drink_window_end', v)} type="date" />
            <div className="col-span-2">
              <label className="block text-stone-500 text-xs mb-1">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={e => updateField('notes', e.target.value)}
                className="border border-stone-300 rounded px-2 py-1 text-sm w-full"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-stone-500 text-xs mb-1">Suggested pairings</label>
              <textarea
                value={editForm.suggested_pairings}
                onChange={e => updateField('suggested_pairings', e.target.value)}
                className="border border-stone-300 rounded px-2 py-1 text-sm w-full"
                rows={2}
              />
            </div>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {bottle.producer && <Detail label="Producer" value={bottle.producer} />}
              {bottle.type && <Detail label="Type" value={bottle.type} />}
              {bottle.subtype && <Detail label="Subtype" value={bottle.subtype} />}
              {bottle.vintage && <Detail label="Vintage" value={String(bottle.vintage)} />}
              {bottle.region && <Detail label="Region" value={bottle.region} />}
              {bottle.country && <Detail label="Country" value={bottle.country} />}
              {bottle.grape_or_base && <Detail label="Grape / Base" value={bottle.grape_or_base} />}
              {bottle.abv != null && <Detail label="ABV" value={`${bottle.abv}%`} />}
              {bottle.volume_ml != null && <Detail label="Volume" value={`${bottle.volume_ml} ml`} />}
              {bottle.purchase_price_kr != null && <Detail label="Price" value={`${bottle.purchase_price_kr} kr`} />}
              {bottle.purchase_date && <Detail label="Purchased" value={bottle.purchase_date} />}
              {bottle.source_shop && <Detail label="Shop" value={bottle.source_shop} />}
              {bottle.barcode && <Detail label="Barcode" value={bottle.barcode} />}
              {bottle.serving_temp && <Detail label="Serving temp" value={bottle.serving_temp} />}
              <Detail label="Status" value={bottle.status.replace('_', ' ')} />
              <Detail label="Quantity" value={String(bottle.quantity)} />
            </dl>

            {bottle.drink_window_start && bottle.drink_window_end && (
              <p className="text-sm text-stone-600 mt-2">
                Drink window: {bottle.drink_window_start} &ndash; {bottle.drink_window_end}
              </p>
            )}
            {bottle.notes && (
              <p className="text-sm text-stone-600 mt-2">Notes: {bottle.notes}</p>
            )}
            {bottle.suggested_pairings && (
              <p className="text-sm text-stone-600 mt-2">Suggested pairings: {bottle.suggested_pairings}</p>
            )}
          </>
        )}

        {/* Tag management */}
        {editing ? (
          <div className="mt-4 border-t border-stone-200 pt-3">
            <h3 className="text-xs font-semibold text-stone-500 uppercase mb-2">Tags</h3>
            {!tagsLoaded ? (
              <p className="text-stone-400 text-xs">Loading tags...</p>
            ) : allTags.length === 0 ? (
              <p className="text-stone-400 text-xs">No tags available. Create tags first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <label
                    key={tag.id}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border ${
                      selectedTagIds.has(tag.id)
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.has(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="sr-only"
                    />
                    {tag.name}
                    <span className="text-stone-400">({tag.category})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          bottle.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {bottle.tags.map(t => (
                <span key={t.id} className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded text-xs">
                  {t.name}
                </span>
              ))}
            </div>
          )
        )}
      </div>

      {/* Quantity Adjustment */}
      {bottle.status === 'in_stock' && (
        <div className="bg-white rounded-lg border border-stone-200 p-4 mt-3">
          <h2 className="font-semibold text-sm mb-2">Adjust Quantity</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => adjustQuantity(Math.max(0, bottle.quantity - 1))}
              className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1.5 rounded text-sm"
            >
              Open one
            </button>
            <button
              onClick={() => adjustQuantity(0)}
              className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1.5 rounded text-sm"
            >
              Finish
            </button>
            <button
              onClick={() => adjustQuantity(0.5)}
              className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1.5 rounded text-sm"
            >
              Half left
            </button>
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1.5 rounded text-sm"
            >
              Other...
            </button>
          </div>
          {showCustomInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="0"
                step="any"
                value={customQty}
                onChange={e => setCustomQty(e.target.value)}
                className="border border-stone-300 rounded px-2 py-1 text-sm w-24"
                placeholder="qty"
              />
              <button
                onClick={() => {
                  const v = parseFloat(customQty);
                  if (!isNaN(v) && v >= 0) adjustQuantity(v);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm"
              >
                Set
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Actions */}
      <div className="bg-white rounded-lg border border-stone-200 p-4 mt-3">
        <h2 className="font-semibold text-sm mb-2">Status</h2>
        <div className="flex flex-wrap gap-2">
          {bottle.status !== 'consumed' && (
            <button
              onClick={() => changeStatus('consumed')}
              className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded text-sm"
            >
              Mark consumed
            </button>
          )}
          {bottle.status !== 'gifted' && (
            <button
              onClick={() => changeStatus('gifted')}
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1.5 rounded text-sm"
            >
              Mark gifted
            </button>
          )}
          {bottle.status !== 'in_stock' && (
            <button
              onClick={() => changeStatus('in_stock')}
              className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded text-sm"
            >
              Mark in stock
            </button>
          )}
          <button
            onClick={() => navigate(`/tastings/new?bottle_id=${bottle.id}`)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-sm"
          >
            Log tasting
          </button>
        </div>
      </div>

      {/* Tasting Notes */}
      <div className="mt-4">
        <h2 className="font-semibold text-lg mb-2">Tasting Notes</h2>
        {tastings.length === 0 ? (
          <p className="text-stone-500 text-sm">No tastings logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {tastings.map(t => (
              <li key={t.id} className="bg-white rounded-lg border border-stone-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-stone-700">{t.user.name}</span>
                  <span className="text-xs text-stone-500">{t.tasted_at}</span>
                </div>
                <StarRating value={t.rating} />
                {t.notes && <p className="text-sm text-stone-600 mt-1">{t.notes}</p>}
                {t.food_pairing && (
                  <p className="text-xs text-stone-500 mt-1">Paired with: {t.food_pairing}</p>
                )}
                {t.would_drink_again != null && (
                  <span
                    className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                      t.would_drink_again
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {t.would_drink_again ? 'Would drink again' : 'Would not drink again'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-stone-900">{value}</dd>
    </>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-stone-500 text-xs mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-stone-300 rounded px-2 py-1 text-sm w-full"
      />
    </div>
  );
}
