'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Masonry from 'react-masonry-css';
import { Menu, Search, ShoppingBag, User, X, Loader2, Upload, ArrowRight } from 'lucide-react';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard';
import { getRelatedProductsByKeywords } from '@/services/supabaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { COMMON_ASSETS } from '@/constants';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ColdCakingHero } from './ColdCakingHero';
import { ColdCakingFAQ } from './ColdCakingFAQ';
import { ColdCakingCakePicker } from './ColdCakingCakePicker';
import { ColdCakingPhotoStep } from './ColdCakingPhotoStep';
import { ColdCakingCorporate } from './ColdCakingCorporate';

const ImageUploader = dynamic(
    () => import('@/components/ImageUploader').then((mod) => mod.ImageUploader),
    { ssr: false }
);

const CustomizingClient = dynamic(
    () => import('../customizing/CustomizingClient'),
    { ssr: false, loading: () => <div className="flex justify-center py-12"><LoadingSpinner /></div> }
);

const DEFAULT_CAKE_IMAGE_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/sign/cold-caking/Gemini_Generated_Image_4bvnuq4bvnuq4bvn.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84NDdlNTI3ZS1lZWU5LTRmM2EtODk3Ny05Y2RhMWUwZDUzNDEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjb2xkLWNha2luZy9HZW1pbmlfR2VuZXJhdGVkX0ltYWdlXzRidm51cTRidm51cTRidm4ucG5nIiwiaWF0IjoxNzc0NzM4MTU0LCJleHAiOjQ4OTY4MDIxNTR9.XiyRdgTAwitqtgC8mFa4L42dfHfzGcWwEM8Oz5g6lX4';

const DEFAULT_PREVIEW_IMAGE_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cold-caking/6in-1layer-cake.webp';

const relatedDesignBreakpoints = {
    default: 6,
    1536: 6,
    1280: 5,
    1024: 4,
    768: 3,
    490: 2,
    0: 2,
};

const navLinks = [
    { label: 'Browse Cakes', href: '/collections', emoji: '🎂' },
    { label: 'Our Bakers', href: '/shop', emoji: '🏪' },
    { label: 'Blog', href: '/blog', emoji: '📝' },
    { label: 'How to Order', href: '/how-to-order', emoji: '📋' },
    { label: 'About Us', href: '/about', emoji: 'ℹ️' },
    { label: 'Contact', href: '/contact', emoji: '📞' },
];

/** Convert a base64 string + mimeType to a File object */
function base64ToFile(base64Data: string, mimeType: string, fileName: string): File {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return new File([blob], fileName, { type: mimeType });
}

/** Fetch an image URL and return its base64 data + mimeType */
async function imageUrlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { data: base64, mimeType };
}

/** Convert a File to base64 */
function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the data:mime;base64, prefix
            const base64 = result.split(',')[1];
            resolve({ data: base64, mimeType: file.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const ColdCakingClient: React.FC = () => {
    const router = useRouter();
    const { isAuthenticated, user } = useAuth();
    const { itemCount } = useCart();
    const { clearImages, loadImageWithoutAnalysis } = useImageManagement();

    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showCompactHeader, setShowCompactHeader] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [relatedDesigns, setRelatedDesigns] = useState<ProductCardProps[]>([]);
    const [hasMoreDesigns, setHasMoreDesigns] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Cold caking specific state
    const [isCombining, setIsCombining] = useState(false);
    const [combineError, setCombineError] = useState<string | null>(null);
    const [showCustomizer, setShowCustomizer] = useState(true);
    const [hasUploadedPhoto, setHasUploadedPhoto] = useState(false);
    const [showApplyChanges, setShowApplyChanges] = useState(false);
    const [originalSizeIndex, setOriginalSizeIndex] = useState<number>(1);

    // Cache the base cake image base64 so we don't re-fetch every upload
    const baseCakeImageRef = useRef<{ data: string; mimeType: string } | null>(null);
    const currentSizeImageUrlRef = useRef<string>(DEFAULT_PREVIEW_IMAGE_URL);
    const uploadedImageRef = useRef<{ data: string; mimeType: string } | null>(null);
    const currentSizeIndexRef = useRef<number>(1);

    const handleSizeImageChange = useCallback((url: string, sizeIndex?: number) => {
        currentSizeImageUrlRef.current = url;
        baseCakeImageRef.current = null; // invalidate cache so next combine fetches the new size's image
        
        const newIndex = sizeIndex ?? 1;
        currentSizeIndexRef.current = newIndex;
        
        // Show apply changes button if user has uploaded a photo and changed to a different size
        if (hasUploadedPhoto && uploadedImageRef.current && newIndex !== originalSizeIndex) {
            setShowApplyChanges(true);
        } else if (newIndex === originalSizeIndex) {
            setShowApplyChanges(false);
        }
    }, [hasUploadedPhoto, originalSizeIndex]);

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        let ticking = false;
        const updateScrollState = () => {
            const currentScrollY = window.scrollY;
            const nextIsScrolled = currentScrollY > 20;
            const nextShowCompactHeader = currentScrollY > 50;
            setIsScrolled((prev) => prev === nextIsScrolled ? prev : nextIsScrolled);
            setShowCompactHeader((prev) => prev === nextShowCompactHeader ? prev : nextShowCompactHeader);
            ticking = false;
        };
        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateScrollState);
        };
        updateScrollState();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSearch = useCallback((query: string) => {
        router.push(`/search?q=${encodeURIComponent(query)}`);
    }, [router]);

    // Load default cake preview image on mount
    const hasLoadedDefaultImage = useRef(false);
    useEffect(() => {
        if (hasLoadedDefaultImage.current) return;
        hasLoadedDefaultImage.current = true;
        loadImageWithoutAnalysis(DEFAULT_PREVIEW_IMAGE_URL, {
            fileName: 'cold-caking-default.webp',
            fallbackMimeType: 'image/webp',
        }).catch(() => { /* silently handle */ });
    }, [loadImageWithoutAnalysis]);

    // Load edible photo cake designs on mount
    useEffect(() => {
        const fetchDesigns = async () => {
            const { data } = await getRelatedProductsByKeywords('edible photo cake', null, 6, 0);
            if (data && data.length > 0) {
                setRelatedDesigns(data);
                if (data.length < 6) setHasMoreDesigns(false);
            } else {
                setHasMoreDesigns(false);
            }
        };
        fetchDesigns();
    }, []);

    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || !hasMoreDesigns) return;
        setIsLoadingMore(true);
        try {
            const { data } = await getRelatedProductsByKeywords('edible photo cake', null, 6, relatedDesigns.length);
            if (data && data.length > 0) {
                setRelatedDesigns(prev => [...prev, ...data]);
                if (data.length < 6) setHasMoreDesigns(false);
            } else {
                setHasMoreDesigns(false);
            }
        } catch {
            // Silently handle
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMoreDesigns, relatedDesigns.length]);

    const handleImageSelect = useCallback(async (file: File) => {
        setIsUploaderOpen(false);
        setIsCombining(true);
        setCombineError(null);
        setShowCustomizer(true);
        setShowApplyChanges(false);
        setOriginalSizeIndex(currentSizeIndexRef.current); // Store original size when photo is uploaded

        // Scroll to customizer section
        setTimeout(() => {
            document.getElementById('coldcaking-customizer')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        try {
            // 1. Get the base cake image as base64 (cache it; invalidated when size changes)
            if (!baseCakeImageRef.current) {
                baseCakeImageRef.current = await imageUrlToBase64(currentSizeImageUrlRef.current);
            }

            // 2. Get the uploaded image as base64
            const overlayImage = await fileToBase64(file);
            uploadedImageRef.current = overlayImage; // Store for re-applying on size change

            // 3. Call Gemini to combine the images
            const response = await fetch('/api/ai/cold-cake-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseImage: baseCakeImageRef.current,
                    overlayImage,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to combine images' }));
                throw new Error(errorData.error || 'Failed to combine images');
            }

            const result = await response.json();

            // 4. Convert the Gemini result back to a File
            const combinedFile = base64ToFile(
                result.imageData,
                result.mimeType,
                'cold-cake-design.png'
            );

            // 5. Display the combined image in the customizer (no AI analysis)
            clearImages();
            const objectUrl = URL.createObjectURL(combinedFile);
            await loadImageWithoutAnalysis(objectUrl, {
                fileName: 'cold-cake-design.png',
                fallbackMimeType: combinedFile.type,
            });

            setIsCombining(false);
            setHasUploadedPhoto(true);
        } catch (error: any) {
            setIsCombining(false);
            setCombineError(error.message || 'Failed to create your cold cake design. Please try again.');
        }
    }, [clearImages, loadImageWithoutAnalysis]);

    const handleApplyChanges = useCallback(async () => {
        if (!uploadedImageRef.current || !baseCakeImageRef.current) return;
        
        setIsCombining(true);
        setCombineError(null);

        try {
            // Re-fetch the base cake image for the current size
            baseCakeImageRef.current = await imageUrlToBase64(currentSizeImageUrlRef.current);

            // Call Gemini to combine the images with the new base cake
            const response = await fetch('/api/ai/cold-cake-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseImage: baseCakeImageRef.current,
                    overlayImage: uploadedImageRef.current,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to combine images' }));
                throw new Error(errorData.error || 'Failed to combine images');
            }

            const result = await response.json();

            // Convert the Gemini result back to a File
            const combinedFile = base64ToFile(
                result.imageData,
                result.mimeType,
                'cold-cake-design.png'
            );

            // Display the combined image in the customizer (no AI analysis)
            clearImages();
            const objectUrl = URL.createObjectURL(combinedFile);
            await loadImageWithoutAnalysis(objectUrl, {
                fileName: 'cold-cake-design.png',
                fallbackMimeType: combinedFile.type,
            });

            setIsCombining(false);
            setShowApplyChanges(false);
        } catch (error: any) {
            setIsCombining(false);
            setCombineError(error.message || 'Failed to apply changes. Please try again.');
        }
    }, [clearImages, loadImageWithoutAnalysis]);

    return (
        <div className="flex flex-col min-h-screen w-full">
            {/* Trust Banner */}
            <div className="w-full bg-purple-600 py-[4.5px] flex justify-center items-center">
                <span className="inline-flex items-center text-white text-[10px] md:text-[11px] font-bold tracking-wider">
                    Place your order by 4PM for same-day delivery 💖
                </span>
            </div>

            {/* Header */}
            <nav className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    {/* Mobile Header */}
                    <div className="md:hidden relative w-full mb-4" style={{ height: '88px' }}>
                        {/* Layer 1: Not-scrolled — [menu | logo | icons] */}
                        <div
                            className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center pt-6 transition-opacity duration-300"
                            style={{ opacity: showCompactHeader ? 0 : 1, pointerEvents: showCompactHeader ? 'none' : 'auto' }}
                        >
                            <div className="flex items-center">
                                <button
                                    onClick={() => setIsMenuOpen(true)}
                                    className="p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                    aria-label="Open menu"
                                >
                                    <Menu size={24} />
                                </button>
                            </div>
                            <Link href="/">
                                <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={180} height={64} className="h-16 w-auto object-contain" />
                            </Link>
                            <div className="flex items-center gap-1 justify-end">
                                <button
                                    onClick={() => window.scrollTo({ top: 60, behavior: 'smooth' })}
                                    className="p-2 text-slate-600 hover:text-purple-700 transition-all shrink-0"
                                    aria-label="Search"
                                >
                                    <Search size={24} />
                                </button>
                                <button
                                    onClick={() => router.push('/cart')}
                                    className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                    aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                                >
                                    <ShoppingBag size={24} />
                                    {isMounted && itemCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                                            {itemCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Layer 2: Scrolled — [search bar | cart] */}
                        <div
                            className="absolute inset-0 flex items-center gap-2 pt-6 transition-opacity duration-300"
                            style={{ opacity: showCompactHeader ? 1 : 0, pointerEvents: showCompactHeader ? 'auto' : 'none' }}
                        >
                            {showCompactHeader ? (
                                <SearchAutocomplete
                                    onSearch={handleSearch}
                                    onUploadClick={() => setIsUploaderOpen(true)}
                                    placeholder="Search for custom cakes..."
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    className="flex-1 min-w-0"
                                    inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                                />
                            ) : <div className="flex-1 min-w-0" aria-hidden="true" />}
                            <button
                                onClick={() => router.push('/cart')}
                                className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                            >
                                <ShoppingBag size={24} />
                                {isMounted && itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                                        {itemCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Desktop Header: Menu + Logo + Search (left) | Nav + Icons (right) */}
                    <div className="hidden md:flex w-full items-center gap-6 py-4">
                        {/* Left: Menu + Logo + Search Bar */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label="Open menu"
                            >
                                <Menu size={24} />
                            </button>
                            <Link href="/" className="shrink-0">
                                <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={150} height={48} className="h-10 w-auto object-contain" />
                            </Link>
                            <SearchAutocomplete
                                onSearch={handleSearch}
                                onUploadClick={() => setIsUploaderOpen(true)}
                                placeholder="Search cakes..."
                                value={searchQuery}
                                onChange={setSearchQuery}
                                className="flex-1 max-w-sm ml-4"
                                inputClassName="w-full pl-5 pr-12 py-2.5 text-sm bg-white border-slate-200 border rounded-full shadow-sm focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>

                        {/* Right: Nav Links + Account + Cart */}
                        <div className="flex items-center gap-5 lg:gap-6 shrink-0">
                            <Link href="/collections" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Browse Cakes
                            </Link>
                            <Link href="/shop" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Our Bakers
                            </Link>
                            <Link href="/blog" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Blog
                            </Link>

                            <div className="w-px h-5 bg-gray-200" />
                            <button
                                onClick={() => router.push(isAuthenticated && !user?.is_anonymous ? '/account' : '/login')}
                                className="p-1.5 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label="Account"
                            >
                                <User size={22} />
                            </button>
                            <button
                                onClick={() => router.push('/cart')}
                                className="relative p-1.5 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                            >
                                <ShoppingBag size={22} />
                                {isMounted && itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                                        {itemCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1">
                <ColdCakingHero onUploadClick={() => setIsUploaderOpen(true)} />

                {/* Combine Error */}
                {combineError && (
                    <div className="w-full max-w-7xl mx-auto px-4 py-4">
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                            <p className="text-sm font-semibold text-red-700">{combineError}</p>
                            <button
                                onClick={() => { setCombineError(null); setIsUploaderOpen(true); }}
                                className="mt-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-full hover:bg-red-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Full Customizer — always mounted to preserve steps 1-4 state */}
                {showCustomizer && (
                    <div id="coldcaking-customizer" className="relative coldcaking-customizer-wrapper">
                        <style>{`
                            /* Hide the customizer's own header (back button, search bar, cart button) */
                            .coldcaking-customizer-wrapper > div:has(button[aria-label="Go back"]) {
                                display: none !important;
                            }
                            /* Hide the sr-only h1 title from customizer */
                            .coldcaking-customizer-wrapper > h1 {
                                display: none !important;
                            }
                            /* Hide About This section (CustomizingSupplementalContent) */
                            .coldcaking-customizer-wrapper div.w-full.mt-0:has(> .bg-white\\/70) {
                                display: none !important;
                            }
                            /* Hide Design Specifications + FAQ (CustomizingPostAnalysisContent) */
                            .coldcaking-customizer-wrapper > div > div.w-full.pb-4.pt-1.space-y-4 {
                                display: none !important;
                            }
                            /* Hide Discovery sections (trending designs + explore collections) */
                            .coldcaking-customizer-wrapper > div > div.w-full.pb-28 {
                                display: none !important;
                            }
                            /* Hide Guaranteed Price green pill */
                            .coldcaking-customizer-wrapper div[class*="bg-green-600"] {
                                display: none !important;
                            }
                            /* Hide Original/Customized tab switcher */
                            .coldcaking-customizer-wrapper div[class*="bg-slate-100"][class*="space-x-1"] {
                                display: none !important;
                            }
                            /* Hide the original Step 1 card (desktop — z-60 container first child) */
                            .coldcaking-customizer-wrapper .z-60 > div:first-child {
                                display: none !important;
                            }
                            /* Hide the original Step 1 card (mobile — snap-x + mt-0 container first child) */
                            .coldcaking-customizer-wrapper .snap-x.mt-0 > div:first-child {
                                display: none !important;
                            }
                            /* Hide 2 Tier and 3 Tier cake type options */
                            .coldcaking-customizer-wrapper button[data-caketype="2 Tier"],
                            .coldcaking-customizer-wrapper button[data-caketype="3 Tier"],
                            .coldcaking-customizer-wrapper button[data-caketype="2 Tier Fondant"],
                            .coldcaking-customizer-wrapper button[data-caketype="3 Tier Fondant"] {
                                display: none !important;
                            }
                            /* Hide the AI customization chat container (CustomizingMessagesPanel) */
                            .coldcaking-customizer-wrapper > div:has(div[class*="bg-slate-50"][class*="border"][class*="rounded-2xl"]),
                            .coldcaking-customizer-wrapper [class*="messages-panel"] {
                                display: none !important;
                            }
                            /* Ensure steps container shares same stacking context as image container */
                            .coldcaking-customizer-wrapper > div:has(> div[class*="flex"][class*="flex-col"]),
                            .coldcaking-customizer-wrapper .z-60 {
                                z-index: 10 !important;
                            }
                            /* Image container should be on same level as steps */
                            .coldcaking-customizer-wrapper div[class*="min-h-"][class*="rounded-2xl"] {
                                z-index: 10 !important;
                            }
                        `}</style>
                        {/* Step 1 picker — portals its card as first visible step */}
                        <ColdCakingCakePicker 
                            onSizeImageChange={handleSizeImageChange} 
                            showApplyChanges={showApplyChanges}
                            isCombining={isCombining}
                            onApplyChanges={handleApplyChanges}
                        />
                        {/* Step 3 photo upload — portals its card replacing Cake Toppers */}
                        <ColdCakingPhotoStep
                            onUploadClick={() => setIsUploaderOpen(true)}
                            hasPhoto={hasUploadedPhoto}
                        />
                        <CustomizingClient hideAiChat={true} isCombining={isCombining} clearMessageTexts={true} hideStickyBar={!hasUploadedPhoto} useBasePriceAsFallback={true} />
                    </div>
                )}

                <div className="w-full max-w-7xl mx-auto px-4 mt-6">
                    <ColdCakingCorporate />
                    <ColdCakingFAQ />
                </div>

                <div className="w-full bg-gradient-to-r from-purple-50 to-pink-50 py-16 mt-8">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
                            Have a different cake design in mind?
                        </h2>
                        <p className="text-lg text-slate-600 mb-8">
                            Upload a photo and we'll give you a price estimate in seconds!
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => {
                                    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                                    if (fileInput) fileInput.click();
                                }}
                                className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-full shadow-lg hover:bg-purple-700 transition-all"
                            >
                                Upload Your Design & Get Price in Seconds
                            </button>
                            <button
                                onClick={() => window.location.href = '/collections'}
                                className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all"
                            >
                                Browse Cakes Collections
                            </button>
                        </div>
                    </div>
                </div>

                {relatedDesigns.length > 0 && (
                    <div className="w-full max-w-7xl mx-auto px-4 pb-8">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Edible Photo Cake Designs</h2>
                        <Masonry
                            breakpointCols={relatedDesignBreakpoints}
                            className="flex w-auto -ml-3"
                            columnClassName="pl-3 bg-clip-padding"
                        >
                            {relatedDesigns.map((design, i) => (
                                <div key={`${design.slug}-${i}`} className="mb-3">
                                    <ProductCard {...design} backgroundOnly />
                                </div>
                            ))}
                        </Masonry>

                        {hasMoreDesigns && (
                            <div className="flex justify-center mt-2">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Show More Designs'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <LandingFooter />

            {/* Mobile Drawer Menu */}
            <div
                className={`fixed inset-0 z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
                style={{ background: 'rgba(0,0,0,0.45)' }}
            />
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="Side navigation"
            >
                <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-purple-50">
                    <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={140} height={50} className="h-12 w-auto object-contain" />
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="p-2 rounded-full text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        aria-label="Close menu"
                    >
                        <X size={22} />
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {navLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"
                        >
                            <span className="text-xl w-7 text-center leading-none">{item.emoji}</span>
                            <span className="group-hover:translate-x-0.5 transition-transform duration-150">{item.label}</span>
                        </Link>
                    ))}
                </nav>
                <div className="px-5 py-5 border-t border-purple-50">
                    <p className="text-xs text-gray-400 text-center">&copy; {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p>
                </div>
            </aside>

            <ImageUploader
                isOpen={isUploaderOpen}
                onClose={() => setIsUploaderOpen(false)}
                onImageSelect={handleImageSelect}
            />
        </div>
    );
};

export default ColdCakingClient;
