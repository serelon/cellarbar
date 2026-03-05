import { useRef, useState } from 'react';
import { api } from '../api/client';

interface Props {
  currentImage: string | null;
  onImageChanged: (path: string | null) => void;
}

export default function ImageUpload({ currentImage, onImageChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const { path } = await api.upload('/images', file);
      onImageChanged(path);
      setPreview(null);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function removeImage() {
    onImageChanged(null);
    setPreview(null);
  }

  const displaySrc = preview || currentImage;

  return (
    <div>
      {displaySrc && (
        <div className="relative mb-2">
          <img
            src={displaySrc}
            alt="Bottle/cocktail"
            className="w-full max-w-xs rounded-lg object-cover aspect-square"
          />
          <button
            onClick={removeImage}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-black/80"
            title="Remove image"
          >
            &times;
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : displaySrc ? 'Change Photo' : 'Add Photo'}
        </button>
      </div>
    </div>
  );
}
