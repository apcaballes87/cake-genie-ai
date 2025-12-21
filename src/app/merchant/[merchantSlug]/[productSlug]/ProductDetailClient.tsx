'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, MapPin, Phone, Star, ShoppingCart, Heart, Share2, Cake } from 'lucide-react';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import LazyImage from '@/components/LazyImage';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { showError, showLoading, showSuccess } from '@/lib/utils/toast';
import { toast } from 'react-hot-toast';

interface ProductDetailClientProps {
    product: CakeGenieMerchantProduct;
    merchant: CakeGenieMerchant;
}

export function ProductDetailClient({ product, merchant }: ProductDetailClientProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);

    const { handleImageUpload: hookImageUpload, clearImages } = useImageManagement();
    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization
    } = useCakeCustomization();

    const handleCustomize = async () => {
        if (!product.image_url || isLoading) return;

        const toastId = showLoading('Loading design...');
        setIsLoading(true);

        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        try {
            const response = await fetch(product.image_url);
            const blob = await response.blob();
            const file = new File([blob], 'product.jpg', { type: blob.type });

            await hookImageUpload(
                file,
                (result) => {
                    toast.dismiss(toastId);
                    setPendingAnalysisData(result);
                    setIsAnalyzing(false);
                    setIsLoading(false);
                    router.push('/customizing');
                },
                (err) => {
                    toast.dismiss(toastId);
                    console.error('Error processing image:', err);
                    showError('Failed to load design');
                    setIsLoading(false);
                },
                { imageUrl: product.image_url }
            );
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Error fetching image:', error);
            showError('Failed to load design');
            setIsLoading(false);
        }
    };

    const getAvailabilityDisplay = (availability: string | null) => {
        switch (availability) {
            case 'in_stock': return { text: 'In Stock', color: 'text-green-600 bg-green-50' };
            case 'out_of_stock': return { text: 'Out of Stock', color: 'text-red-600 bg-red-50' };
            case 'preorder': return { text: 'Pre-order', color: 'text-blue-600 bg-blue-50' };
            case 'made_to_order': return { text: 'Made to Order', color: 'text-purple-600 bg-purple-50' };
            default: return { text: 'Available', color: 'text-green-600 bg-green-50' };
        }
    };

    const availability = getAvailabilityDisplay(product.availability);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft size={20} />
                        <span>Back</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Share2 size={20} className="text-gray-600" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Heart size={20} className="text-gray-600" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Product Image */}
                    <div className="space-y-4">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
                            <LazyImage
                                src={product.image_url || '/placeholder-cake.png'}
                                alt={product.alt_text || product.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {product.image_caption && (
                            <p className="text-sm text-gray-500 italic text-center">{product.image_caption}</p>
                        )}
                    </div>

                    {/* Product Details */}
                    <div className="space-y-6">
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2">
                            {product.is_featured && (
                                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
                                    Featured
                                </span>
                            )}
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${availability.color}`}>
                                {availability.text}
                            </span>
                            {product.cake_type && (
                                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                                    <Cake size={12} /> {product.cake_type}
                                </span>
                            )}
                        </div>

                        {/* Title & Brand */}
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
                            {product.brand && (
                                <p className="text-gray-500">by {product.brand}</p>
                            )}
                        </div>

                        {/* Price */}
                        <div className="text-3xl font-black text-gray-900">
                            ₱{Number(product.custom_price || 0).toLocaleString()}
                        </div>

                        {/* Description */}
                        {(product.short_description || product.long_description) && (
                            <div className="space-y-2">
                                <h2 className="font-semibold text-gray-900">Description</h2>
                                <p className="text-gray-600 leading-relaxed">
                                    {product.long_description || product.short_description}
                                </p>
                            </div>
                        )}

                        {/* SKU/GTIN */}
                        {(product.sku || product.gtin) && (
                            <div className="text-sm text-gray-500 space-y-1">
                                {product.sku && <p>SKU: {product.sku}</p>}
                                {product.gtin && <p>GTIN: {product.gtin}</p>}
                            </div>
                        )}

                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {product.tags.map((tag, idx) => (
                                    <span key={idx} className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button
                                onClick={handleCustomize}
                                disabled={isLoading}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Loading...' : 'Customize This Cake'}
                            </button>
                            <button className="flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-gray-300 py-4 px-6 rounded-xl transition-colors">
                                <ShoppingCart size={20} />
                                Add to Cart
                            </button>
                        </div>

                        {/* Merchant Info */}
                        <div className="border-t border-gray-100 pt-6 mt-6">
                            <div className="flex items-center gap-4">
                                {merchant.profile_image_url && (
                                    <Image
                                        src={merchant.profile_image_url}
                                        alt={merchant.business_name}
                                        width={48}
                                        height={48}
                                        className="rounded-full"
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900">{merchant.business_name}</h3>
                                    {merchant.city && (
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            <MapPin size={14} /> {merchant.city}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => router.push(`/merchant/${merchant.slug}`)}
                                    className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                                >
                                    View Shop
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
