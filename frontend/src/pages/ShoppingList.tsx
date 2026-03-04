import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface ShoppingItem {
  id: string;
  name: string;
  barcode: string | null;
  source: string;
  is_bought: boolean;
  added_at: string;
}

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  function fetchItems() {
    api.get<ShoppingItem[]>('/shopping?show_bought=true')
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchItems();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      const item = await api.post<ShoppingItem>('/shopping', {
        name: newItem.trim(),
        source: 'manual',
      });
      setItems(prev => [item, ...prev]);
      setNewItem('');
    } catch (err) {
      console.error(err);
    }
    setAdding(false);
  }

  async function toggleBought(item: ShoppingItem) {
    try {
      const updated = await api.patch<ShoppingItem>(`/shopping/${item.id}`, {
        is_bought: !item.is_bought,
      });
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (err) {
      console.error(err);
    }
  }

  async function clearBought() {
    try {
      await api.delete('/shopping');
      setItems(prev => prev.filter(i => !i.is_bought));
    } catch (err) {
      console.error(err);
    }
  }

  const hasBought = items.some(i => i.is_bought);

  const sourceBadge = (source: string) => {
    switch (source) {
      case 'scan': return 'bg-blue-100 text-blue-700';
      case 'cocktail': return 'bg-purple-100 text-purple-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Shopping List</h1>

      {/* Add item form */}
      <form onSubmit={addItem} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Add item..."
          className="flex-1 border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={adding || !newItem.trim()}
          className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2 rounded text-sm font-medium shrink-0"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => alert('Scan coming soon')}
          className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-2 rounded text-sm font-medium shrink-0"
        >
          Scan
        </button>
      </form>

      {/* Item list */}
      {loading ? (
        <p className="text-stone-500 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-stone-500 text-sm">Your shopping list is empty.</p>
      ) : (
        <ul className="space-y-1">
          {items.map(item => (
            <li
              key={item.id}
              className={`flex items-center gap-3 bg-white rounded-lg border border-stone-200 p-3 ${
                item.is_bought ? 'opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={item.is_bought}
                onChange={() => toggleBought(item)}
                className="w-6 h-6 rounded border-stone-300 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${item.is_bought ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                  {item.name}
                </span>
                {item.barcode && (
                  <span className="text-xs text-stone-400 ml-2">{item.barcode}</span>
                )}
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${sourceBadge(item.source)}`}>
                {item.source}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Clear bought */}
      {hasBought && (
        <button
          onClick={clearBought}
          className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-medium"
        >
          Clear bought items
        </button>
      )}
    </div>
  );
}
