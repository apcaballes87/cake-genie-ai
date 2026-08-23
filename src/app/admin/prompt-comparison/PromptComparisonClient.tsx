/* eslint-disable @next/next/no-img-element */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    ChevronDown,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X,
    Copy,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

const PAGE_SIZE = 20;

type PromptVersion = {
    id: string;
    version: string;
    is_active: boolean;
    created_at: string | null;
};

type CakeSearchResult = {
    p_hash: string;
    slug: string | null;
    keywords: string | null;
    original_image_url: string;
    price: number | null;
    alt_text: string | null;
    analysis_json: Record<string, unknown> | null;
    seo_title: string | null;
};

type ComparisonResult = {
    p_hash: string;
    slug: string | null;
    analysis_json: Record<string, unknown> | null;
    price: number | null;
    prompt_version: string;
    is_rejected: boolean;
    rejection_reason?: string;
    rejection_message?: string;
};

function getField(obj: Record<string, unknown> | null, key: string): string {
    if (!obj) return '-';
    const val = obj[key];
    if (val === null || val === undefined) return '-';
    if (Array.isArray(val)) return `${val.length} item(s)`;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function summaryFields(obj: Record<string, unknown> | null): Array<{ label: string; value: string }> {
    const keys = ['cakeType', 'cakeThickness', 'cakeSize'];
    return keys.map((k) => ({ label: k, value: getField(obj, k) }));
}

export default function PromptComparisonClient() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');

    const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [versionsLoading, setVersionsLoading] = useState(false);

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CakeSearchResult[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [searchPage, setSearchPage] = useState(1);
    const [isSearching, setIsSearching] = useState(false);

    const [selectedCake, setSelectedCake] = useState<CakeSearchResult | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === ADMIN_IMAGE_STUDIO_PIN) {
            setIsAuthenticated(true);
        } else {
            toast.error('Invalid PIN');
        }
    };

    const adminFetch = useCallback(
        (input: RequestInfo | URL, init: RequestInit = {}) => {
            const headers = new Headers(init.headers);
            headers.set('x-admin-pin', ADMIN_IMAGE_STUDIO_PIN);
            return fetch(input, { ...init, headers });
        },
        [],
    );

    const loadPromptVersions = useCallback(async () => {
        setVersionsLoading(true);
        try {
            const res = await adminFetch('/api/admin/ai-prompts');
            if (!res.ok) throw new Error('Failed to load prompt versions');
            const json = await res.json();
            const versions: PromptVersion[] = (json.data || []).map((v: Record<string, unknown>) => ({
                id: String(v.id ?? v.version ?? ''),
                version: String(v.version ?? ''),
                is_active: Boolean(v.is_active),
                created_at: v.created_at ? String(v.created_at) : null,
            }));
            setPromptVersions(versions);
            const active = versions.find((v) => v.is_active) ?? versions[0];
            setSelectedVersion(active?.version ?? '');
        } catch (err) {
            toast.error('Could not load prompt versions');
            console.error(err);
        } finally {
            setVersionsLoading(false);
        }
    }, [adminFetch]);

    useEffect(() => {
        if (isAuthenticated) {
            loadPromptVersions();
        }
    }, [isAuthenticated, loadPromptVersions]);

    const handleSearch = () => {
        if (!searchInput.trim()) {
            toast.error('Please enter a search keyword');
            return;
        }
        setSearchQuery(searchInput.trim());
        setSearchPage(1);
        setSelectedCake(null);
        setComparisonResult(null);
    };

    const loadSearchResults = useCallback(async () => {
        if (!searchQuery) return;

        setIsSearching(true);
        try {
            const params = new URLSearchParams({
                q: searchQuery,
                limit: String(PAGE_SIZE),
                offset: String((searchPage - 1) * PAGE_SIZE),
            });
            const res = await adminFetch(`/api/admin/cake-analysis-search?${params.toString()}`);
            if (!res.ok) throw new Error('Search failed');
            const json = await res.json();
            setSearchResults(json.data || []);
            setTotalResults(json.total || 0);
        } catch (err) {
            toast.error('Search failed');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, searchPage, adminFetch]);

    useEffect(() => {
        loadSearchResults();
    }, [loadSearchResults]);

    const handleCompare = async () => {
        if (!selectedCake) return;
        if (!selectedVersion) {
            toast.error('Please select a prompt version');
            return;
        }

        setIsComparing(true);
        setComparisonResult(null);
        try {
            const res = await adminFetch('/api/admin/cake-analysis-compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pHash: selectedCake.p_hash, promptVersion: selectedVersion }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Comparison failed');
            }
            const json = await res.json();
            setComparisonResult(json);
            if (json.is_rejected) {
                toast(`${json.rejection_reason || 'Image rejected'} by prompt v${selectedVersion}`);
            } else {
                toast.success(`Analysis complete with prompt v${selectedVersion}`);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Comparison failed');
            console.error(err);
        } finally {
            setIsComparing(false);
        }
    };

    const copyJson = (obj: unknown) => {
        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
        toast.success('Copied to clipboard');
    };

    if (!isAuthenticated) {
        return (
            <div className="max-w-md mx-auto">
                <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Prompt Comparison</h1>
                    <p className="text-sm text-gray-600 mb-4">Enter admin PIN to access the comparison tool.</p>
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Admin PIN"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        autoComplete="one-time-code"
                    />
                    <button
                        type="submit"
                        className="w-full mt-4 bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                        Login
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Prompt Comparison</h1>
                <div className="text-sm text-gray-500">
                    Logged in as admin &middot; PIN: {ADMIN_IMAGE_STUDIO_PIN.replace(/.(?=.{1})/g, '•')}
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl shadow p-5 space-y-4">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Version</label>
                        <div className="relative">
                            <select
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                                disabled={versionsLoading}
                            >
                                {versionsLoading && <option>Loading...</option>}
                                {!versionsLoading && promptVersions.length === 0 && <option value="">No versions found</option>}
                                {!versionsLoading &&
                                    promptVersions.map((v) => (
                                        <option key={v.id} value={v.version}>
                                            v{v.version} {v.is_active ? '(active)' : ''}
                                        </option>
                                    ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search Cakes</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="e.g. chocolate, wedding, flowers"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={!searchInput.trim() || isSearching}
                        className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                    </button>
                </div>

                {searchQuery && (
                    <p className="text-sm text-gray-600">
                        Searching for: <strong>&ldquo;{searchQuery}&rdquo;</strong> &mdash; {totalResults} result(s)
                    </p>
                )}
            </div>

            {/* Search Results Grid */}
            {searchResults.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {searchResults.map((cake) => (
                        <div
                            key={cake.p_hash}
                            onClick={() => {
                                setSelectedCake(cake);
                                setComparisonResult(null);
                            }}
                            className={`group cursor-pointer rounded-xl border-2 bg-white overflow-hidden transition-all ${
                                selectedCake?.p_hash === cake.p_hash
                                    ? 'border-primary shadow-lg scale-[1.02]'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="aspect-[4/3] relative bg-gray-100 overflow-hidden">
                                {cake.original_image_url ? (
                                    <img
                                        src={cake.original_image_url}
                                        alt={cake.alt_text || cake.slug || 'cake'}
                                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        No image
                                    </div>
                                )}
                            </div>
                            <div className="p-3">
                                <p className="font-medium text-sm text-gray-900 line-clamp-1">
                                    {cake.slug || cake.seo_title || 'Untitled'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                    {cake.keywords || '-'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Hash: {cake.p_hash.substring(0, 8)}…</p>
                                {cake.price != null && (
                                    <p className="text-sm font-semibold text-primary mt-1">${cake.price.toFixed(2)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {searchQuery && totalResults > PAGE_SIZE && (
                <div className="flex justify-center gap-2 mt-4">
                    <button
                        onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                        disabled={searchPage === 1 || isSearching}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-600">
                        Page {searchPage} of {Math.ceil(totalResults / PAGE_SIZE)}
                    </span>
                    <button
                        onClick={() => setSearchPage((p) => p + 1)}
                        disabled={searchPage >= Math.ceil(totalResults / PAGE_SIZE) || isSearching}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Selected Cake + Compare */}
            {selectedCake && (
                <div className="bg-white rounded-xl shadow p-5">
                    <div className="flex items-center gap-4">
                        {selectedCake.original_image_url && (
                            <img
                                src={selectedCake.original_image_url}
                                alt={selectedCake.slug || 'selected cake'}
                                className="w-16 h-16 object-cover rounded-lg"
                            />
                        )}
                        <div>
                            <h3 className="font-medium text-gray-900">
                                {selectedCake.slug || selectedCake.seo_title || 'Selected Cake'}
                            </h3>
                            <p className="text-sm text-gray-500">{selectedCake.p_hash}</p>
                            {selectedCake.price != null && (
                                <p className="text-sm text-gray-600">Stored price: ${selectedCake.price.toFixed(2)}</p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleCompare}
                        disabled={isComparing || !selectedVersion}
                        className="mt-4 px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {isComparing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Search className="w-4 h-4" />
                        )}
                        Re-run with v{selectedVersion}
                    </button>
                </div>
            )}

            {/* Comparison Results */}
            {comparisonResult && selectedCake && (
                <div className="bg-white rounded-xl shadow p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900">Comparison Result</h2>
                        <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                                comparisonResult.is_rejected
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                            }`}
                        >
                            {comparisonResult.is_rejected ? (
                                <AlertCircle className="w-3 h-3" />
                            ) : (
                                <CheckCircle2 className="w-3 h-3" />
                            )}
                            {comparisonResult.is_rejected
                                ? `Rejected by v${comparisonResult.prompt_version}`
                                : `OK — prompt v${comparisonResult.prompt_version}`}
                        </span>
                    </div>

                    {comparisonResult.is_rejected ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="font-medium text-red-900">
                                {comparisonResult.rejection_reason || 'Image rejected'}
                            </p>
                            <p className="text-sm text-red-700 mt-1">
                                {comparisonResult.rejection_message}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        <th className="text-left py-2 pr-4 text-gray-600 font-medium">Field</th>
                                        <th className="text-left py-2 pr-4 text-gray-600 font-medium">
                                            Stored (current cache)
                                        </th>
                                        <th className="text-left py-2 pr-4 text-gray-600 font-medium">
                                            v{comparisonResult.prompt_version}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-2 pr-4 font-medium text-gray-700">Price</td>
                                        <td className="py-2 pr-4">
                                            {selectedCake.price != null ? `$${selectedCake.price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {comparisonResult.price != null ? `$${comparisonResult.price.toFixed(2)}` : '-'}
                                        </td>
                                    </tr>
                                    {summaryFields(selectedCake.analysis_json).map((field) => (
                                        <tr key={field.label}>
                                            <td className="py-1 pr-4 text-gray-700">{field.label}</td>
                                            <td className="py-1 pr-4">{field.value}</td>
                                            <td className="py-1 pr-4">{getField(comparisonResult.analysis_json, field.label)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Full JSON */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-gray-700">Full analysis_json</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-medium text-gray-500">Stored (current cache)</label>
                                    <button
                                        onClick={() => copyJson(selectedCake.analysis_json)}
                                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                    >
                                        <Copy className="w-3 h-3" /> Copy
                                    </button>
                                </div>
                                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto max-h-80 overflow-y-auto">
                                    {selectedCake.analysis_json
                                        ? JSON.stringify(selectedCake.analysis_json, null, 2)
                                        : 'No cached analysis'}
                                </pre>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-medium text-gray-500">
                                        v{comparisonResult.prompt_version}
                                    </label>
                                    <button
                                        onClick={() => copyJson(comparisonResult.analysis_json)}
                                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                    >
                                        <Copy className="w-3 h-3" /> Copy
                                    </button>
                                </div>
                                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto max-h-80 overflow-y-auto">
                                    {comparisonResult.analysis_json
                                        ? JSON.stringify(comparisonResult.analysis_json, null, 2)
                                        : 'N/A'}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setComparisonResult(null)}
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                        <X className="w-4 h-4" /> Clear comparison
                    </button>
                </div>
            )}
        </div>
    );
}
