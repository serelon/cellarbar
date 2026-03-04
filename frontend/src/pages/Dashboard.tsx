import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';

interface Bottle {
  id: string;
  name: string;
  type: string;
  created_at: string;
  enrichment_status: string;
  quantity: number;
}

interface CocktailRecipe {
  id: string;
  name: string;
  method: string | null;
  difficulty: string | null;
  rating: number | null;
  ingredients: { id: string; name: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  wine: 'Wines',
  spirit: 'Spirits',
  liqueur: 'Liqueurs',
  beer: 'Beers',
  other: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  wine: 'bg-red-50 border-red-200 text-red-900',
  spirit: 'bg-amber-50 border-amber-200 text-amber-900',
  liqueur: 'bg-purple-50 border-purple-200 text-purple-900',
  beer: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  other: 'bg-stone-50 border-stone-200 text-stone-900',
};

export default function Dashboard() {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [makeable, setMakeable] = useState<CocktailRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Bottle[]>('/bottles?status=in_stock'),
      api.get<CocktailRecipe[]>('/cocktails/makeable'),
    ])
      .then(([b, m]) => {
        setBottles(b);
        setMakeable(m);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-stone-500 text-sm">Loading dashboard...</p>;
  }

  // Stock counts by type
  const stockCounts: Record<string, number> = {};
  let pendingEnrichment = 0;
  for (const b of bottles) {
    stockCounts[b.type] = (stockCounts[b.type] || 0) + b.quantity;
    if (b.enrichment_status === 'pending') {
      pendingEnrichment++;
    }
  }

  const totalBottles = bottles.reduce((sum, b) => sum + b.quantity, 0);

  // Recently added (last 5 by created_at)
  const recentBottles = [...bottles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stock summary */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-800 mb-3">Your Stock</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {['wine', 'spirit', 'liqueur', 'beer', 'other'].map(t => (
            <div
              key={t}
              className={`rounded-lg border p-4 text-center ${TYPE_COLORS[t]}`}
            >
              <div className="text-2xl font-bold">{stockCounts[t] || 0}</div>
              <div className="text-sm font-medium mt-1">{TYPE_LABELS[t]}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-sm text-stone-600">
          <span>
            <strong>{totalBottles}</strong> total in stock
          </span>
          {pendingEnrichment > 0 && (
            <span className="text-amber-700">
              <strong>{pendingEnrichment}</strong> pending enrichment
            </span>
          )}
        </div>
      </section>

      {/* Recently added */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-stone-800">Recently Added</h2>
          <Link to="/collection/add" className="text-amber-700 hover:underline text-sm">
            + Quick Add
          </Link>
        </div>
        {recentBottles.length === 0 ? (
          <p className="text-stone-500 text-sm">No bottles yet. Add your first bottle!</p>
        ) : (
          <div className="space-y-2">
            {recentBottles.map(b => (
              <Link
                key={b.id}
                to={`/collection/${b.id}`}
                className="block bg-white rounded-lg border border-stone-200 p-3 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-stone-900">{b.name}</span>
                    <span className="text-xs text-stone-500 ml-2 capitalize">{b.type}</span>
                  </div>
                  <span className="text-xs text-stone-400">
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Cocktails you can make */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-stone-800">Cocktails You Can Make</h2>
          <Link to="/cocktails" className="text-amber-700 hover:underline text-sm">
            All recipes
          </Link>
        </div>
        {makeable.length === 0 ? (
          <p className="text-stone-500 text-sm">
            No cocktails can be made with your current stock. Add more bottles or recipes!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {makeable.slice(0, 6).map(c => (
              <Link
                key={c.id}
                to="/cocktails"
                className="bg-white rounded-lg border border-stone-200 p-4 hover:border-amber-300 transition-colors"
              >
                <div className="font-medium text-stone-900 mb-1">{c.name}</div>
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  {c.method && <span className="capitalize">{c.method}</span>}
                  {c.difficulty && (
                    <span className={`px-1.5 py-0.5 rounded ${
                      c.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      c.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {c.difficulty}
                    </span>
                  )}
                  <span>{c.ingredients.length} ingredients</span>
                </div>
                {c.rating != null && c.rating > 0 && (
                  <div className="mt-2">
                    <StarRating value={c.rating} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Exports */}
      <section>
        <h2 className="text-lg font-semibold text-stone-800 mb-3">Exports</h2>
        <div className="bg-stone-200 rounded-lg border border-stone-300 p-4 flex flex-wrap gap-3">
          <button
            onClick={() => api.downloadMarkdown('/export/markdown/wine')}
            className="px-4 py-2 bg-white rounded-lg border border-stone-300 text-sm font-medium text-stone-900 hover:border-amber-300 transition-colors"
          >
            Download Wine Guide
          </button>
          <button
            onClick={() => api.downloadMarkdown('/export/markdown/bar')}
            className="px-4 py-2 bg-white rounded-lg border border-stone-300 text-sm font-medium text-stone-900 hover:border-amber-300 transition-colors"
          >
            Download Bar Inventory
          </button>
        </div>
      </section>
    </div>
  );
}
