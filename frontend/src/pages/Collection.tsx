import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

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
  quantity: number;
  purchase_price_kr: number | null;
  tags: Tag[];
}

type CategoryTab = 'wine' | 'spirit' | 'liqueur' | 'beer' | 'other';

const TABS: { key: CategoryTab; label: string }[] = [
  { key: 'wine', label: 'Wines' },
  { key: 'spirit', label: 'Spirits' },
  { key: 'liqueur', label: 'Liqueurs' },
  { key: 'beer', label: 'Beer' },
  { key: 'other', label: 'Other' },
];

export default function Collection() {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryTab>('wine');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bottle[]>('/bottles?status=in_stock')
      .then(setBottles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of bottles) {
      c[b.type] = (c[b.type] || 0) + 1;
    }
    return c;
  }, [bottles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bottles.filter(b => {
      if (b.type !== activeTab) return false;
      if (q && !b.name.toLowerCase().includes(q) && !(b.producer?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [bottles, activeTab, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Collection</h1>
        <Link
          to="/collection/add"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          + Quick Add
        </Link>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search bottles..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-stone-300 rounded px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      {/* Category Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-amber-600 text-white'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            {tab.label} ({counts[tab.key] || 0})
          </button>
        ))}
      </div>

      {/* Bottle List */}
      {loading ? (
        <p className="text-stone-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-stone-500 text-sm">No bottles found.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(b => (
            <li key={b.id}>
              <Link
                to={`/collection/${b.id}`}
                className="block bg-white rounded-lg border border-stone-200 p-3 hover:border-amber-400 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-stone-900 truncate">{b.name}</div>
                    <div className="text-sm text-stone-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {b.producer && <span>{b.producer}</span>}
                      {b.vintage && <span>{b.vintage}</span>}
                      {b.subtype && <span>{b.subtype}</span>}
                    </div>
                    {b.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {b.tags.map(t => (
                          <span
                            key={t.id}
                            className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded text-xs"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="text-sm font-medium text-stone-700">
                      qty {b.quantity}
                    </div>
                    {b.purchase_price_kr != null && (
                      <div className="text-xs text-stone-500">{b.purchase_price_kr} kr</div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
