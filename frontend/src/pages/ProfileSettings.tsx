import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import ImageUpload from '../components/ImageUpload';

export default function ProfileSettings() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const saveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const updated = await api.patch<typeof user>(`/users/${user.id}`, {
        name: trimmedName,
        display_name: displayName.trim() || null,
      });
      setUser(updated);
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageChanged = async (path: string | null) => {
    try {
      const updated = await api.patch<typeof user>(`/users/${user.id}`, {
        image_path: path,
      });
      setUser(updated);
    } catch (err) {
      console.error('Failed to update avatar:', err);
      alert('Failed to update avatar.');
    }
  };

  const switchProfile = () => {
    setUser(null);
  };

  const deleteProfile = async () => {
    if (!confirm('Are you sure you want to delete your profile? This cannot be undone.')) return;
    try {
      await api.delete(`/users/${user.id}`);
      setUser(null);
    } catch (err) {
      console.error('Failed to delete profile:', err);
      alert('Failed to delete profile.');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-amber-700 hover:text-amber-900 text-sm mb-4 inline-block"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      {/* Avatar */}
      <section className="mb-6">
        <label className="block text-sm font-medium text-stone-700 mb-2">Avatar</label>
        <ImageUpload
          currentImage={user.image_path}
          onImageChanged={handleImageChanged}
        />
      </section>

      {/* Display Name */}
      <section className="mb-4">
        <label className="block text-sm font-medium text-stone-700 mb-1">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Optional display name"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </section>

      {/* Name */}
      <section className="mb-6">
        <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </section>

      {/* Save */}
      <button
        onClick={saveProfile}
        disabled={!name.trim() || saving}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg font-medium disabled:opacity-50 mb-8"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Actions */}
      <div className="border-t border-stone-200 pt-6 space-y-3">
        <button
          onClick={switchProfile}
          className="w-full py-2 px-4 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm"
        >
          Switch Profile
        </button>
        <button
          onClick={deleteProfile}
          className="w-full py-2 px-4 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm"
        >
          Delete Profile
        </button>
      </div>
    </div>
  );
}
