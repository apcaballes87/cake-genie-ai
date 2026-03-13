'use client';

import { useState, useEffect } from 'react';
import { getMerchants } from '@/services/supabaseService';
import { CakeGenieMerchant } from '@/lib/database.types';

export default function PinterestManagerClient() {
  const [merchants, setMerchants] = useState<CakeGenieMerchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMerchants() {
      const { data } = await getMerchants();
      if (data) setMerchants(data);
    }
    loadMerchants();
  }, []);

  const handleConnect = () => {
    if (!selectedMerchant) {
      alert('Please select a merchant first');
      return;
    }
    window.location.href = `/api/pinterest/auth?merchant_id=${selectedMerchant}`;
  };

  const handleSync = async () => {
    if (!selectedMerchant) {
      alert('Please select a merchant first');
      return;
    }

    const accessToken = prompt('Please enter your Pinterest Access Token (returned after connection):');
    if (!accessToken) return;

    setLoading(true);
    setError(null);
    setSyncStatus(null);

    try {
      const response = await fetch('/api/pinterest/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: selectedMerchant,
          accessToken,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setSyncStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white rounded-2xl shadow-xl mt-10">
      <h1 className="text-3xl font-bold bg-linear-to-r from-red-600 to-pink-500 bg-clip-text text-transparent mb-6">
        Pinterest Channel Manager
      </h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Merchant to Sync</label>
          <select
            value={selectedMerchant}
            onChange={(e) => setSelectedMerchant(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 transition-all"
          >
            <option value="">-- Select a Merchant --</option>
            {merchants.map((m) => (
              <option key={m.merchant_id} value={m.merchant_id}>
                {m.business_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleConnect}
            className="flex items-center justify-center gap-2 p-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all shadow-md active:scale-95"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.034-1.002 2.331-1.492 3.127C10.038 23.86 11.003 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
            1. Connect to Pinterest
          </button>

          <button
            onClick={handleSync}
            disabled={loading}
            className="flex items-center justify-center gap-2 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Syncing...' : '2. Push Products (Sync)'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 italic">
            Error: {error}
          </div>
        )}

        {syncStatus && (
          <div className="p-6 bg-green-50 text-green-800 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="font-bold text-lg mb-2">✅ Sync Success!</h3>
            <p className="mb-4">{syncStatus.message}</p>
            <div className="space-y-2">
              {syncStatus.results?.map((res: any) => (
                <div key={res.category} className="flex justify-between items-center bg-white/50 p-2 rounded-lg">
                  <span className="font-medium">{res.category}</span>
                  <span className="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs">
                    {res.pins_created} pins
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">How to use:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Select a merchant from the dropdown.</li>
          <li>Click <b>Connect to Pinterest</b> and follow the steps in the new tab.</li>
          <li>Copy the <b>access_token</b> from the result page.</li>
          <li>Click <b>Push Products</b> and paste the token when prompted.</li>
        </ol>
      </div>
    </div>
  );
}
