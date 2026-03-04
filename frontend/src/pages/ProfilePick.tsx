import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../hooks/useAuth';

export default function ProfilePick() {
  const { setUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get<User[]>('/users').then(setUsers);
  }, []);

  const selectUser = async (u: User) => {
    await api.post(`/users/${u.id}/select`);
    setUser(u);
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
              className="py-3 px-4 rounded-lg bg-stone-100 hover:bg-amber-100 text-lg font-medium transition"
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
