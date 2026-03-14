'use client';

import { useState, useEffect } from 'react';
import { getDesignCategories, getDesignsByKeyword } from '@/services/supabaseService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PinterestManagerClient() {
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedCollectionName, setSelectedCollectionName] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const DAILY_LIMIT = 10;

  useEffect(() => {
    async function loadCollections() {
      const { data } = await getDesignCategories();
      if (data) setCollections(data);
    }
    loadCollections();
    fetchDailyUsage();
  }, []);

  const fetchDailyUsage = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('cakegenie_pinterest_pins')
      .select('*', { count: 'exact', head: true })
      .gt('pinned_at', twentyFourHoursAgo);
    
    setDailyUsage(count || 0);
  };

  useEffect(() => {
    if (!selectedCollection) {
      setProducts([]);
      setSelectedProducts([]);
      return;
    }
    async function loadProducts() {
      setLoading(true);
      const { data } = await getDesignsByKeyword(selectedCollection, 100);
      if (data) {
        // Filter out products already pinned (optional but good UI)
        // For now just show all
        setProducts(data);
      }
      setLoading(false);
    }
    loadProducts();
  }, [selectedCollection]);

  const handleConnect = () => {
    window.location.href = `/api/pinterest/auth`;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProducts(products.map(p => p.p_hash));
    } else {
      setSelectedProducts([]);
    }
  };

  const toggleProduct = (p_hash: string) => {
    setSelectedProducts(prev => 
      prev.includes(p_hash) 
        ? prev.filter(id => id !== p_hash) 
        : [...prev, p_hash]
    );
  };

  const handleSync = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select at least one product');
      return;
    }

    const remaining = DAILY_LIMIT - dailyUsage;
    if (selectedProducts.length > remaining) {
      if (!confirm(`You selected ${selectedProducts.length} items, but you only have ${remaining} remaining in your daily limit. Only the first ${remaining} will be pinned. Continue?`)) {
        return;
      }
    }

    const accessToken = prompt('Please enter your Pinterest Access Token:');
    if (!accessToken) return;

    setLoading(true);
    setError(null);
    setSyncResults(null);
    setMessage(`Syncing ${Math.min(selectedProducts.length, remaining)} products with safety delays...`);

    try {
      const response = await fetch('/api/pinterest/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: selectedCollectionName,
          pHashes: selectedProducts,
          accessToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sync failed');
      
      setSyncResults(data);
      setMessage(null);
      fetchDailyUsage(); // Refresh usage
    } catch (err: any) {
      setError(err.message);
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl mt-10 border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold bg-linear-to-r from-red-600 to-pink-500 bg-clip-text text-transparent">
            Pinterest Channel Manager
          </h1>
          <p className="text-gray-500 mt-2">Claim your domain and sync products safely.</p>
        </div>
        
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3 max-w-sm">
          <div className="bg-orange-500 shrink-0 p-1.5 rounded-full text-white mt-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-xs font-bold text-orange-800 uppercase tracking-wider">Daily Pinning Logic</p>
            <p className="text-xs text-orange-700 leading-relaxed">
              We enforce a strict <b>{DAILY_LIMIT} pins per day</b> limit to protect your account. 
              Sequential delays of 10s are added between каждой pin.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Settings */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">1. Select Collection / Board</label>
              <select
                value={selectedCollection}
                onChange={(e) => {
                  setSelectedCollection(e.target.value);
                  const col = collections.find(c => c.slug === e.target.value);
                  setSelectedCollectionName(col?.keyword || '');
                }}
                className="w-full p-4 border border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-100 focus:border-pink-500 transition-all bg-white font-medium"
              >
                <option value="">-- Choose a Collection --</option>
                {collections.map((c: any) => (
                  <option key={c.slug} value={c.slug}>
                    {c.keyword} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleConnect}
              className="w-full flex items-center justify-center gap-3 p-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-100 active:scale-[0.98]"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.034-1.002 2.331-1.492 3.127C10.038 23.86 11.003 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
              </svg>
              Connect to Pinterest
            </button>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-2">Usage Summary (Last 24h)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500">Pinned</p>
                  <p className="text-lg font-bold">{dailyUsage}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500">Remaining</p>
                  <p className="text-lg font-bold text-pink-500">{Math.max(0, DAILY_LIMIT - dailyUsage)}</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-500">Selected</p>
                <p className="text-lg font-bold text-indigo-500">{selectedProducts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Collection Select */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <h2 className="font-bold text-gray-900">2. Select Designs from Analysis Cache</h2>
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-sm font-medium text-gray-600 group-hover:text-pink-600 transition-colors">Select All Visible</span>
              <input 
                type="checkbox" 
                onChange={handleSelectAll}
                checked={products.length > 0 && selectedProducts.length === products.length}
                className="w-5 h-5 rounded-md border-gray-300 text-pink-600 focus:ring-pink-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {products.length > 0 ? (
              products.map((product: any) => (
                <div 
                  key={product.p_hash}
                  onClick={() => toggleProduct(product.p_hash)}
                  className={`flex items-center gap-4 p-3 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.97] ${
                    selectedProducts.includes(product.p_hash) 
                      ? 'border-pink-500 bg-pink-50/30' 
                      : 'border-gray-100 hover:border-pink-200'
                  }`}
                >
                  <div className="relative w-16 h-16 shrink-0 bg-gray-100 rounded-xl overflow-hidden shadow-sm">
                    {product.original_image_url ? (
                      <img src={product.original_image_url} alt={product.alt_text} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className={`absolute inset-0 bg-pink-500/20 flex items-center justify-center transition-opacity ${selectedProducts.includes(product.p_hash) ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="bg-white rounded-full p-1 shadow-md">
                        <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate text-sm">{product.slug}</p>
                    <p className="text-xs text-gray-500 truncate">{product.alt_text || 'Premium Design'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-20 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
                {selectedCollection ? (loading ? 'Loading designs...' : 'No designs found for this collection') : 'Select a collection to view designs'}
              </div>
            )}
          </div>

          <div className="pt-6">
            <button
              onClick={handleSync}
              disabled={loading || selectedProducts.length === 0 || dailyUsage >= DAILY_LIMIT}
              className="w-full flex items-center justify-center gap-3 p-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Syncing {selectedProducts.length} Items...
                </>
              ) : (
                <>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                  Push to Pinterest {dailyUsage >= DAILY_LIMIT && '(Daily Limit Reached)'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      <div className="mt-8">
        {message && (
          <div className="p-4 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 flex items-center gap-3 animate-pulse">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-medium text-sm">{message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 mt-4 flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-bold text-sm">Error: {error}</span>
          </div>
        )}

        {syncResults && (
          <div className="p-8 bg-green-50 text-green-800 rounded-3xl border border-green-100 mt-4 animate-in fade-in slide-in-from-bottom-4 zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-500 p-1.5 rounded-full text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="font-black text-2xl tracking-tight">Sync Completed!</h3>
            </div>
            
            <p className="font-medium text-green-700 mb-6 px-1 opacity-80">{syncResults.message}</p>
            <p className="text-sm font-bold text-green-600 mb-4 px-1">Daily Limit Used: {syncResults.used_limit}/{DAILY_LIMIT}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {syncResults.results?.map((res: any) => (
                <div key={res.p_hash} className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-green-200/50 flex flex-col shadow-sm">
                  <span className="text-xs uppercase font-bold text-green-600 tracking-widest mb-1 truncate">{res.p_hash}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-black text-green-900">{res.status}</span>
                    {res.error && <span className="text-[10px] text-red-500 truncate">{res.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">How to use:</p>
        <ol className="list-decimal list-inside space-y-1 ml-1">
          <li>Select a <b>Collection</b> (will map to a Pinterest Board).</li>
          <li>Click <b>Connect to Pinterest</b> to get your token if needed.</li>
          <li>Select individual products from the cache.</li>
          <li>Click <b>Push to Pinterest</b>. We pin max 10/day for safety.</li>
        </ol>
      </div>
    </div>
  );
}
