'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Copy,
    ExternalLink,
    Loader2,
    Search,
    RefreshCw,
    Trash2,
    CheckCircle2,
    AlertCircle,
    CalendarDays,
    Clock,
    User,
    Phone,
    MapPin,
    Hash,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

interface DesignPreview {
    slug: string;
    p_hash: string;
    price: number | null;
    keywords: string | null;
    original_image_url: string | null;
    studio_edited_image_url: string | null;
    cake_type: string;
    cake_thickness: string;
    cake_size: string | null;
    availability: string | null;
    found: boolean;
}

interface ShareToken {
    token: string;
    is_revoked: boolean;
    created_at: string;
    expires_at: string;
    renewed_at: string | null;
    admin_order_date: string | null;
    admin_order_time_slot: string | null;
    admin_customer_name: string | null;
    admin_customer_contact: string | null;
    admin_delivery_address: string | null;
    admin_delivery_city: string | null;
    design_slug: string | null;
    design_p_hash: string | null;
    cart_url: string;
}

const TIME_SLOTS = [
    '10AM - 12NN',
    '12NN - 2PM',
    '2PM - 4PM',
    '4PM - 6PM',
    '6PM - 8PM',
];

// Helper: extract slug from a genie.ph/customizing/<slug> URL or raw slug
function extractSlug(input: string): string {
    const trimmed = input.trim();
    // If it's a full URL, pull the last path segment
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const url = new URL(trimmed);
            const parts = url.pathname.split('/').filter(Boolean);
            // e.g. /customizing/<slug> → parts[1] is "customizing", parts[2] is slug
            if (parts[0] === 'customizing' && parts[1]) {
                return parts[1];
            }
            return parts[parts.length - 1];
        } catch {
            return trimmed;
        }
    }
    return trimmed;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Manila',
    });
}

function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() <= Date.now();
}

export default function CreateOrderClient() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');

    const [productUrl, setProductUrl] = useState('');
    const [slugPreview, setSlugPreview] = useState('');
    const [designPreview, setDesignPreview] = useState<DesignPreview | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);

    const [quantity, setQuantity] = useState(1);
    const [orderDate, setOrderDate] = useState('');
    const [timeSlot, setTimeSlot] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryCity, setDeliveryCity] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedToken, setGeneratedToken] = useState<ShareToken | null>(null);

    const [tokens, setTokens] = useState<ShareToken[]>([]);
    const [isTokensLoading, setIsTokensLoading] = useState(false);
    const [renewingToken, setRenewingToken] = useState<string | null>(null);

    const adminFetch = useCallback(
        (input: RequestInfo | URL, init: RequestInit = {}) => {
            const headers = new Headers(init.headers);
            headers.set('x-admin-pin', ADMIN_IMAGE_STUDIO_PIN);
            return fetch(input, { ...init, headers });
        },
        [],
    );

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === ADMIN_IMAGE_STUDIO_PIN) {
            setIsAuthenticated(true);
        } else {
            toast.error('Invalid PIN');
        }
    };

    // --- Design lookup ---
    const handleUrlBlur = async () => {
        if (!productUrl.trim()) return;
        const extracted = extractSlug(productUrl);
        if (!extracted) return;

        setSlugPreview(extracted);
        setIsLookingUp(true);
        setDesignPreview(null);

        try {
            const res = await adminFetch(`/api/admin/design-lookup?slug=${encodeURIComponent(extracted)}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Design not found');
            }
            const json = await res.json();
            setDesignPreview(json.found ? json : null);
            if (!json.found) {
                toast.error('Design not found with that slug');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to look up design');
        } finally {
            setIsLookingUp(false);
        }
    };

    // --- Generate share link ---
    const handleGenerateLink = async () => {
        if (!slugPreview) {
            toast.error('Please enter a product URL or slug first');
            return;
        }
        if (!orderDate) {
            toast.error('Please select a delivery date');
            return;
        }
        if (!timeSlot) {
            toast.error('Please select a time slot');
            return;
        }

        setIsGenerating(true);
        try {
            const res = await adminFetch('/api/admin/create-shared-cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: slugPreview,
                    quantity,
                    orderDate,
                    timeSlot,
                    customerName,
                    customerContact,
                    deliveryAddress,
                    deliveryCity,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Failed to create shared cart (HTTP ${res.status})`);
            }

            const result = await res.json();

            setGeneratedToken({
                token: result.token,
                cart_url: result.cart_url,
                is_revoked: false,
                created_at: new Date().toISOString(),
                expires_at: result.expires_at,
                renewed_at: null,
                admin_order_date: orderDate,
                admin_order_time_slot: result.cart_url ? timeSlot : timeSlot,
                admin_customer_name: customerName,
                admin_customer_contact: customerContact,
                admin_delivery_address: deliveryAddress,
                admin_delivery_city: deliveryCity,
                design_slug: slugPreview,
                design_p_hash: designPreview?.p_hash || null,
            });

            toast.success('Share link generated!');
            loadTokens();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to generate link');
        } finally {
            setIsGenerating(false);
        }
    };

    // --- List tokens ---
    const loadTokens = useCallback(async () => {
        setIsTokensLoading(true);
        try {
            const res = await adminFetch('/api/admin/list-share-tokens');
            if (!res.ok) throw new Error('Failed to load tokens');
            const json = await res.json();
            setTokens(json.tokens || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsTokensLoading(false);
        }
    }, [adminFetch]);

    // --- Renew token ---
    const handleRenew = async (token: string) => {
        setRenewingToken(token);
        try {
            const res = await adminFetch('/api/admin/renew-share-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to renew token');
            }

            toast.success('Token renewed for 7 more days');
            loadTokens();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to renew token');
        } finally {
            setRenewingToken(null);
        }
    };

    // --- Copy link ---
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => toast.success('Copied to clipboard'))
            .catch(() => toast.error('Failed to copy'));
    };

    // Auto-extract slug when productUrl changes via "Extract" button
    const handleExtractSlug = () => {
        const extracted = extractSlug(productUrl);
        setSlugPreview(extracted);
    };

    // Load tokens on mount
    useEffect(() => {
        if (isAuthenticated) {
            loadTokens();
        }
    }, [isAuthenticated, loadTokens]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Admin Login</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Enter PIN</label>
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                placeholder="******"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
                        >
                            Access Admin
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Create Order (Share Cart Link)</h1>
                <div className="text-sm text-gray-500">
                    Logged in as admin &middot; PIN: {ADMIN_IMAGE_STUDIO_PIN.replace(/.(?=.{1})/g, '•')}
                </div>
            </div>

            {/* Step 1: Product URL */}
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Step 1: Product Link</h2>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product URL or Slug</label>
                    <input
                        type="text"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        onBlur={handleUrlBlur}
                        placeholder="https://genie.ph/customizing/pickleball-cake-mint-1-tier-cake-181e  or  paste slug directly"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Paste the full /customizing/ URL or just the slug. Click away or press Enter to extract.
                    </p>
                </div>

                {productUrl && !productUrl.includes('customizing/') && !productUrl.startsWith('http') && (
                    <button
                        onClick={handleExtractSlug}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Use as slug
                    </button>
                )}

                {isLookingUp && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Looking up design...
                    </div>
                )}

                {slugPreview && (
                    <div className="flex items-center gap-2 text-sm">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Extracted slug:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">{slugPreview}</code>
                    </div>
                )}

                {designPreview && designPreview.found && (
                    <div className="flex gap-4 items-start mt-3 p-4 border border-gray-200 rounded-lg">
                        <div className="w-24 h-24 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                            <img
                                src={designPreview.studio_edited_image_url || designPreview.original_image_url || ''}
                                alt={designPreview.keywords || 'cake'}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-gray-800">
                                {designPreview.keywords || 'Custom Cake'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Type: {designPreview.cake_type} · Thickness: {designPreview.cake_thickness}
                                {designPreview.cake_size && ` · Size: ${designPreview.cake_size}`}
                            </p>
                            {designPreview.price && (
                                <p className="text-sm font-medium text-primary mt-1">
                                    Price: ₱{designPreview.price.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: Quantity */}
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Step 2: Quantity</h2>
                <div className="w-20">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Step 3: Delivery Details */}
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Step 3: Delivery Details (prefill the customer&apos;s cart)</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <CalendarDays className="w-4 h-4" /> Order Date
                        </label>
                        <input
                            type="date"
                            value={orderDate}
                            onChange={(e) => setOrderDate(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Clock className="w-4 h-4" /> Time Slot
                        </label>
                        <select
                            value={timeSlot}
                            onChange={(e) => setTimeSlot(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">Select a time slot</option>
                            {TIME_SLOTS.map((slot) => (
                                <option key={slot} value={slot}>{slot}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <User className="w-4 h-4" /> Customer Name
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Juan Dela Cruz"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Phone className="w-4 h-4" /> Contact Number
                        </label>
                        <input
                            type="tel"
                            value={customerContact}
                            onChange={(e) => setCustomerContact(e.target.value)}
                            placeholder="0912 345 6789"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> Delivery Address
                    </label>
                    <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Street address, landmark"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className="w-64">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery City</label>
                    <input
                        type="text"
                        value={deliveryCity}
                        onChange={(e) => setDeliveryCity(e.target.value)}
                        placeholder="e.g. Cebu City, Mandaue City"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Step 4: Generate */}
            <div className="bg-white rounded-xl shadow p-6">
                <button
                    onClick={handleGenerateLink}
                    disabled={!slugPreview || !designPreview || isGenerating}
                    className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isGenerating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <ExternalLink className="w-5 h-5" />
                    )}
                    Generate Shareable Cart Link
                </button>
            </div>

            {/* Result */}
            {generatedToken && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-green-800">Link Generated!</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                        Share this link with the customer. When they open it, their existing cart will be
                        <strong> replaced</strong> with this pre-configured design.
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={generatedToken.cart_url}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        />
                        <button
                            onClick={() => copyToClipboard(generatedToken.cart_url)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                        >
                            <Copy className="w-4 h-4" /> Copy
                        </button>
                        <a
                            href={generatedToken.cart_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors flex items-center gap-1"
                        >
                            <ExternalLink className="w-4 h-4" /> Open
                        </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Token: {generatedToken.token} · Expires: {formatDate(generatedToken.expires_at)}
                    </p>
                </div>
            )}

            {/* Existing tokens */}
            <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Existing Share Links</h2>
                    <button
                        onClick={loadTokens}
                        disabled={isTokensLoading}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${isTokensLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {isTokensLoading ? (
                    <div className="text-center py-8 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                ) : tokens.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        No share links generated yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="pb-2 font-medium text-gray-700">Status</th>
                                    <th className="pb-2 font-medium text-gray-700">Design</th>
                                    <th className="pb-2 font-medium text-gray-700">Date / Time</th>
                                    <th className="pb-2 font-medium text-gray-700">Customer</th>
                                    <th className="pb-2 font-medium text-gray-700">Expires</th>
                                    <th className="pb-2 font-medium text-gray-700 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokens.map((t) => {
                                    const expired = isExpired(t.expires_at);
                                    const status = t.is_revoked ? 'Revoked' : expired ? 'Expired' : 'Active';
                                    const statusColor = t.is_revoked
                                        ? 'text-red-600 bg-red-100'
                                        : expired
                                          ? 'text-amber-600 bg-amber-100'
                                          : 'text-green-600 bg-green-100';

                                    return (
                                        <tr key={t.token} className="border-b">
                                            <td className="py-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="py-2">
                                                {t.design_slug ? (
                                                    <a
                                                        href={`https://genie.ph/customizing/${t.design_slug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline"
                                                    >
                                                        {t.design_slug.slice(0, 30)}{t.design_slug.length > 30 && '...'}
                                                    </a>
                                                ) : '-'}
                                            </td>
                                            <td className="py-2">
                                                {t.admin_order_date && (
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <CalendarDays className="w-3 h-3" />
                                                        {new Date(t.admin_order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                                                    </div>
                                                )}
                                                {t.admin_order_time_slot && (
                                                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                        <Clock className="w-3 h-4" />
                                                        {t.admin_order_time_slot}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2">
                                                {t.admin_customer_name && (
                                                    <div className="text-xs">{t.admin_customer_name}</div>
                                                )}
                                                {t.admin_customer_contact && (
                                                    <div className="text-xs text-gray-500">{t.admin_customer_contact}</div>
                                                )}
                                            </td>
                                            <td className="py-2 text-xs text-gray-500">
                                                {formatDate(t.expires_at)}
                                                {t.renewed_at && (
                                                    <span className="block text-xs text-gray-400">
                                                        Renewed: {formatDate(t.renewed_at)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 text-right">
                                                {!t.is_revoked && (
                                                    <button
                                                        onClick={() => handleRenew(t.token)}
                                                        disabled={renewingToken === t.token}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Renew (extends 7 days)"
                                                    >
                                                        {renewingToken === t.token ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => copyToClipboard(t.cart_url)}
                                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors ml-1"
                                                    title="Copy link"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <a
                                                    href={t.cart_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors ml-1"
                                                    title="Open link"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
