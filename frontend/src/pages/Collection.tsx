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
  status: string;
  purchase_price_kr: number | null;
  image_path: string | null;
  tags: Tag[];
}

type CategoryTab = 'wine' | 'spirit' | 'liqueur' | 'beer' | 'other';
type StatusFilter = 'in_stock' | 'all' | 'consumed' | 'gifted';

const TABS: { key: CategoryTab; label: string }[] = [
  { key: 'wine', label: 'Wines' },
  { key: 'spirit', label: 'Spirits' },
  { key: 'liqueur', label: 'Liqueurs' },
  { key: 'beer', label: 'Beer' },
  { key: 'other', label: 'Other' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'in_stock', label: 'In Stock' },
  { key: 'all', label: 'All' },
  { key: 'consumed', label: 'Consumed' },
  { key: 'gifted', label: 'Gifted' },
];

export default function Collection() {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryTab>('wine');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('in_stock');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filterRegion, setFilterRegion] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSubtype, setFilterSubtype] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  const hasActiveFilters = !!(filterRegion || filterCountry || filterSubtype || filterMinPrice || filterMaxPrice || filterTagIds.length > 0);

  useEffect(() => {
    api.get<Tag[]>('/tags').then(setAllTags).catch(console.error);
  }, []);

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

  const clearAllFilters = () => {
    setFilterRegion('');
    setFilterCountry('');
    setFilterSubtype('');
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterTagIds([]);
  };

  const toggleTag = (tagId: string) => {
    setFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

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
        className="w-full border border-stone-300 rounded px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      {/* More Filters Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowFilters(v => !v)}
          className="relative flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200"
        >
          {showFilters ? 'Hide Filters' : 'More Filters'}
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="bg-stone-50 rounded-lg border border-stone-200 p-3 mb-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Region</label>
              <input
                type="text"
                placeholder="e.g. Bordeaux"
                value={filterRegion}
                onChange={e => setFilterRegion(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Country</label>
              <input
                type="text"
                placeholder="e.g. France"
                value={filterCountry}
                onChange={e => setFilterCountry(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Subtype</label>
              <input
                type="text"
                placeholder="e.g. Cabernet"
                value={filterSubtype}
                onChange={e => setFilterSubtype(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Min Price (kr)</label>
              <input
                type="number"
                placeholder="0"
                value={filterMinPrice}
                onChange={e => setFilterMinPrice(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Max Price (kr)</label>
              <input
                type="number"
                placeholder="999"
                value={filterMaxPrice}
                onChange={e => setFilterMaxPrice(e.target.value)}
                className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-stone-500 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      filterTagIds.includes(tag.id)
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-1 mb-3">
        {STATUS_FILTERS.map(sf => (
          <button
            key={sf.key}
            onClick={() => setStatusFilter(sf.key)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${
              statusFilter === sf.key
                ? 'bg-stone-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

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
                <div className="flex justify-between items-start gap-3">
                  {b.image_path && (
                    <img
                      src={b.image_path}
                      alt=""
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  )}
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
                    {b.status !== 'in_stock' && (
                      <span className={`inline-block text-xs mt-1 px-1.5 py-0.5 rounded ${
                        b.status === 'consumed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {b.status}
                      </span>
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
