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
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTagId, setNewTagId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<PantryItem[]>('/pantry'),
      api.get<Tag[]>('/tags'),
    ])
      .then(([pantryItems, allTags]) => {
        setItems(pantryItems);
        setTags(allTags);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ingredientTags = tags.filter(t => t.category === 'ingredient');

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const item = await api.post<PantryItem>('/pantry', {
        name: newName.trim(),
        ...(newTagId ? { tag_id: newTagId } : {}),
      });
      setItems(prev => [item, ...prev]);
      setNewName('');
      setNewTagId('');
    } catch (err) {
      console.error(err);
    }
    setAdding(false);
  }

  async function toggleStock(item: PantryItem) {
    try {
      const updated = await api.patch<PantryItem>(`/pantry/${item.id}`, {
        in_stock: !item.in_stock,
      });
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteItem(id: string) {
    try {
      await api.delete(`/pantry/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const inStock = items.filter(i => i.in_stock);
  const outOfStock = items.filter(i => !i.in_stock);

  if (loading) {
    return <p className="text-stone-500 text-sm">Loading pantry...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Pantry</h1>

      {/* Add item form */}
      <form onSubmit={addItem} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Add ingredient..."
          className="flex-1 border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <select
          value={newTagId}
          onChange={e => setNewTagId(e.target.value)}
          className="border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="">No tag</option>
          {ingredientTags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2 rounded text-sm font-medium shrink-0"
        >
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-stone-500 text-sm">Your pantry is empty. Add your first ingredient!</p>
      ) : (
        <div className="space-y-6">
          {/* In Stock section */}
          {inStock.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                In Stock ({inStock.length})
              </h2>
              <ul className="space-y-1">
                {inStock.map(item => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 bg-white rounded-lg border border-stone-200 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={item.in_stock}
                      onChange={() => toggleStock(item)}
                      className="w-6 h-6 rounded border-stone-300 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                    />
                    <span className="flex-1 text-sm text-stone-900 min-w-0">{item.name}</span>
                    {item.tag && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">
                        {item.tag.name}
                      </span>
                    )}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-stone-400 hover:text-red-600 text-sm shrink-0"
                      aria-label={`Delete ${item.name}`}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Out of Stock section */}
          {outOfStock.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Out of Stock ({outOfStock.length})
              </h2>
              <ul className="space-y-1">
                {outOfStock.map(item => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 bg-white rounded-lg border border-stone-200 p-3 opacity-60"
                  >
                    <input
                      type="checkbox"
                      checked={item.in_stock}
                      onChange={() => toggleStock(item)}
                      className="w-6 h-6 rounded border-stone-300 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                    />
                    <span className="flex-1 text-sm text-stone-500 min-w-0">{item.name}</span>
                    {item.tag && (
                      <span className="text-xs px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded shrink-0">
                        {item.tag.name}
                      </span>
                    )}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-stone-400 hover:text-red-600 text-sm shrink-0"
                      aria-label={`Delete ${item.name}`}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
