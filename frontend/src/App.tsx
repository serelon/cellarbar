import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './hooks/useAuth';
import type { User } from './hooks/useAuth';
import Layout from './components/Layout';
import ProfilePick from './pages/ProfilePick';
import Dashboard from './pages/Dashboard';
import Collection from './pages/Collection';
import Tastings from './pages/Tastings';
import Cocktails from './pages/Cocktails';
import ShoppingList from './pages/ShoppingList';
import BottleDetail from './pages/BottleDetail';
import QuickAdd from './pages/QuickAdd';
import NewTasting from './pages/NewTasting';
import NewCocktail from './pages/NewCocktail';
import EditCocktail from './pages/EditCocktail';
import Pantry from './pages/Pantry';
import ProfileSettings from './pages/ProfileSettings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [oidc, setOidc] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/users/me', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch('/api/auth/config')
        .then(r => r.ok ? r.json() : { oidc: false })
        .catch(() => ({ oidc: false })),
    ]).then(([u, cfg]) => {
      setUser(u);
      setOidc(!!cfg.oidc);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, setUser, oidc }}>
      <BrowserRouter>
        <Routes>
          {!user ? (
            <Route path="*" element={<ProfilePick />} />
          ) : (
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/collection/add" element={<QuickAdd />} />
              <Route path="/collection/:id" element={<BottleDetail />} />
              <Route path="/tastings" element={<Tastings />} />
              <Route path="/tastings/new" element={<NewTasting />} />
              <Route path="/cocktails" element={<Cocktails />} />
              <Route path="/cocktails/new" element={<NewCocktail />} />
              <Route path="/cocktails/:id/edit" element={<EditCocktail />} />
              <Route path="/shopping" element={<ShoppingList />} />
              <Route path="/pantry" element={<Pantry />} />
              <Route path="/profile" element={<ProfileSettings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
