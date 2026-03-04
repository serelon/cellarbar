import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';

interface Ingredient {
  id: string;
  name: string;
  amount_cl: number | null;
  is_pantry_item: boolean;
  tag: { id: string; name: string; category: string } | null;
}

interface CocktailRecipe {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  method: string | null;
  glass_type: string | null;
  garnish: string | null;
  difficulty: string | null;
  rating: number | null;
  would_make_again: boolean | null;
  notes: string | null;
  ingredients: Ingredient[];
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
};

export default function Cocktails() {
  const [allRecipes, setAllRecipes] = useState<CocktailRecipe[]>([]);
  const [makeableIds, setMakeableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [canMakeOnly, setCanMakeOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<CocktailRecipe[]>('/cocktails'),
      api.get<CocktailRecipe[]>('/cocktails/makeable'),
    ])
      .then(([all, makeable]) => {
        setAllRecipes(all);
        setMakeableIds(new Set(makeable.map(r => r.id)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const recipes = canMakeOnly
    ? allRecipes.filter(r => makeableIds.has(r.id))
    : allRecipes;

  async function handleDelete(id: string) {
    if (!confirm('Delete this recipe?')) return;
    try {
      await api.delete(`/cocktails/${id}`);
      setAllRecipes(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return <p className="text-stone-500 text-sm">Loading cocktails...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Cocktails</h1>
        <Link
          to="/cocktails/new"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          + Add Recipe
        </Link>
      </div>

      {/* Filter toggle */}
      <div className="mb-4">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={canMakeOnly}
            onChange={e => setCanMakeOnly(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-stone-700">
            Can make tonight
            {canMakeOnly && (
              <span className="text-stone-500 ml-1">({recipes.length})</span>
            )}
          </span>
        </label>
      </div>

      {/* Recipe list */}
      {recipes.length === 0 ? (
        <p className="text-stone-500 text-sm">
          {canMakeOnly
            ? 'No cocktails can be made with your current stock.'
            : 'No recipes yet. Add your first cocktail!'}
        </p>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => {
            const isExpanded = expandedId === recipe.id;
            const isMakeable = makeableIds.has(recipe.id);

            return (
              <div
                key={recipe.id}
                className={`bg-white rounded-lg border p-4 transition-colors ${
                  isMakeable ? 'border-green-200' : 'border-stone-200'
                }`}
              >
                {/* Card header — clickable to expand */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-stone-900">{recipe.name}</span>
                        {isMakeable && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            can make
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 flex-wrap">
                        {recipe.method && (
                          <span className="capitalize">{recipe.method}</span>
                        )}
                        {recipe.difficulty && (
                          <span className={`px-1.5 py-0.5 rounded ${DIFFICULTY_STYLES[recipe.difficulty] || ''}`}>
                            {recipe.difficulty}
                          </span>
                        )}
                        <span>{recipe.ingredients.length} ingredients</span>
                      </div>
                    </div>
                    {recipe.rating != null && recipe.rating > 0 && (
                      <div className="shrink-0">
                        <StarRating value={recipe.rating} />
                      </div>
                    )}
                    <span className="text-stone-400 text-sm shrink-0 ml-1">
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
                    {recipe.description && (
                      <p className="text-sm text-stone-600">{recipe.description}</p>
                    )}

                    {/* Ingredients */}
                    <div>
                      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                        Ingredients
                      </h3>
                      <ul className="space-y-1">
                        {recipe.ingredients.map(ing => (
                          <li key={ing.id} className="text-sm text-stone-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                            <span>
                              {ing.name}
                              {ing.amount_cl != null && (
                                <span className="text-stone-400 ml-1">{ing.amount_cl} cl</span>
                              )}
                            </span>
                            {ing.is_pantry_item && (
                              <span className="text-xs px-1 py-0.5 bg-stone-100 text-stone-500 rounded">pantry</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {recipe.method && (
                        <div>
                          <span className="text-stone-500">Method:</span>{' '}
                          <span className="capitalize text-stone-800">{recipe.method}</span>
                        </div>
                      )}
                      {recipe.glass_type && (
                        <div>
                          <span className="text-stone-500">Glass:</span>{' '}
                          <span className="text-stone-800">{recipe.glass_type}</span>
                        </div>
                      )}
                      {recipe.garnish && (
                        <div>
                          <span className="text-stone-500">Garnish:</span>{' '}
                          <span className="text-stone-800">{recipe.garnish}</span>
                        </div>
                      )}
                      {recipe.would_make_again != null && (
                        <div>
                          <span className="text-stone-500">Make again:</span>{' '}
                          <span className="text-stone-800">{recipe.would_make_again ? 'Yes' : 'No'}</span>
                        </div>
                      )}
                    </div>

                    {recipe.notes && (
                      <div>
                        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                          Notes
                        </h3>
                        <p className="text-sm text-stone-600">{recipe.notes}</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete recipe
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
