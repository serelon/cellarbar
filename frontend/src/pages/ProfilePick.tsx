import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../hooks/useAuth';

export default function ProfilePick() {
  const { setUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<User[]>('/users').then(setUsers);
  }, []);

  const selectUser = async (u: User) => {
    await api.post(`/users/${u.id}/select`);
    setUser(u);
  };

  const createUser = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await api.post<User>('/users', { name: trimmed });
      await api.post(`/users/${created.id}/select`);
      setUser(created);
    } catch (err) {
      console.error('Failed to create user:', err);
      alert('Failed to create profile.');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Who's here?</h1>
        <div className="flex flex-col gap-3">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => selectUser(u)}
              className="flex items-center gap-3 py-3 px-4 rounded-lg bg-stone-100 hover:bg-amber-100 transition"
            >
              {u.image_path ? (
                <img src={u.image_path} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold">
                  {(u.display_name || u.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="text-lg font-medium">{u.name}</div>
                {u.display_name && (
                  <div className="text-sm text-stone-500">{u.display_name}</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 w-full py-2 px-4 rounded-lg border-2 border-dashed border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-700 transition text-sm"
          >
            + Create profile
          </button>
        ) : (
          <div className="mt-6 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createUser()}
              placeholder="Name"
              autoFocus
              className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={createUser}
              disabled={!newName.trim() || creating}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {creating ? '...' : 'Create'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
