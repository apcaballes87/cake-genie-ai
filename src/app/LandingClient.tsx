'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';

import Link from 'next/link';
import { PopularDesigns } from '@/components/landing';
import type { PopularDesign } from '@/components/landing/PopularDesigns';

import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import LazyImage from '@/components/LazyImage';
import { ImageWithSkeleton } from '@/components/ImageWithSkeleton';
import { showError, showLoading, showInfo } from '@/lib/utils/toast';
import MobileBottomNav from '@/components/MobileBottomNav';
import { getSupabaseClient } from '@/lib/supabase/client';
import { BlogHomepagePreview } from '@/services/supabaseService';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { batchSaveToLocalStorage } from '@/contexts/CartContext';
import { COMMON_ASSETS } from '@/constants';
import {
    Search,
    ShoppingBag,
    Home,
    Heart,
    User,
    Cake,
    ImagePlus,
    Upload,
    Menu,
    Loader2,
    Camera,
    ArrowRight,
    ChevronDown,
    X
} from 'lucide-react';

const ImageUploader = dynamic(
    () => import('@/components/ImageUploader').then((mod) => mod.ImageUploader),
    { ssr: false }
);



interface LandingReview {
    review_id: string;
    rating: number;
    review_text: string | null;
    review_photos: string[] | null;
    reviewer_name: string | null;
    created_at: string;
    cakegenie_users: {
        first_name: string | null;
        last_name: string | null;
    }[];
    cakegenie_orders: {
        cakegenie_order_items: {
            cake_type: string | null;
            cake_size: string | null;
            customized_image_url: string | null;
        }[];
    }[];
}

interface LandingClientProps {
    children?: React.ReactNode;
    popularDesigns?: PopularDesign[];
    heroProducts?: PopularDesign[];
    blogPosts?: BlogHomepagePreview[];
    reviews?: LandingReview[];
}

const subscribeToHydration = () => () => { };

// ─── Interactive Customizer (landing page demo) ───────────────────────────────
interface TierOption { label: string; src: string; price: number; size: string; }
interface FlavorOption { label: string; src: string; }
interface IcingOption { label: string; src: string; addonPrice: number; }
interface TopperOption { label: string; emoji: string; }

interface InteractiveCustomizerProps {
    tiers: TierOption[];
    flavors: FlavorOption[];
    icings: IcingOption[];
    toppers: TopperOption[];
    onAddToCart: () => void;
}

const InteractiveCustomizer: React.FC<InteractiveCustomizerProps> = ({ tiers, flavors, icings, toppers, onAddToCart }) => {
    const [selectedTier, setSelectedTier] = useState(tiers[0].label);
    const [selectedFlavor, setSelectedFlavor] = useState(flavors[0].label);
    const [icingOn, setIcingOn] = useState<Record<string, boolean>>({ 'Body Icing': true, 'Drip': false, 'Base Border': true, 'Top Border': false });
    const [topperOn, setTopperOn] = useState<Record<string, boolean>>({});

    const tier = tiers.find(t => t.label === selectedTier)!;
    const icingAddon = icings.reduce((sum, i) => sum + (icingOn[i.label] ? i.addonPrice : 0), 0);
    const topperAddon = Object.values(topperOn).filter(Boolean).length * 100;
    const totalPrice = tier.price + icingAddon + topperAddon;

    const thumbCls = (active: boolean) =>
        `relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 cursor-pointer ${active ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white hover:border-purple-300'}`;
    const icingCls = (active: boolean) =>
        `w-12 h-12 p-2 rounded-full shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 ${active ? 'border-2 border-purple-600 bg-white/80' : 'border border-slate-200 bg-white/80 opacity-50 hover:opacity-80'}`;

    return (
        <div className="flex-1 w-full max-w-lg lg:max-w-none">
            <p className="text-xs font-bold text-purple-500 uppercase tracking-[0.15em] mb-4">
                Customize and Add to Cart
            </p>

            <div className="flex flex-col gap-2 mb-3">
                {/* Step 1: Tier + Flavor + Icing */}
                <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-3 px-1">Step 1: Choose Your Cake Specs</h3>

                    {/* Tier thumbnails */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1 mb-3">
                        {tiers.map((t) => (
                            <div key={t.label} className="shrink-0 w-16 flex flex-col items-center text-center" onClick={() => setSelectedTier(t.label)}>
                                <div className={thumbCls(selectedTier === t.label)}>
                                    <img src={t.src} alt={t.label} className="w-full h-full object-cover" />
                                </div>
                                <span className="mt-1.5 text-[10px] font-medium text-slate-700 leading-tight">{t.label}</span>
                            </div>
                        ))}
                        {/* Divider */}
                        <div className="w-px bg-slate-200 mx-1 self-stretch shrink-0" />
                        {/* Flavor thumbnails */}
                        {flavors.map((f) => (
                            <div key={f.label} className="shrink-0 w-16 flex flex-col items-center text-center" onClick={() => setSelectedFlavor(f.label)}>
                                <div className={thumbCls(selectedFlavor === f.label)}>
                                    <img src={f.src} alt={f.label} className="w-full h-full object-cover" />
                                </div>
                                <span className="mt-1.5 text-[10px] font-medium text-slate-700 leading-tight">{f.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Icing toggles */}
                    <div className="flex gap-3 flex-wrap px-1">
                        {icings.map((ic) => (
                            <div key={ic.label} className="flex flex-col items-center gap-1" onClick={() => setIcingOn(prev => ({ ...prev, [ic.label]: !prev[ic.label] }))}>
                                <div className={icingCls(!!icingOn[ic.label])}>
                                    <img src={ic.src} alt={ic.label} className="w-full h-full object-contain" />
                                </div>
                                <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">{ic.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step 2: Toppers */}
                <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-3 px-1">Step 2: Cake Toppers</h3>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1">
                        {toppers.map((tp) => (
                            <div key={tp.label} className="shrink-0 w-16 flex flex-col items-center text-center" onClick={() => setTopperOn(prev => ({ ...prev, [tp.label]: !prev[tp.label] }))}>
                                <div className={thumbCls(!!topperOn[tp.label])}>
                                    <div className="w-full h-full flex items-center justify-center text-2xl">{tp.emoji}</div>
                                </div>
                                <span className="mt-1.5 text-[10px] font-medium text-slate-700 leading-tight">{tp.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step 3: Cake Messages (static) */}
                <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 3: Cake Messages</h3>
                    <div className="flex items-center gap-3 py-2 px-4 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider shrink-0">TOP</span>
                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">Happy Birthday, Sarah! 🎉</span>
                        <div className="w-4 h-4 rounded-full bg-pink-400 border border-slate-200 shrink-0 shadow-sm" />
                    </div>
                </div>
            </div>

            {/* Add to Cart Bar */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <span className="text-lg font-bold text-slate-800">₱{totalPrice.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 block">{tier.size}</span>
                    </div>
                    <div className="flex gap-2 flex-1 justify-end">
                        <button className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 font-semibold py-3 px-4 rounded-xl text-sm shadow-sm">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                            Share
                        </button>
                        <button onClick={onAddToCart} className="flex items-center gap-1.5 bg-linear-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg whitespace-nowrap">
                            <ShoppingBag size={16} />
                            Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Separate component so useSearchParams doesn't block static prerendering
const DiscountCapture = () => {
    const searchParams = useSearchParams();
    const urlDiscount = searchParams.get('discount');

    useEffect(() => {
        if (urlDiscount) {
            const code = urlDiscount.toUpperCase();
            batchSaveToLocalStorage('cart_discount_code', code);
            showInfo(`Discount code ${code} saved! Add items to your cart to apply it.`);
        }
    }, [urlDiscount]);

    return null;
};

const LandingClient: React.FC<LandingClientProps> = ({ children, popularDesigns = [], heroProducts = [], blogPosts = [], reviews = [] }) => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('home');
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOccasionOpen, setIsOccasionOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [reviewZoomSrc, setReviewZoomSrc] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const uploadToastId = useRef<string | null>(null);
    const isMounted = React.useSyncExternalStore(subscribeToHydration, () => true, () => false);

    const { itemCount } = useCart();
    const { user, isAuthenticated } = useAuth();
    const { recordNavigation } = useNavigation();

    const categoriesList = [
        { id: 'Birthdays', name: 'Birthdays' },
        { id: 'Anniversaries', name: 'Anniversaries' },
        { id: 'Christmas Day', name: 'Christmas Day' },
        { id: 'New Year', name: 'New Year' },
        { id: 'Wedding', name: 'Wedding' },
        { id: 'Baptismal', name: 'Baptismal' },
    ];


    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (query: string) => {
        recordNavigation('search', 'home');
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

    const handleAppImageUpload = useCallback((file: File) => {
        if (isUploading) return;

        const uploadToSupabase = async () => {
            const supabase = getSupabaseClient();
            const ext = file.name.split('.').pop() || 'jpg';
            const filename = `customizations/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

            try {
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('cakegenie')
                    .upload(filename, file);

                if (uploadError) {
                    console.error('Upload failed:', uploadError);
                    showError('Failed to upload. Please try again.');
                    return null;
                }

                const { data: urlData } = supabase.storage
                    .from('cakegenie')
                    .getPublicUrl(uploadData.path);

                return urlData.publicUrl;
            } catch (err) {
                console.error('Upload catch error:', err);
                showError('Failed to upload. Please try again.');
                return null;
            }
        };

        const processUpload = async () => {
            setIsUploading(true);
            uploadToastId.current = showLoading('Uploading your design...');

            try {
                const publicUrl = await uploadToSupabase();

                if (publicUrl) {
                    const encodedUrl = encodeURIComponent(publicUrl);
                    // Clear stale image data before navigating so the customizing page
                    // doesn't briefly show a previously-uploaded image from IndexedDB.
                    const { clearIndexedDB } = await import('@/lib/utils/storage');
                    await clearIndexedDB();
                    router.push(`/customizing?ref=${encodedUrl}&source=landing`);
                }
            } finally {
                setIsUploading(false);
                if (uploadToastId.current) {
                    toast.dismiss(uploadToastId.current);
                    uploadToastId.current = null;
                }
            }
        };

        processUpload();
    }, [router, isUploading]);

    const [isScrolled, setIsScrolled] = useState(false);
    const [showCompactHeader, setShowCompactHeader] = useState(false);

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

    useEffect(() => {
        const setScroll = () => {
            if (reviewZoomSrc || isInteracting || !scrollRef.current) return;
            const container = scrollRef.current;
            container.scrollLeft += 0.5; // ~30px per second

            if (container.scrollLeft >= container.scrollWidth / 2) {
                container.scrollLeft = 0;
            }
        };

        let frameId: number;
        const animate = () => {
            setScroll();
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [reviewZoomSrc, isInteracting]);

    // Build review cards for marquee from actual reviews
    const reviewCards = useMemo(() => {
        const cards: {
            id: string;
            photo: string | null;
            rating: number;
            name: string;
            text: string | null;
            cakeType: string | null;
            cakeSize: string | null;
            date: string;
        }[] = [];
        for (const r of reviews) {
            if (!r.review_text) continue;
            const photos = r.review_photos?.length ? r.review_photos :
                r.cakegenie_orders?.[0]?.cakegenie_order_items
                    ?.map(item => item.customized_image_url)
                    .filter((url): url is string => !!url) || [];
            // Determine name: use reviewer_name for imported reviews, otherwise from user relation
            let name = r.reviewer_name || '';
            if (!name) {
                const user = r.cakegenie_users?.[0];
                const firstName = user?.first_name || '';
                const lastName = user?.last_name || '';
                name = firstName && lastName
                    ? `${firstName.charAt(0).toUpperCase()}. ${lastName}`
                    : firstName || 'Customer';
            }
            const orderItem = r.cakegenie_orders?.[0]?.cakegenie_order_items?.[0];
            cards.push({
                id: r.review_id,
                photo: photos.length > 0 ? photos[0] : null,
                rating: r.rating,
                name,
                text: r.review_text,
                cakeType: orderItem?.cake_type || null,
                cakeSize: orderItem?.cake_size || null,
                date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            });
        }
        if (cards.length === 0) return [];
        // Duplicate for seamless looping
        return [...cards, ...cards];
    }, [reviews]);

    const scrollThreshold = 50;

    useEffect(() => {
        if (reviewZoomSrc) {
            document.body.style.overflow = 'hidden';
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setReviewZoomSrc(null);
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleEsc);
            };
        }
    }, [reviewZoomSrc]);

    return (
        <div id="top" className="font-sans bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100 min-h-screen pb-24 md:pb-0 text-gray-800 flex flex-col">
            {/* Capture discount code from URL without blocking prerender */}
            <Suspense fallback={null}>
                <DiscountCapture />
            </Suspense>

            {/* ========== STATIC TRUST BANNER ========== */}
            <div className="w-full bg-purple-600 py-[4.5px] flex justify-center items-center">
                <span className="inline-flex items-center text-white text-[10px] md:text-[11px] font-bold tracking-wider">
                    Place your order by 4PM for same-day delivery 💖
                </span>
            </div>

            {/* ========== HEADER ========== */}
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
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={180}
                                    height={64}
                                    className="h-16 w-auto object-contain"
                                />
                            </Link>

                            <div className="flex items-center gap-1 justify-end">
                                <button
                                    onClick={() => window.scrollTo({ top: scrollThreshold + 10, behavior: 'smooth' })}
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
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={150}
                                    height={48}
                                    className="h-10 w-auto object-contain"
                                />
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
                            <Link href="/compare" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Compare
                            </Link>

                            <div className="w-px h-5 bg-gray-200" />
                            <button
                                onClick={() => {
                                    if (isAuthenticated && !user?.is_anonymous) {
                                        router.push('/account');
                                    } else {
                                        router.push('/login');
                                    }
                                }}
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

            {/* ========== MAIN CONTENT ========== */}
            <main className="flex-1">
                <h1 className="sr-only">Genie.ph | Best Custom Cakes in Cebu & Online Cake Delivery</h1>

                {/* ===== HERO SECTION ===== */}
                <section aria-label="Hero" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 pb-4 md:pt-6 md:pb-6 lg:pt-8 lg:pb-8">
                    <div className="flex flex-col md:flex-row gap-8 md:gap-12 lg:gap-16 items-start">
{/* Mobile Hero View */}
                        <div className="md:hidden w-full flex flex-col">
                            {/* Rating text above image */}
                            <Link href="/reviews" className="text-[10px] text-gray-600 mb-1.5 text-center w-full px-1 hover:text-purple-600">
                                4.8 <span className="text-yellow-500">★★★★★</span> based on 40 reviews. | <span className="text-green-600 font-bold">Verified ✓</span>
                            </Link>

                            {/* Image container with message overlay on the left */}
                            <div className="relative w-full rounded-3xl overflow-hidden mb-4 shadow-lg">
                                <ImageWithSkeleton
                                    src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP"
                                    alt="Hero"
                                    className="w-full h-auto block object-cover object-center"
                                    skeletonClassName="rounded-3xl"
                                    priority
                                />
                                <div className="absolute inset-0 p-5 flex flex-col justify-center w-[65%] max-[520px]:w-[85%]">
                                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-[0.15em] mb-2 flex whitespace-nowrap">
                                        Skip the &ldquo;HM?&rdquo; and &ldquo;PM SENT&rdquo;
                                    </p>
                                    <h2 className="text-[38px] max-[520px]:text-[32px] max-[414px]:text-[28px] font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-4 max-[520px]:mb-2">
                                        Custom cakes{' '}
                                        <br className="max-[414px]:hidden" />
                                        <span className="text-purple-600 italic">you can order</span>{' '}
                                        <br className="max-[414px]:hidden" />
                                        right now.
                                    </h2>
                                </div>
                            </div>

                            {/* Buttons under the image (1 line) */}
                            <div className="flex items-center gap-2 w-full">
                                <button
                                    disabled={isUploading}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/70 text-white px-4 py-3.5 rounded-full font-bold transition-all shadow-md active:scale-[0.98] text-[10px] min-[375px]:text-xs min-[414px]:text-[13px] disabled:cursor-not-allowed whitespace-nowrap"
                                    onClick={() => setIsUploaderOpen(true)}
                                >
                                    {isUploading ? (
                                        <Loader2 size={16} className="animate-spin shrink-0" />
                                    ) : (
                                        <Upload size={16} className="shrink-0" />
                                    )}
                                    {isUploading ? 'Uploading...' : 'Upload Your Design - Get Instant Pricing'}
                                </button>
                            </div>
                            {/* Mobile description below CTA button for small screens */}
                            <p className="hidden max-[454px]:block text-xs text-gray-700 leading-relaxed font-medium text-center mt-2">
                                Upload any cake photo. Get your price in seconds. Order it same day.
                            </p>
                            <p className="max-[454px]:hidden text-xs text-gray-700 leading-relaxed font-medium text-center mt-2">
                                Upload any cake photo. Get your price in seconds. Order it same day.
                            </p>
                        </div>

                        {/* Desktop Hero View: Image with text overlay */}
                        <div className="hidden md:block w-full relative rounded-3xl overflow-hidden shadow-lg">
                            <ImageWithSkeleton
                                src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP"
                                alt="Hero"
                                className="w-full h-auto block object-cover object-center"
                                skeletonClassName="rounded-3xl"
                                priority
                            />
                            <div className="absolute inset-0 p-10 lg:p-14 flex flex-col justify-center w-[55%] lg:w-[50%]">
                                <Link href="/reviews" className="text-[12px] lg:text-xs text-gray-600 mb-1 hover:text-purple-600">
                                    4.8 <span className="text-yellow-500">★★★★★</span> based on 40 reviews. | <span className="text-green-600 font-bold">Verified ✓</span>
                                </Link>
                                <p className="text-xs lg:text-sm font-bold text-purple-600 uppercase tracking-[0.15em] mb-3">
                                    Skip the &ldquo;HM?&rdquo; and &ldquo;PM SENT&rdquo;
                                </p>
                                <h2 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-5">
                                    Custom cakes
                                    <br />
                                    <span className="text-purple-600 italic">you can order</span>
                                    <br />
                                    right now.
                                </h2>
                                <div className="flex items-center gap-3">
                                    <button
                                        disabled={isUploading}
                                        className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/70 text-white px-6 py-3.5 lg:px-8 lg:py-4 rounded-full font-bold transition-all shadow-lg active:scale-[0.98] text-sm lg:text-base whitespace-nowrap disabled:cursor-not-allowed"
                                        onClick={() => setIsUploaderOpen(true)}
                                    >
                                        {isUploading ? (
                                            <Loader2 size={15} className="animate-spin shrink-0" />
                                        ) : (
                                            <Upload size={15} className="shrink-0" />
                                        )}
                                        {isUploading ? 'Uploading...' : 'Upload Your Design - Get Instant Pricing'}
                                        <ArrowRight size={14} className="shrink-0" />
                                    </button>
                                </div>
                                <p className="text-sm lg:text-base text-gray-700 leading-relaxed mt-4">
                                    Upload any cake photo. Get your price in seconds. Order it same day.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>


                {/* ===== REVIEWS MARQUEE ===== */}
                {reviewCards.length > 0 && (
                <section aria-label="Customer reviews" className="w-full overflow-hidden py-2 md:py-4">
                    <div className="relative group">
                        <div
                            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 md:w-24"
                            style={{ background: 'linear-gradient(to right, rgba(250,245,255,1), transparent)' }}
                        />
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 md:w-24"
                            style={{ background: 'linear-gradient(to left, rgba(240,238,255,1), transparent)' }}
                        />
                        <div
                            ref={scrollRef}
                            className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide py-2"
                            onMouseDown={() => setIsInteracting(true)}
                            onMouseUp={() => setIsInteracting(false)}
                            onMouseLeave={() => setIsInteracting(false)}
                            onTouchStart={() => setIsInteracting(true)}
                            onTouchEnd={() => setIsInteracting(false)}
                        >
                            <div className="flex gap-3 md:gap-4 min-w-max pr-3 md:pr-4">
                            {reviewCards.map((card, i) => (
                                <div
                                    key={`${card.id}-${i}`}
                                    className={`shrink-0 w-[294px] md:w-[343px] bg-white rounded-xl shadow-md p-2.5 md:p-3 transition-shadow ${card.photo ? 'cursor-pointer hover:shadow-lg' : ''}`}
                                    onClick={() => card.photo && setReviewZoomSrc(card.photo)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Review by ${card.name}`}
                                    onKeyDown={(e) => e.key === 'Enter' && card.photo && setReviewZoomSrc(card.photo)}
                                >
                                    {/* Row 1: Stars + Name */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex gap-px">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <span key={star} className={`text-xs ${star <= card.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                                            ))}
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-600 truncate ml-2">{card.name}</span>
                                    </div>
                                    {/* Row 2: Image thumbnail (left) + Review snippet (right) */}
                                    <div className="flex gap-2">
                                        {card.photo && (
                                            <div className="relative w-10 h-10 md:w-[47px] md:h-[47px] flex-shrink-0 overflow-hidden rounded-md border border-slate-200">
                                                <ImageWithSkeleton
                                                    src={card.photo}
                                                    alt={card.cakeType ? `${card.cakeType} Cake` : 'Cake'}
                                                    className="w-full h-full object-cover"
                                                    skeletonClassName="rounded-md"
                                                    priority
                                                />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            {card.cakeType && <p className="text-[10px] font-semibold text-slate-800 truncate mb-0.5">{card.cakeType} Cake{card.cakeSize ? ` · ${card.cakeSize}` : ''}</p>}
                                            {card.text && (
                                                <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2 whitespace-normal">{card.text}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    </div>
                </section>
                )}

                {/* ===== SEE A CAKE YOU LOVE SECTION ===== */}
                <section aria-label="AI-powered instant pricing" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-6 md:pt-8 md:pb-8 lg:pt-10 lg:pb-10">
                    <div className="flex flex-col lg:flex-row gap-8 md:gap-12 lg:gap-16 items-start">
                        {/* Left: Text + Upload Zone */}
                        <div className="flex-1">

                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-4">
                                Your design. Your price. Updated instantly. <span className="text-purple-600">Same-day Delivery.</span>
                            </h2>

                            {/* Upload Drop Zone */}
                            <div
                                className="border-2 border-dashed border-purple-300 bg-purple-50/50 rounded-2xl p-6 md:p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all"
                                onClick={() => setIsUploaderOpen(true)}
                            >
                                <div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Camera size={22} className="text-purple-500" />
                                </div>
                                <p className="text-sm font-semibold text-gray-800 mb-1">Drop your cake photo here</p>
                                <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                            </div>
                        </div>

                        {/* Right: Interactive Customizer Preview */}
                        {(() => {
                            const TIERS = [
                                { label: '1 Tier', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/1tier.webp', price: 1500, size: '8" Round 4 in height' },
                                { label: '2 Tier', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/2tier.webp', price: 2500, size: '6"9" 4 in height per tier' },
                                { label: 'Bento', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/bento.webp', price: 399, size: '4" Round 2 in height' },
                            ];
                            const FLAVORS = [
                                { label: 'Vanilla', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakevanilla.webp' },
                                { label: 'Chocolate', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakechocolate.webp' },
                                { label: 'Ube', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakeube.webp' },
                            ];
                            const ICINGS = [
                                { label: 'Body Icing', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/icing_white.webp', addonPrice: 0 },
                                { label: 'Drip', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/drip_white.webp', addonPrice: 100 },
                                { label: 'Base Border', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/baseborder_white.webp', addonPrice: 0 },
                                { label: 'Top Border', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/top_white.webp', addonPrice: 0 },
                            ];
                            const TOPPERS = [
                                { label: 'Sugar Flowers', emoji: '🌸' },
                                { label: 'Number', emoji: '🔢' },
                                { label: 'Sprinkles', emoji: '✨' },
                                { label: 'Macaron', emoji: '🍪' },
                            ];
                            return <InteractiveCustomizer tiers={TIERS} flavors={FLAVORS} icings={ICINGS} toppers={TOPPERS} onAddToCart={() => setIsUploaderOpen(true)} />;
                        })()}
                    </div>
                </section>

                {/* ===== MINIMALIST CAKES FOR RUSH ORDERS ===== */}
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                    <section aria-label="Popular designs" className="py-2 md:py-3">
                        <PopularDesigns designs={popularDesigns} />
                    </section>
                </div>

                {/* ===== RECENT SEARCHES + WHAT IS GENIE.PH (Server-rendered children) ===== */}
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                    {children}
                </div>

                {/* ===== BLOG SECTION ===== */}
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                    <section aria-label="Blog" className="py-8 md:py-12">
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Stories, Blogs and News</h2>
                            <Link href="/blog" className="group flex items-center gap-1 md:gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors text-[13px] md:text-base shrink-0">
                                View all
                                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                        <div className="space-y-4">
                            {blogPosts.length === 0 ? (
                                <p className="text-gray-500 text-sm">No blog posts available yet.</p>
                            ) : (
                                blogPosts.map((post) => {
                                    const imageUrl = post.image;
                                    return (
                                        <article key={post.slug}>
                                            <Link
                                                href={`/blog/${post.slug}`}
                                                className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-purple-100 hover:shadow-md hover:border-purple-200 transition-all group flex gap-4 items-center justify-between"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors leading-snug">
                                                        {post.title}
                                                    </h3>
                                                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                                                        {post.excerpt}
                                                    </p>
                                                </div>
                                                {imageUrl && (
                                                    <div className="shrink-0 w-20 h-20 md:w-28 md:h-28 rounded-xl overflow-hidden shadow-sm relative">
                                                        <LazyImage
                                                            src={imageUrl}
                                                            alt={post.title}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    </div>
                                                )}
                                            </Link>
                                        </article>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>
            </main>

            {/* ========== MOBILE BOTTOM NAV ========== */}
            <MobileBottomNav onUploadClick={() => setIsUploaderOpen(true)} />

            {isUploaderOpen ? (
                <ImageUploader
                    isOpen={isUploaderOpen}
                    onClose={() => setIsUploaderOpen(false)}
                    onImageSelect={(file) => {
                        handleAppImageUpload(file);
                        setIsUploaderOpen(false);
                    }}
                />
            ) : null}

            {/* ========== REVIEW ZOOM MODAL ========== */}
            {reviewZoomSrc && (
                <div 
                    className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
                    role="dialog"
                    aria-modal="true"
                >
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setReviewZoomSrc(null)}
                    />
                    <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setReviewZoomSrc(null)}
                            className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
                            aria-label="Close zoom"
                        >
                            <X size={32} />
                        </button>
                        <img
                            src={reviewZoomSrc}
                            alt="Zoomed customer review"
                            className="w-full h-full object-contain rounded-2xl shadow-2xl"
                        />
                    </div>
                </div>
            )}

            {/* ========== MOBILE SIDE MENU DRAWER ========== */}
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
                style={{ background: 'rgba(0,0,0,0.45)' }}
            />

            {/* Drawer Panel */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="Side navigation"
            >
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-purple-50">
                    <img
                        src={COMMON_ASSETS.logo}
                        alt="Genie Logo"
                        width={140}
                        height={50}
                        className="h-12 w-auto object-contain"
                    />
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="p-2 rounded-full text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        aria-label="Close menu"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {/* Browse Cakes */}
                    <Link
                        href="/collections"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"
                    >
                        <span className="text-xl w-7 text-center leading-none">🎂</span>
                        <span className="group-hover:translate-x-0.5 transition-transform duration-150">Browse Cakes</span>
                    </Link>

                    {/* Shop by Occasion — collapsible accordion */}
                    <div>
                        <button
                            onClick={() => setIsOccasionOpen(prev => !prev)}
                            className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px]"
                            aria-expanded={isOccasionOpen}
                        >
                            <span className="text-xl w-7 text-center leading-none">🎉</span>
                            <span className="flex-1 text-left">Shop by Occasion</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width={16} height={16}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`transition-transform duration-300 ${isOccasionOpen ? 'rotate-180' : 'rotate-0'}`}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        <div
                            className="overflow-hidden transition-all duration-300 ease-in-out"
                            style={{ maxHeight: isOccasionOpen ? `${categoriesList.length * 52}px` : '0px' }}
                        >
                            <div className="pl-10 pb-1 flex flex-col gap-0.5">
                                {categoriesList.map((cat) => (
                                    <Link
                                        key={cat.id}
                                        href={`/search?q=${encodeURIComponent(cat.name)}`}
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors text-[14px] font-medium"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300 shrink-0" />
                                        {cat.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Other nav links */}
                    {[
                        { label: 'Cold Caking', href: '/coldcaking', emoji: '🧊' },
                        { label: 'Our Bakers', href: '/shop', emoji: '🏪' },
                        { label: 'Compare Cakes', href: '/compare', emoji: '⚖️' },
                        { label: 'How to Order', href: '/how-to-order', emoji: '📋' },
                        { label: 'Payment Options', href: '/payment-options', emoji: '💳' },
                        { label: 'Delivery Rates', href: '/delivery-rates', emoji: '🚚' },
                        { label: 'About Us', href: '/about', emoji: 'ℹ️' },
                        { label: 'Contact', href: '/contact', emoji: '📞' },
                    ].map((item) => (
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

                {/* Drawer Footer */}
                <div className="px-5 py-5 border-t border-purple-50">
                    <p className="text-xs text-gray-400 text-center">&copy; {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p>
                </div>
            </aside>
        </div>
    );
};

export default LandingClient;
