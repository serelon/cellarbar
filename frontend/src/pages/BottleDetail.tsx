import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';

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

export default function BottleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQty, setCustomQty] = useState('');

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

  return (
    <div>
      <Link to="/collection" className="text-amber-700 hover:underline text-sm">
        &larr; Back to collection
      </Link>

      <h1 className="text-2xl font-bold mt-3">{bottle.name}</h1>

      {/* Info grid */}
      <div className="bg-white rounded-lg border border-stone-200 p-4 mt-3">
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

        {bottle.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {bottle.tags.map(t => (
              <span key={t.id} className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded text-xs">
                {t.name}
              </span>
            ))}
          </div>
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
                step="0.5"
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
