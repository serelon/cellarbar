import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import BarcodeScanner from '../components/BarcodeScanner';

type BottleType = 'wine' | 'spirit' | 'liqueur' | 'beer' | 'other';

interface BarcodeLookup {
  found: boolean;
  name?: string;
  brand?: string;
  source?: string;
}

export default function QuickAdd() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<BottleType>('wine');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  async function lookupBarcode(code: string) {
    setLookingUp(true);
    try {
      const result = await api.get<BarcodeLookup>(`/barcode/${code}`);
      if (result.found && result.name) {
        const fullName = result.brand
          ? `${result.brand} ${result.name}`
          : result.name;
        if (!name.trim()) {
          setName(fullName);
        }
      }
    } catch {
      // Lookup is best-effort; ignore errors
    }
    setLookingUp(false);
  }

  function handleBarcodeDetected(code: string) {
    setBarcode(code);
    setScanning(false);
    lookupBarcode(code);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/bottles', {
        name: name.trim(),
        type,
        quantity: parseFloat(quantity) || 1,
        purchase_price_kr: price ? parseFloat(price) : null,
        barcode: barcode.trim() || null,
      });
      navigate('/collection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bottle');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Link to="/collection" className="text-amber-700 hover:underline text-sm">
        &larr; Back to collection
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-4">Quick Add</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="e.g. Barolo 2018"
            required
          />
          {lookingUp && (
            <p className="text-xs text-stone-500 mt-1">Looking up barcode...</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as BottleType)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="wine">Wine</option>
            <option value="spirit">Spirit</option>
            <option value="liqueur">Liqueur</option>
            <option value="beer">Beer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Quantity</label>
          <input
            type="number"
            min="0.1"
            step="any"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Price (kr)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Barcode</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="flex-1 border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Optional"
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-2 rounded text-sm font-medium shrink-0"
            >
              Scan
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2.5 rounded font-medium text-sm"
        >
          {submitting ? 'Adding...' : 'Add to Collection'}
        </button>
      </form>

      {scanning && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
