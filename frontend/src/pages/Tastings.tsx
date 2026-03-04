import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import StarRating from '../components/StarRating';

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

interface Bottle {
  id: string;
  name: string;
}

export default function Tastings() {
  const { user } = useAuth();
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [bottles, setBottles] = useState<Map<string, Bottle>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get<Tasting[]>(`/tastings?user_id=${user.id}`)
      .then(async (ts) => {
        setTastings(ts);
        // Fetch bottle names for display
        const bottleIds = [...new Set(ts.map(t => t.bottle_id))];
        const bottleMap = new Map<string, Bottle>();
        await Promise.all(
          bottleIds.map(bid =>
            api.get<Bottle>(`/bottles/${bid}`)
              .then(b => bottleMap.set(b.id, b))
              .catch(() => { /* bottle may have been deleted */ })
          )
        );
        setBottles(bottleMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tastings</h1>
        <Link
          to="/tastings/new"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          + New Tasting
        </Link>
      </div>

      {loading ? (
        <p className="text-stone-500 text-sm">Loading...</p>
      ) : tastings.length === 0 ? (
        <p className="text-stone-500 text-sm">No tastings logged yet. Start by tasting something from your collection!</p>
      ) : (
        <ul className="space-y-2">
          {tastings.map(t => {
            const bottle = bottles.get(t.bottle_id);
            return (
              <li key={t.id} className="bg-white rounded-lg border border-stone-200 p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    {bottle ? (
                      <Link
                        to={`/collection/${bottle.id}`}
                        className="font-medium text-stone-900 hover:text-amber-700"
                      >
                        {bottle.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-stone-500 italic">Unknown bottle</span>
                    )}
                  </div>
                  <span className="text-xs text-stone-500 shrink-0 ml-2">{t.tasted_at}</span>
                </div>
                <StarRating value={t.rating} />
                {t.notes && (
                  <p className="text-sm text-stone-600 mt-1 line-clamp-2">{t.notes}</p>
                )}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
