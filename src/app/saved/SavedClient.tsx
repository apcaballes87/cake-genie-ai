'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Trash2, ShoppingCart, Sparkles, Cake, Star } from 'lucide-react';
import LazyImage from '@/components/LazyImage';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useSavedItems } from '@/contexts/SavedItemsContext';
import { useAuth } from '@/contexts/AuthContext';
import { CakeGenieSavedItem } from '@/lib/database.types';
import { findSimilarAnalysisByHash } from '@/services/supabaseService';
import toast from 'react-hot-toast';

const SavedClient: React.FC = () => {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const { savedItems, isLoading, removeSavedItemById } = useSavedItems();

    // Redirect if not authenticated
    React.useEffect(() => {
        if (!isLoading && (!isAuthenticated || user?.is_anonymous)) {
            router.push('/login?redirect=/saved');
        }
    }, [isAuthenticated, user, isLoading, router]);

    const handleRemove = async (item: CakeGenieSavedItem) => {
        await removeSavedItemById(item.saved_item_id);
        toast.success('Removed from saved');
    };

    const handleCustomize = async (item: CakeGenieSavedItem) => {
        const imageUrl = item.item_type === 'custom_design'
            ? item.customized_image_url
            : item.product_image;

        if (!imageUrl) return;

        const toastId = toast.loading('Loading design...');

        try {
            // Try to fetch cached analysis from database using pHash
            let cachedAnalysis = null;
            if (item.analysis_p_hash) {
                cachedAnalysis = await findSimilarAnalysisByHash(item.analysis_p_hash, imageUrl);
                if (cachedAnalysis) {
                    console.log('✅ Found cached analysis for saved item');
                }
            }

            // Store the saved item data in localStorage so CustomizingClient can restore state
            localStorage.setItem('cakegenie_restore_saved', JSON.stringify({
                imageUrl,
                snapshot: item.customization_snapshot,
                itemType: item.item_type,
                pHash: item.analysis_p_hash,
                cachedAnalysis, // Include the precomputed analysis if available
                timestamp: Date.now(),
            }));
            // Mark that we came from saved page for back navigation
            sessionStorage.setItem('cakegenie_from_saved', 'true');

            toast.dismiss(toastId);

            // Navigate with ref parameter
            router.push(`/customizing?ref=${encodeURIComponent(imageUrl)}&fromSaved=true`);
        } catch (e) {
            console.error('Failed to prepare saved item:', e);
            toast.dismiss(toastId);
            toast.error('Failed to load design');
        }
    };




    const getItemImage = (item: CakeGenieSavedItem): string => {
        return item.customized_image_url || item.product_image || '/placeholder-cake.png';
    };

    const getItemName = (item: CakeGenieSavedItem): string => {
        // For products, use product name
        if (item.product_name) return item.product_name;

        // For custom designs, try cache keywords first (from analysis cache)
        const cacheKeywords = (item as any).cache_keywords;
        if (cacheKeywords) {
            const title = cacheKeywords.split(',')[0]?.trim() || 'Custom Cake';
            return title.toLowerCase().endsWith('cake') ? title : `${title} Cake`;
        }

        // Fallback to customization snapshot
        if (item.customization_snapshot) {
            const snapshot = item.customization_snapshot;
            const flavors = snapshot.flavors?.join(', ') || '';
            return `Custom Design${flavors ? ` - ${flavors}` : ''}`;
        }
        return 'Custom Design';
    };

    const getItemPrice = (item: CakeGenieSavedItem): number | null => {
        // For custom designs, use cache price
        const cachePrice = (item as any).cache_price;
        if (cachePrice) return cachePrice;

        return item.product_price || null;
    };

    const getItemCakeType = (item: CakeGenieSavedItem): string => {
        // For custom designs, use cache cakeType
        const cacheCakeType = (item as any).cache_cake_type;
        if (cacheCakeType) return cacheCakeType;

        return item.item_type === 'custom_design' ? 'Custom Design' : '1 Tier';
    };


    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (!isAuthenticated || user?.is_anonymous) {
        return null;
    }

    return (
        <div className="min-h-screen pb-24 md:pb-8">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Heart className="w-6 h-6 text-red-500" fill="currentColor" />
                            <h1 className="text-2xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
                                My Saved Cakes
                            </h1>
                        </div>
                        <span className="ml-auto text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
                            {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {savedItems.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-24 h-24 rounded-full bg-linear-to-br from-pink-100 to-purple-100 flex items-center justify-center mb-6">
                            <Heart className="w-12 h-12 text-purple-300" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">No saved cakes yet</h2>
                        <p className="text-slate-500 mb-6 max-w-sm">
                            Browse our collection and tap the heart icon on any cake to save it for later!
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                        >
                            <Sparkles className="inline-block w-5 h-5 mr-2" />
                            Explore Cakes
                        </button>
                    </div>
                ) : (
                    // Saved Items Grid
                    <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
                        {savedItems.map((item) => (
                            <div
                                key={item.saved_item_id}
                                onClick={() => handleCustomize(item)}
                                className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group cursor-pointer h-full flex flex-col"
                            >
                                <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                    <LazyImage
                                        src={getItemImage(item)}
                                        alt={getItemName(item)}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        sizes="(max-width: 490px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                    />

                                    {/* Overlay Gradient on Hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                                    {/* Delete Button (Trash icon instead of Heart) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(item);
                                        }}
                                        aria-label="Remove from saved"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleRemove(item); } }}
                                        className="absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-all z-10 bg-white/90 text-gray-600 hover:bg-red-500 hover:text-white"
                                    >
                                        <Trash2 size={16} className="transition-transform active:scale-125" />
                                    </button>

                                    {/* Tag Badge at Bottom */}
                                    <span className={`absolute bottom-3 left-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm z-10 ${item.item_type === 'custom_design'
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-white/90 backdrop-blur-md text-gray-900'
                                        }`}>
                                        {item.item_type === 'custom_design' ? 'Custom Design' : 'Product'}
                                    </span>
                                </div>

                                <div className="px-1 flex flex-col flex-1">
                                    <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                        {getItemName(item)}
                                    </h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-auto">
                                        <Cake size={12} /> {getItemCakeType(item)}
                                    </p>
                                    <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-3">
                                        <span className="font-black text-gray-900 text-base md:text-lg">
                                            {getItemPrice(item) ? `₱${getItemPrice(item)!.toLocaleString()}` : '—'}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                                            <Star size={12} fill="currentColor" /> 5.0
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                )}
            </div>

            <MobileBottomNav />
        </div>
    );
};

export default SavedClient;
