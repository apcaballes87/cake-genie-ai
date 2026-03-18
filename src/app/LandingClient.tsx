'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';

import Link from 'next/link';
import { PopularDesigns } from '@/components/landing';
import type { PopularDesign } from '@/components/landing/PopularDesigns';

import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import LazyImage from '@/components/LazyImage';
import { showError, showLoading, showInfo } from '@/lib/utils/toast';
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
    ChevronDown
} from 'lucide-react';

const ImageUploader = dynamic(
    () => import('@/components/ImageUploader').then((mod) => mod.ImageUploader),
    { ssr: false }
);


const trustBadges = [
    'METRO CEBU DELIVERY',
    '4.8★ CUSTOMER RATED',
    'CUSTOM CAKES',
    'INSTANT AI PRICING',
    '50+ TRUSTED BAKERS',
    'SAME-DAY RUSH ORDERS',
];

interface LandingClientProps {
    children?: React.ReactNode;
    popularDesigns?: PopularDesign[];
    heroProducts?: PopularDesign[];
    blogPosts?: BlogHomepagePreview[];
}

const subscribeToHydration = () => () => { };

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

const LandingClient: React.FC<LandingClientProps> = ({ children, popularDesigns = [], heroProducts = [], blogPosts = [] }) => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('home');
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOccasionOpen, setIsOccasionOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
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

    const scrollThreshold = 50;

    return (
        <div id="top" className="font-sans bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100 min-h-screen pb-24 md:pb-0 text-gray-800 flex flex-col">
            {/* Capture discount code from URL without blocking prerender */}
            <Suspense fallback={null}>
                <DiscountCapture />
            </Suspense>

            {/* ========== TRUST BANNER MARQUEE ========== */}
            <div className="w-full overflow-hidden bg-purple-600 py-[4.5px]">
                <style jsx>{`
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .trust-marquee {
                        animation: marquee 25s linear infinite;
                    }
                `}</style>
                <div className="trust-marquee flex whitespace-nowrap">
                    {[...trustBadges, ...trustBadges].map((badge, i) => (
                        <span key={i} className="inline-flex items-center text-white text-[9px] md:text-[10px] font-bold tracking-wider mx-6 md:mx-10">
                            {badge}
                            <span className="ml-6 md:ml-10 text-purple-300">&#9830;</span>
                        </span>
                    ))}
                </div>
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

                    {/* Desktop Header: Logo + Search (left) | Nav + Icons (right) */}
                    <div className="hidden md:flex w-full items-center gap-6 py-4">
                        {/* Left: Logo + Search Bar (search grows to fill space) */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
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
                                className="flex-1 max-w-sm"
                                inputClassName="w-full pl-5 pr-12 py-2.5 text-sm bg-white border-slate-200 border rounded-full shadow-sm focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>

                        {/* Right: Nav Links + Account + Cart */}
                        <div className="flex items-center gap-5 lg:gap-6 shrink-0">
                            <Link href="/search?q=cakes" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Browse Cakes
                            </Link>
                            <Link href="/collections" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Collections
                            </Link>
                            <Link href="/shop" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Our Bakers
                            </Link>
                            <Link href="/blog" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Blog
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
                    <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-start">
                        {/* Left: Text Content */}
                        <div className="w-full md:flex-1 text-center md:text-left md:pt-2 lg:pt-4">
                            <p className="text-xs md:text-sm font-bold text-purple-600 uppercase tracking-[0.2em] mb-4 flex items-center justify-center md:justify-start gap-2">
                                <span className="hidden md:inline-block w-8 h-[2px] bg-purple-400"></span>
                                Cebu&apos;s Premier Cake Marketplace
                            </p>
                            <h2 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-5 md:mb-6">
                                Custom cakes
                                <br />
                                <span className="text-purple-600 italic">you can order</span>
                                <br />
                                right now.
                            </h2>
                            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-8 max-w-lg mx-auto md:mx-0">
                                Upload any cake photo. Our AI analyzes the design and gives you an accurate price quote in under 10 seconds. Add to cart and order today — no &ldquo;HM?&rdquo;, no &ldquo;PM SENT&rdquo;, no waiting.
                            </p>
                            <div className="flex items-center gap-2 sm:gap-3 justify-center md:justify-start">
                                <button
                                    disabled={isUploading}
                                    className="flex items-center justify-center gap-1.5 sm:gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/70 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 lg:px-8 lg:py-4 rounded-full font-semibold transition-all shadow-lg active:scale-[0.98] text-xs sm:text-sm lg:text-base whitespace-nowrap disabled:cursor-not-allowed"
                                    onClick={() => setIsUploaderOpen(true)}
                                >
                                    {isUploading ? (
                                        <Loader2 size={15} className="animate-spin shrink-0" />
                                    ) : (
                                        <Upload size={15} className="shrink-0" />
                                    )}
                                    {isUploading ? 'Uploading...' : 'Upload Your Design'}
                                    <ArrowRight size={14} className="shrink-0" />
                                </button>
                                <Link
                                    href="/collections"
                                    className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 px-4 py-2.5 sm:px-6 sm:py-3.5 lg:px-8 lg:py-4 rounded-full font-semibold transition-all active:scale-[0.98] text-xs sm:text-sm lg:text-base whitespace-nowrap"
                                >
                                    Browse Designs
                                    <ChevronDown size={14} className="shrink-0" />
                                </Link>
                            </div>
                        </div>

                        {/* Right: Hero Masonry Image Grid */}
                        {heroProducts.length >= 4 && (
                            <div className="flex-1 w-full max-w-xl md:max-w-none">
                                <div className="flex gap-3 md:gap-4">
                                    {/* Column 1: 2 images */}
                                    <div className="flex flex-col gap-3 md:gap-4 flex-1">
                                        <Link href={`/customizing/${heroProducts[0].slug}`} className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-md aspect-[3/4] group block">
                                            <LazyImage
                                                src={heroProducts[0].original_image_url}
                                                alt={heroProducts[0].alt_text || heroProducts[0].keywords || 'Minimalist cake'}
                                                fill
                                                priority
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                        </Link>
                                        <Link href={`/customizing/${heroProducts[2].slug}`} className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-md aspect-[4/3] group block">
                                            <LazyImage
                                                src={heroProducts[2].original_image_url}
                                                alt={heroProducts[2].alt_text || heroProducts[2].keywords || 'Minimalist cake'}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                        </Link>
                                    </div>
                                    {/* Column 2: 2 images */}
                                    <div className="flex flex-col gap-3 md:gap-4 flex-1">
                                        <Link href={`/customizing/${heroProducts[1].slug}`} className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-md aspect-[4/3] group block">
                                            <LazyImage
                                                src={heroProducts[1].original_image_url}
                                                alt={heroProducts[1].alt_text || heroProducts[1].keywords || 'Minimalist cake'}
                                                fill
                                                priority
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                        </Link>
                                        <Link href={`/customizing/${heroProducts[3].slug}`} className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-md aspect-[3/4] group block">
                                            <LazyImage
                                                src={heroProducts[3].original_image_url}
                                                alt={heroProducts[3].alt_text || heroProducts[3].keywords || 'Minimalist cake'}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>


                {/* ===== SEE A CAKE YOU LOVE SECTION ===== */}
                <section aria-label="AI-powered instant pricing" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-6 md:pt-8 md:pb-8 lg:pt-10 lg:pb-10">
                    <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
                        {/* Left: Text + Upload Zone */}
                        <div className="flex-1">
                            <p className="text-xs md:text-sm font-bold text-purple-600 uppercase tracking-[0.15em] mb-3">
                                AI-Powered Instant Pricing
                            </p>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-4">
                                See a cake you love? We&apos;ll price it for you, in 10 seconds.
                            </h2>
                            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-8 max-w-xl">
                                Found the perfect inspo on Pinterest or Instagram? Just upload the screenshot. Our AI reads the design and gives you a real price from real local cakeshops. Customize by changing the icing colors, add toppers and messages. Add to cart once you&apos;re done. Easy. Fast. Convenient.
                            </p>

                            {/* Upload Drop Zone */}
                            <div
                                className="border-2 border-dashed border-purple-300 bg-purple-50/50 rounded-2xl p-8 md:p-10 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all"
                                onClick={() => setIsUploaderOpen(true)}
                            >
                                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Camera size={28} className="text-purple-500" />
                                </div>
                                <p className="text-base font-semibold text-gray-800 mb-1">Drop your cake photo here</p>
                                <p className="text-sm text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                            </div>
                        </div>

                        {/* Right: Customizing Page Preview Mock */}
                        <div className="flex-1 w-full max-w-lg lg:max-w-none">
                            <p className="text-xs font-bold text-purple-500 uppercase tracking-[0.15em] mb-4">
                                Customize and Add to Cart
                            </p>

                            {/* Mock of the actual customizing page — Step cards + Add to Cart bar */}

                            {/* Step Cards — no outer wrapper */}
                            <div className="flex flex-col gap-2 mb-3">

                                {/* Step 1: Cake Specs + Icing Colors */}
                                <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-slate-200">
                                    <h3 className="text-[13px] font-semibold text-slate-800 mb-3 px-1">Step 1: Choose Your Cake Specs</h3>
                                    {/* Cake spec thumbnails — same style as customizing page */}
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1 mb-3">
                                        {[
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/1tier.webp', label: '1 Tier', selected: true },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/2tier.webp', label: '2 Tier', selected: false },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/bento.webp', label: 'Bento', selected: false },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakevanilla.webp', label: 'Vanilla', selected: true },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakechocolate.webp', label: 'Chocolate', selected: false },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakeube.webp', label: 'Ube', selected: false },
                                        ].map((item) => (
                                            <div key={item.label} className="shrink-0 w-16 flex flex-col items-center text-center">
                                                <div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${item.selected ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white'}`}>
                                                    <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="mt-1.5 text-[10px] font-medium text-slate-700 leading-tight">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Icing toolbar — same round button style as customizing page */}
                                    <div className="flex gap-3 flex-wrap px-1">
                                        {[
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/icing_white.webp', label: 'Body Icing', active: true },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/drip_white.webp', label: 'Drip', active: false },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/baseborder_white.webp', label: 'Base Border', active: true },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/top_white.webp', label: 'Top Border', active: false },
                                        ].map((item) => (
                                            <div key={item.label} className="flex flex-col items-center gap-1">
                                                <div className={`w-12 h-12 p-2 rounded-full shadow-md flex items-center justify-center ${item.active ? 'border-2 border-purple-600 bg-white/80' : 'border border-slate-200 bg-white/80 opacity-60'}`}>
                                                    <img src={item.src} alt={item.label} className="w-full h-full object-contain" />
                                                </div>
                                                <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Step 2: Cake Toppers */}
                                <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-slate-200">
                                    <h3 className="text-[13px] font-semibold text-slate-800 mb-3 px-1">Step 2: Cake Toppers</h3>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1">
                                        {[
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/toppers/sugarflowers.webp', label: 'Sugar Flowers', selected: true },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/toppers/numbercandles.webp', label: 'Number', selected: false },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/toppers/sprinkles.webp', label: 'Sprinkles', selected: false },
                                            { src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/toppers/macaron.webp', label: 'Macaron', selected: false },
                                        ].map((item) => (
                                            <div key={item.label} className="shrink-0 w-16 flex flex-col items-center text-center">
                                                <div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${item.selected ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white'}`}>
                                                    <img src={item.src} alt={item.label} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    <div className="absolute inset-0 flex items-center justify-center text-2xl">{item.label === 'Sugar Flowers' ? '🌸' : item.label === 'Number' ? '🔢' : item.label === 'Sprinkles' ? '✨' : '🍪'}</div>
                                                </div>
                                                <span className="mt-1.5 text-[10px] font-medium text-slate-700 leading-tight">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Step 3: Cake Messages */}
                                <div className="bg-white/70 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-slate-200">
                                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 3: Cake Messages</h3>
                                    <div className="flex items-center gap-3 py-2 px-4 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider shrink-0">TOP</span>
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">Happy Birthday, Sarah! 🎉</span>
                                        <div className="w-4 h-4 rounded-full bg-pink-400 border border-slate-200 shrink-0 shadow-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Mock Add to Cart Bar — its own container */}
                            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 px-4 py-4">
                                {/* Rush availability banner */}
                                {/* Price + Buttons */}
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="text-lg font-bold text-slate-800">₱1,500</span>
                                        <span className="text-xs text-slate-500 block">8&quot; Round Standard Height</span>
                                    </div>
                                    <div className="flex gap-2 flex-1 justify-end">
                                        <button className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 font-semibold py-3 px-4 rounded-xl text-sm shadow-sm">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                                            Share
                                        </button>
                                        <button className="flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg whitespace-nowrap">
                                            <ShoppingBag size={16} />
                                            Add to Cart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
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
            <nav className="md:hidden fixed bottom-0 w-full bg-white/95 backdrop-blur-lg border-t border-gray-100 py-4 px-6 flex justify-between items-center text-gray-500 z-50 pb-safe">
                <button
                    onClick={() => { setActiveTab('home'); router.push('/'); }}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-purple-600' : 'hover:text-purple-400'}`}
                >
                    <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Home</span>
                </button>

                <button
                    onClick={() => { setActiveTab('customize'); router.push('/customizing'); }}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'customize' ? 'text-purple-600' : 'hover:text-purple-400'}`}
                >
                    <Cake size={22} strokeWidth={activeTab === 'customize' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Customize</span>
                </button>

                <button
                    onClick={() => { setActiveTab('getprice'); setIsUploaderOpen(true); }}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'getprice' ? 'text-purple-600' : 'hover:text-purple-400'}`}
                >
                    <ImagePlus size={22} strokeWidth={activeTab === 'getprice' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Get Price</span>
                </button>

                <button
                    onClick={() => { setActiveTab('wishlist'); router.push('/saved'); }}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'wishlist' ? 'text-purple-600' : 'hover:text-purple-400'}`}
                >
                    <Heart size={22} strokeWidth={activeTab === 'wishlist' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Saved</span>
                </button>

                <button
                    onClick={() => { setActiveTab('profile'); router.push(isAuthenticated && !user?.is_anonymous ? '/account' : '/login'); }}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-purple-600' : 'hover:text-purple-400'}`}
                >
                    <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold">Profile</span>
                </button>
            </nav>

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
                        href="/search?q=cakes"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"
                    >
                        <span className="text-xl w-7 text-center leading-none">🎂</span>
                        <span className="group-hover:translate-x-0.5 transition-transform duration-150">Browse Cakes</span>
                    </Link>

                    {/* Collections */}
                    <Link
                        href="/collections"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"
                    >
                        <span className="text-xl w-7 text-center leading-none">🎨</span>
                        <span className="group-hover:translate-x-0.5 transition-transform duration-150">Collections</span>
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
                        { label: 'Our Bakers', href: '/shop', emoji: '🏪' },
                        { label: 'Blog', href: '/blog', emoji: '📝' },
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
