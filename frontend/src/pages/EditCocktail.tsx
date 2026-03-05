import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface IngredientRow {
  key: number;
  name: string;
  amount_cl: string;
  tag_id: string;
  is_pantry_item: boolean;
}

interface CocktailData {
  id: string;
  name: string;
  description: string | null;
  method: string | null;
  glass_type: string | null;
  garnish: string | null;
  difficulty: string | null;
  notes: string | null;
  ingredients: {
    id: string;
    name: string;
    amount_cl: number | null;
    tag: { id: string; name: string; category: string } | null;
    is_pantry_item: boolean;
  }[];
}

let nextKey = 0;

function emptyIngredient(): IngredientRow {
  return { key: nextKey++, name: '', amount_cl: '', tag_id: '', is_pantry_item: false };
}

export default function EditCocktail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('');
  const [glassType, setGlassType] = useState('');
  const [garnish, setGarnish] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Tag[]>('/tags?category=ingredient'),
      api.get<CocktailData>(`/cocktails/${id}`),
    ])
      .then(([tagList, cocktail]) => {
        setTags(tagList);
        setName(cocktail.name);
        setDescription(cocktail.description || '');
        setMethod(cocktail.method || '');
        setGlassType(cocktail.glass_type || '');
        setGarnish(cocktail.garnish || '');
        setDifficulty(cocktail.difficulty || '');
        setNotes(cocktail.notes || '');
        if (cocktail.ingredients.length > 0) {
          setIngredients(
            cocktail.ingredients.map(ing => ({
              key: nextKey++,
              name: ing.name,
              amount_cl: ing.amount_cl != null ? String(ing.amount_cl) : '',
              tag_id: ing.tag?.id || '',
              is_pantry_item: ing.is_pantry_item,
            })),
          );
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load recipe');
      })
      .finally(() => setLoading(false));
  }, [id]);

  function updateIngredient(key: number, field: keyof IngredientRow, value: string | boolean) {
    setIngredients(prev =>
      prev.map(ing => (ing.key === key ? { ...ing, [field]: value } : ing)),
    );
  }

  function addIngredient() {
    setIngredients(prev => [...prev, emptyIngredient()]);
  }

  function removeIngredient(key: number) {
    setIngredients(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(ing => ing.key !== key);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const validIngredients = ingredients
      .filter(ing => ing.name.trim())
      .map(ing => ({
        name: ing.name.trim(),
        amount_cl: ing.amount_cl ? parseFloat(ing.amount_cl) : null,
        tag_id: ing.tag_id || null,
        is_pantry_item: ing.is_pantry_item,
      }));

    setSubmitting(true);
    setError('');

    try {
      await api.patch(`/cocktails/${id}`, {
        name: name.trim(),
        description: description.trim() || null,
        method: method || null,
        glass_type: glassType.trim() || null,
        garnish: garnish.trim() || null,
        difficulty: difficulty || null,
        notes: notes.trim() || null,
        ingredients: validIngredients,
      });
      navigate('/cocktails');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe');
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-stone-500 text-sm">Loading recipe...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/cocktails" className="text-amber-700 hover:underline text-sm">
        &larr; Back to cocktails
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-4">Edit Cocktail Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Method & Difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select --</option>
              <option value="shake">Shake</option>
              <option value="stir">Stir</option>
              <option value="build">Build</option>
              <option value="blend">Blend</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select --</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Glass type & Garnish */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Glass Type</label>
            <input
              type="text"
              value={glassType}
              onChange={e => setGlassType(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Garnish</label>
            <input
              type="text"
              value={garnish}
              onChange={e => setGarnish(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={ing.key} className="flex gap-2 items-start bg-stone-50 rounded-lg p-2 border border-stone-100">
                <div className="text-xs text-stone-400 mt-2 w-4 text-center shrink-0">{idx + 1}</div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={e => updateIngredient(ing.key, 'name', e.target.value)}
                    placeholder="Ingredient name"
                    className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="number"
                    value={ing.amount_cl}
                    onChange={e => updateIngredient(ing.key, 'amount_cl', e.target.value)}
                    placeholder="Amount (cl)"
                    min="0"
                    step="0.5"
                    className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    value={ing.tag_id}
                    onChange={e => updateIngredient(ing.key, 'tag_id', e.target.value)}
                    className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Tag (optional) --</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-sm text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ing.is_pantry_item}
                      onChange={e => updateIngredient(ing.key, 'is_pantry_item', e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    Pantry item
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredient(ing.key)}
                  className="text-stone-400 hover:text-red-600 text-sm mt-1 shrink-0 px-1"
                  title="Remove ingredient"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            + Add ingredient
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2.5 rounded font-medium text-sm"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
