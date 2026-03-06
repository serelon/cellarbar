import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

export default function NewCocktail() {
  const navigate = useNavigate();
  const nextKeyRef = useRef(0);

  function emptyIngredient(): IngredientRow {
    return { key: nextKeyRef.current++, name: '', amount_cl: '', tag_id: '', is_pantry_item: false };
  }

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('');
  const [glassType, setGlassType] = useState('');
  const [garnish, setGarnish] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [enrichmentPending, setEnrichmentPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Tag[]>('/tags?category=ingredient')
      .then(setTags)
      .catch(console.error);
  }, []);

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
      await api.post('/cocktails', {
        name: name.trim(),
        description: description.trim() || null,
        method: method || null,
        glass_type: glassType.trim() || null,
        garnish: garnish.trim() || null,
        difficulty: difficulty || null,
        notes: notes.trim() || null,
        enrichment_status: enrichmentPending ? 'pending' : null,
        ingredients: validIngredients,
      });
      navigate('/cocktails');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/cocktails" className="text-amber-700 hover:underline text-sm">
        &larr; Back to cocktails
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-4">New Cocktail Recipe</h1>

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
            placeholder="e.g. Negroni"
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
            placeholder="Optional description"
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
              placeholder="e.g. Rocks glass"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Garnish</label>
            <input
              type="text"
              value={garnish}
              onChange={e => setGarnish(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Orange peel"
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
            placeholder="Optional tasting notes, tips, etc."
          />
        </div>

        {/* Queue for enrichment */}
        <label className="inline-flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={enrichmentPending}
            onChange={e => setEnrichmentPending(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          Queue for AI enrichment
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2.5 rounded font-medium text-sm"
        >
          {submitting ? 'Creating...' : 'Create Recipe'}
        </button>
      </form>
    </div>
  );
}
