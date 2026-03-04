import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';

interface Bottle {
  id: string;
  name: string;
  producer: string | null;
  type: string;
}

export default function NewTasting() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledBottleId = searchParams.get('bottle_id') || '';

  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [bottleId, setBottleId] = useState(prefilledBottleId);
  const [bottleSearch, setBottleSearch] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [foodPairing, setFoodPairing] = useState('');
  const [pairingRating, setPairingRating] = useState(0);
  const [wouldDrinkAgain, setWouldDrinkAgain] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Bottle[]>('/bottles?status=in_stock')
      .then(setBottles)
      .catch(console.error);
  }, []);

  const filteredBottles = bottleSearch
    ? bottles.filter(b =>
        b.name.toLowerCase().includes(bottleSearch.toLowerCase()) ||
        (b.producer?.toLowerCase().includes(bottleSearch.toLowerCase()))
      )
    : bottles;

  const selectedBottle = bottles.find(b => b.id === bottleId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bottleId) {
      setError('Please select a bottle');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/tastings', {
        bottle_id: bottleId,
        rating,
        notes: notes.trim() || null,
        food_pairing: foodPairing.trim() || null,
        pairing_rating: foodPairing.trim() ? pairingRating : null,
        would_drink_again: wouldDrinkAgain,
      });
      navigate('/tastings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tasting');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Link to="/tastings" className="text-amber-700 hover:underline text-sm">
        &larr; Back to tastings
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-4">New Tasting</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
        )}

        {/* Bottle picker */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Bottle <span className="text-red-500">*</span>
          </label>
          {selectedBottle ? (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
              <span>{selectedBottle.name}{selectedBottle.producer ? ` — ${selectedBottle.producer}` : ''}</span>
              <button
                type="button"
                onClick={() => setBottleId('')}
                className="text-stone-500 hover:text-stone-700 ml-2"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={bottleSearch}
                onChange={e => setBottleSearch(e.target.value)}
                placeholder="Search bottles..."
                className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mb-1"
              />
              <ul className="max-h-40 overflow-y-auto border border-stone-200 rounded text-sm divide-y divide-stone-100">
                {filteredBottles.length === 0 ? (
                  <li className="px-3 py-2 text-stone-500">No bottles found</li>
                ) : (
                  filteredBottles.map(b => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => { setBottleId(b.id); setBottleSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50"
                      >
                        {b.name}
                        {b.producer && <span className="text-stone-500 ml-1">— {b.producer}</span>}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Rating</label>
          <StarRating value={rating} onChange={setRating} />
          <p className="text-xs text-stone-500 mt-0.5">Left-click for full star, right-click for half star</p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Aromas, flavors, impressions..."
          />
        </div>

        {/* Food pairing */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Food Pairing</label>
          <input
            type="text"
            value={foodPairing}
            onChange={e => setFoodPairing(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="What did you pair it with?"
          />
        </div>

        {/* Pairing rating */}
        {foodPairing.trim() && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Pairing Rating</label>
            <StarRating value={pairingRating} onChange={setPairingRating} />
          </div>
        )}

        {/* Would drink again */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Would drink again?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWouldDrinkAgain(wouldDrinkAgain === true ? null : true)}
              className={`px-4 py-1.5 rounded text-sm font-medium ${
                wouldDrinkAgain === true
                  ? 'bg-green-600 text-white'
                  : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWouldDrinkAgain(wouldDrinkAgain === false ? null : false)}
              className={`px-4 py-1.5 rounded text-sm font-medium ${
                wouldDrinkAgain === false
                  ? 'bg-red-600 text-white'
                  : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              No
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2.5 rounded font-medium text-sm"
        >
          {submitting ? 'Saving...' : 'Save Tasting'}
        </button>
      </form>
    </div>
  );
}
