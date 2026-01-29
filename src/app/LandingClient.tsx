'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import LazyImage from '@/components/LazyImage';
import type { CakeGenieMerchant } from '@/lib/database.types';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { ImageUploader } from '@/components/ImageUploader';
import { showError, showSuccess, showLoading } from '@/lib/utils/toast';
import { toast } from 'react-hot-toast';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedItemsActions, useSavedItemsData } from '@/contexts/SavedItemsContext';
import { LANDING_PAGE_IMAGES, COMMON_ASSETS } from '@/constants';
import {
    Search,
    ShoppingBag,
    Home,
    Heart,
    User,
    Plus,
    Star,
    MapPin,

    Package,
    Camera,
    Cake,
    ImagePlus,
    Tag,
    CreditCard,
    Facebook,
    Instagram,
    Youtube,
    MessageCircle,
    Check,
    ChevronUp,
    Mail,
    Phone,
    Twitter
} from 'lucide-react';

const quickLinks = [
    {
        name: 'Minimalist Cakes',
        imageUrls: LANDING_PAGE_IMAGES.minimalist,
        searchTerm: 'minimalist cakes'
    },
    {
        name: 'Edible Photo',
        imageUrls: LANDING_PAGE_IMAGES.ediblePhoto,
        searchTerm: 'edible photo cakes'
    },
    {
        name: 'Bento Cakes',
        imageUrls: LANDING_PAGE_IMAGES.bento,
        searchTerm: 'bento cakes'
    }
];

const occasionLinks = [
    { label: 'Birthday Cakes', slug: 'birthday' },
    { label: 'Wedding Cakes', slug: 'wedding' },
    { label: 'Graduation Cakes', slug: 'graduation' },
    { label: 'Anniversary Cakes', slug: 'anniversary' },
    { label: 'Christening Cakes', slug: 'christening' },
];

const LandingClient: React.FC = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('home');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
    const [imageIndex, setImageIndex] = useState(0);
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);


    // Context hooks
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { itemCount } = useCart();
    const { user, isAuthenticated, signOut } = useAuth();
    const { handleImageUpload: hookImageUpload, clearImages } = useImageManagement();
    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization
    } = useCakeCustomization();

    const { toggleSaveDesign, isDesignSaved } = useSavedItemsActions();
    const { savedDesignHashes } = useSavedItemsData();

    const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Merchant showcase state
    const [merchants, setMerchants] = useState<CakeGenieMerchant[]>([]);
    const [isLoadingMerchants, setIsLoadingMerchants] = useState(true);

    const fetchRecommendedProducts = useCallback(async (currentOffset: number) => {
        try {
            // Dynamically import to avoid server-side issues if any (though this is a client component)
            const { getRecommendedProducts } = await import('@/services/supabaseService');
            const { data, error } = await getRecommendedProducts(8, currentOffset);

            if (data) {
                if (currentOffset === 0) {
                    setRecommendedProducts(data);
                } else {
                    setRecommendedProducts(prev => [...prev, ...data]);
                }

                if (data.length < 8) {
                    setHasMore(false);
                }
            } else {
                console.error("Failed to load recommended products:", error);
            }
        } catch (err) {
            console.error("Error loading recommended products:", err);
        } finally {
            setIsLoadingProducts(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchRecommendedProducts(0);
    }, [fetchRecommendedProducts]);

    // Fetch merchants on mount
    useEffect(() => {
        const fetchMerchants = async () => {
            try {
                const { getMerchants } = await import('@/services/supabaseService');
                const { data, error } = await getMerchants();
                if (data && !error) {
                    setMerchants(data);
                }
            } catch (err) {
                console.error('Error loading merchants:', err);
            } finally {
                setIsLoadingMerchants(false);
            }
        };
        fetchMerchants();
    }, []);

    const handleLoadMore = () => {
        const nextOffset = offset + 8;
        setOffset(nextOffset);
        setIsLoadingMore(true);
        fetchRecommendedProducts(nextOffset);
    };


    const handleRecommendedProductClick = async (e: React.MouseEvent | React.TouchEvent, item: any) => {
        // Prevent if we clicked the heart button or any of its children
        if ((e.target as HTMLElement).closest('button.save-heart-button')) {
            return;
        }

        if (!item.original_image_url) return;

        // If item has a slug, navigate directly to the SEO-friendly URL
        // The page component will handle loading with SSR metadata
        if (item.slug) {
            router.push(`/customizing/${item.slug}`);
            return;
        }

        // Fallback for items without slug: load and navigate
        const toastId = showLoading('Loading design...');

        // Clear previous state
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        try {
            const response = await fetch(item.original_image_url);
            const blob = await response.blob();
            const file = new File([blob], "design.jpg", { type: blob.type });

            // Validate analysis_json before using - must have required fields
            const isValidAnalysis = item.analysis_json &&
                typeof item.analysis_json === 'object' &&
                'cakeType' in item.analysis_json &&
                'icing_design' in item.analysis_json;

            await hookImageUpload(
                file,
                (result) => {
                    toast.dismiss(toastId);
                    setPendingAnalysisData(result);
                    setIsAnalyzing(false);
                    router.push('/customizing');
                },
                (error) => {
                    toast.dismiss(toastId);
                    console.error("Error processing image:", error);
                    showError("Failed to load design");
                },
                {
                    imageUrl: item.original_image_url,
                    precomputedAnalysis: isValidAnalysis ? item.analysis_json : undefined
                }
            );
        } catch (error) {
            toast.dismiss(toastId);
            console.error("Error fetching image:", error);
            showError("Failed to load design");
        }
    };

    // Brand Colors
    const brandGradient = "bg-gradient-to-r from-purple-500 to-pink-500";
    const textGradient = "bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600";

    const categories = [
        { id: 'Birthdays', name: 'Birthdays' },
        { id: 'Anniversaries', name: 'Anniversaries' },
        { id: 'Christmas Day', name: 'Christmas Day' },
        { id: 'New Year', name: 'New Year' },
        { id: 'Wedding', name: 'Wedding' },
        { id: 'Baptismal', name: 'Baptismal' },
    ];

    const products = [
        {
            id: 1,
            title: "Korean Vintage Heart",
            price: 1200,
            image: "https://images.unsplash.com/photo-1619980387586-4d054df5f037?q=80&w=600&auto=format&fit=crop",
            rating: 4.9,
            baker: "Cakes by Sarah",
            tag: "Trending"
        },
        {
            id: 2,
            title: "Minimalist Calendar",
            price: 850,
            image: "https://images.unsplash.com/photo-1626803775151-61d756612fcd?q=80&w=600&auto=format&fit=crop",
            rating: 4.8,
            baker: "Sweet Tooth",
            tag: "Best Seller"
        },
        {
            id: 3,
            title: "Custom Photo Cake",
            price: 1500,
            image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop",
            rating: 4.7,
            baker: "PrintEdible",
            tag: null
        },
        {
            id: 4,
            title: "Bento Lunchbox Set",
            price: 450,
            image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?q=80&w=600&auto=format&fit=crop",
            rating: 5.0,
            baker: "Tiny Treats",
            tag: "Express"
        },
        {
            id: 5,
            title: "2-Tier Floral Garden",
            price: 3500,
            image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?q=80&w=600&auto=format&fit=crop",
            rating: 5.0,
            baker: "Elegant Tiers",
            tag: "Pre-order"
        },
        {
            id: 6,
            title: "Assorted Cupcakes (12pc)",
            price: 950,
            image: "https://images.unsplash.com/photo-1599785209707-33348076838b?q=80&w=600&auto=format&fit=crop",
            rating: 4.6,
            baker: "Cupcake Central",
            tag: null
        }
    ];

    const stories = [
        { id: 1, name: "New In", color: "bg-purple-100" },
        { id: 2, name: "Promos", color: "bg-pink-100" },
        { id: 3, name: "Guides", color: "bg-blue-100" },
        { id: 4, name: "Reviews", color: "bg-yellow-100" },
        { id: 5, name: "Events", color: "bg-green-100" },
        { id: 6, name: "Vlog", color: "bg-orange-100" },
    ];

    type Promo = {
        id: number;
        tag: string;
        title: string;
        buttonText: string;
        gradient: string;
        shadow: string;
        icon: string | React.ReactNode;
        imageUrl?: string;
        action?: () => void;
    };

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // Reset touch end
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNextPromo();
        }
        if (isRightSwipe) {
            handlePrevPromo();
        }
    };

    const handleApplyPromo = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('cart_discount_code', 'NEW20');
            showSuccess('Discount code NEW20 applied!');
        }
    };

    const PROMO_COUNT = 3; // Keep in sync with promos array length

    const promos: Promo[] = [
        {
            id: 1,
            tag: "PROMO",
            title: "Get 20% OFF Custom designs for new users",
            buttonText: "Get Discount Code",
            gradient: "bg-gradient-to-r from-purple-500 to-pink-500",
            shadow: "shadow-purple-200",
            icon: "🎂",
            action: handleApplyPromo
        },
        {
            id: 4,
            tag: "FEATURE",
            title: "Have a cake photo? Get Price Now",
            buttonText: "Upload Photo",
            gradient: "bg-gradient-to-r from-pink-500 to-rose-500",
            shadow: "shadow-pink-200",
            icon: "📸",
            action: () => setIsUploaderOpen(true)
        },
        {
            id: 5,
            tag: "PARTNER",
            title: "Call for Bakeshops",
            buttonText: "",
            gradient: "bg-gray-100", // Fallback
            shadow: "shadow-gray-200",
            icon: null,
            imageUrl: COMMON_ASSETS.callForBakeshops,
            action: () => window.open('https://pro.genie.ph', '_blank')
        }
    ];

    const handleNextPromo = useCallback(() => {
        setCurrentPromoIndex((prev) => (prev + 1) % PROMO_COUNT);
    }, []);

    const handlePrevPromo = useCallback(() => {
        setCurrentPromoIndex((prev) => (prev - 1 + PROMO_COUNT) % PROMO_COUNT);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            handleNextPromo();
        }, 4000); // Auto-scroll every 4 seconds
        return () => clearInterval(timer);
    }, [handleNextPromo]);

    useEffect(() => {
        const interval = setInterval(() => {
            setImageIndex(prevIndex => prevIndex + 1);
        }, 2000);
        return () => clearInterval(interval);
    }, []);



    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (query: string) => {
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

    const handleAppImageUpload = useCallback((file: File) => {
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();
        router.push('/customizing');

        hookImageUpload(
            file,
            (result) => {
                setPendingAnalysisData(result);
                setIsAnalyzing(false);
            },
            (error) => {
                const errorMessage = error.message;
                setAnalysisError(errorMessage);
                showError(errorMessage);
                setIsAnalyzing(false);
            }
        );
    }, [clearImages, clearCustomization, setIsAnalyzing, setAnalysisError, initializeDefaultState, router, hookImageUpload, setPendingAnalysisData]);



    const [scrollY, setScrollY] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setScrollY(currentScrollY);
            setIsScrolled(currentScrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Calculate transition values based on scroll position
    const scrollThreshold = 50;
    const logoOpacity = Math.max(0, 1 - scrollY / scrollThreshold);
    const searchBarOpacity = Math.min(1, scrollY / scrollThreshold);
    const isFullyScrolled = scrollY > scrollThreshold;

    return (
        <div className="font-sans bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100 min-h-screen pb-24 md:pb-0 text-gray-800 flex flex-col">

            {/* --- ANIMATED HEADER --- */}
            <nav className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center justify-between gap-2 md:gap-4 mb-4 pt-6 relative">

                        {/* Logo - fades out on scroll on mobile, always visible on desktop */}
                        <div
                            className="absolute left-0 transition-all duration-500 ease-out pointer-events-none md:static md:pointer-events-auto md:opacity-100! md:transform-none! md:mr-8"
                            style={{
                                opacity: logoOpacity,
                                transform: `scale(${0.9 + logoOpacity * 0.1})`,
                                transformOrigin: 'left center'
                            }}
                        >
                            <img
                                src={COMMON_ASSETS.logo}
                                alt="Genie Logo"
                                className="h-16 md:h-12 object-contain"
                            />
                        </div>

                        {/* Search Icon/Bar - expands on scroll on mobile, always visible on desktop */}
                        <div
                            className="flex-1 transition-all duration-500 ease-out md:max-w-2xl! md:opacity-100! md:mx-auto overflow-visible py-1"
                            style={{
                                maxWidth: isFullyScrolled ? '100%' : '0px',
                                opacity: searchBarOpacity
                            }}
                        >
                            <SearchAutocomplete
                                onSearch={handleSearch}
                                onUploadClick={() => setIsUploaderOpen(true)}
                                placeholder="Search for custom cakes..."
                                value={searchQuery}
                                onChange={setSearchQuery}
                                className="w-full"
                                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>

                        {/* Right side icons - always visible */}
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                            {/* Search Icon - visible when not scrolled (Mobile Only) */}
                            {!isFullyScrolled && (
                                <button
                                    onClick={() => {
                                        window.scrollTo({ top: scrollThreshold + 10, behavior: 'smooth' });
                                    }}
                                    className="p-2 text-slate-600 hover:text-purple-700 transition-all shrink-0 md:hidden"
                                    style={{ opacity: 1 - searchBarOpacity }}
                                    aria-label="Search"
                                >
                                    <Search size={24} />
                                </button>
                            )}

                            {/* Profile Icon (Desktop Only - hidden on mobile since bottom nav has profile) */}
                            <button
                                onClick={() => {
                                    if (isAuthenticated && !user?.is_anonymous) {
                                        router.push('/account');
                                    } else {
                                        router.push('/login');
                                    }
                                }}
                                className="hidden md:block p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label="Account"
                            >
                                <User size={24} />
                            </button>

                            {/* Cart Icon */}
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
                </div>
            </nav>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">




                <div className="flex flex-col md:flex-row gap-8">

                    {/* Sidebar (Desktop Only) */}
                    <aside className="hidden md:block w-64 shrink-0">
                        <div className="sticky top-24 space-y-8">
                            {/* Categories Sidebar */}
                            <div>
                                <h3 className="font-bold text-gray-900 mb-4 text-lg">Celebrations</h3>
                                <div className="space-y-1">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => router.push(`/search?q=${encodeURIComponent(cat.name)}`)}
                                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat.id
                                                ? 'bg-purple-50 text-purple-700 font-bold shadow-sm'
                                                : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                {cat.name}
                                                {selectedCategory === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Desktop Promo Widget */}
                            <div className={`${brandGradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group`}>
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                                    <Camera size={80} fill="currentColor" />
                                </div>
                                <h3 className="font-bold text-lg mb-2 relative z-10">Have a cake photo?</h3>
                                <p className="text-sm opacity-90 mb-4 relative z-10 leading-relaxed">Upload any screenshot and get an instant price quote in seconds.</p>
                                <button
                                    onClick={() => setIsUploaderOpen(true)}
                                    className="w-full bg-white text-purple-600 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-50 transition shadow-sm relative z-10"
                                >
                                    Get Price Now
                                </button>
                            </div>
                        </div>
                    </aside>

                    {/* Main Feed */}
                    <div className="flex-1 min-w-0"> {/* min-w-0 prevents flex child from overflowing */}



                        {/* Hero Promo Slider (Adaptive Height) */}
                        <div className="mb-8 group">
                            <div
                                className="relative overflow-hidden rounded-3xl shadow-xl shadow-purple-100/50 h-56 md:h-80 lg:h-96 touch-pan-y"
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                            >
                                <div
                                    className="flex transition-transform duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] h-full"
                                    style={{ transform: `translateX(-${currentPromoIndex * 100}%)` }}
                                >
                                    {promos.map((promo) => (
                                        <div
                                            key={promo.id}
                                            className={`w-full shrink-0 ${promo.imageUrl ? 'p-0' : 'p-6 md:p-12'} ${promo.gradient} text-white relative flex items-center h-full`}
                                            onClick={() => promo.action && promo.action()}
                                        >
                                            {promo.imageUrl ? (
                                                <LazyImage
                                                    src={promo.imageUrl}
                                                    alt={promo.title}
                                                    className="w-full h-full object-cover cursor-pointer"
                                                    eager={true}
                                                />
                                            ) : (
                                                <>
                                                    {/* Content */}
                                                    <div className="relative z-10 w-2/3 md:w-1/2 flex flex-col items-start justify-center h-full">
                                                        <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold backdrop-blur-md mb-4 inline-block border border-white/10 shadow-sm">
                                                            {promo.tag}
                                                        </span>
                                                        <h1 className="text-[clamp(1.25rem,5.5vw,1.875rem)] md:text-2xl lg:text-3xl font-black leading-tight mb-4 md:mb-6 drop-shadow-sm line-clamp-3">{promo.title}</h1>
                                                        <button
                                                            className="bg-white text-gray-900 px-6 py-3 md:px-8 md:py-3.5 rounded-full text-xs md:text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
                                                        >
                                                            {promo.buttonText}
                                                        </button>
                                                    </div>
                                                    {/* Decorative Icon */}
                                                    <div className="absolute -right-4 md:right-8 lg:right-16 top-1/2 transform -translate-y-1/2 text-[9rem] md:text-[16rem] lg:text-[20rem] opacity-25 rotate-12 select-none pointer-events-none filter drop-shadow-lg transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110">
                                                        {promo.icon}
                                                    </div>
                                                    {/* Decorative Blobs */}
                                                    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Navigation Arrows */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrevPromo();
                                    }}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 backdrop-blur-md text-white p-2 rounded-full shadow-lg transition-all z-20 opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center"
                                    aria-label="Previous Slide"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleNextPromo();
                                    }}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 backdrop-blur-md text-white p-2 rounded-full shadow-lg transition-all z-20 opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center"
                                    aria-label="Next Slide"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>

                                {/* Dots Indicator */}
                                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
                                    {promos.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentPromoIndex(index);
                                            }}
                                            className={`h-1.5 md:h-2 rounded-full transition-all duration-300 backdrop-blur-sm shadow-sm ${index === currentPromoIndex ? 'w-6 md:w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Mobile Categories (Horizontal Scroll) - Placed above Available Cakes */}
                        <div className="md:hidden flex gap-2 mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => router.push(`/search?q=${encodeURIComponent(cat.name)}`)}
                                    className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-white border border-gray-100 text-gray-500 hover:border-purple-200 hover:text-purple-600'
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* --- AVAILABLE CAKES FOR TODAY (Quick Links) --- */}
                        <div className="mb-8">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Available Cakes For Today</h2>
                            <div className="grid grid-cols-3 gap-3 md:gap-6">
                                {quickLinks.map((link) => {
                                    const currentImageUrl = link.imageUrls[imageIndex % link.imageUrls.length];
                                    return (
                                        <button
                                            key={link.name}
                                            onClick={() => handleSearch(link.searchTerm)}
                                            className="group relative overflow-hidden rounded-2xl aspect-square shadow-sm hover:shadow-lg transition-all duration-300"
                                        >
                                            <LazyImage
                                                src={currentImageUrl}
                                                alt={link.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                eager={true}
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end p-3 md:p-4">
                                                <span className="text-white font-bold text-xs md:text-base leading-tight">{link.name}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --- SHOP BY OCCASION (SEO Links) --- */}
                        <div className="mb-8">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Shop by Occasion</h2>
                            <div className="flex flex-wrap gap-2 md:gap-3">
                                {occasionLinks.map((link) => (
                                    <Link
                                        key={link.slug}
                                        href={`/customizing/${link.slug}`}
                                        className="px-4 py-2 md:px-5 md:py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all shadow-sm"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* --- PARTNER SHOPS SHOWCASE --- */}
                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Our Partner Shops</h2>
                                <button
                                    onClick={() => router.push('/search?q=shops')}
                                    className="text-purple-600 text-sm font-bold hover:underline"
                                >
                                    View All
                                </button>
                            </div>
                            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 py-2">
                                {isLoadingMerchants ? (
                                    // Skeleton loading
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="flex flex-col items-center shrink-0 animate-pulse">
                                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-200" />
                                            <div className="mt-2 h-3 w-12 bg-gray-200 rounded" />
                                        </div>
                                    ))
                                ) : merchants.length > 0 ? (
                                    merchants.map((merchant) => (
                                        <button
                                            key={merchant.merchant_id}
                                            onClick={() => router.push(`/shop/${merchant.slug}`)}
                                            className="flex flex-col items-center shrink-0 group"
                                            aria-label={`Visit ${merchant.business_name}`}
                                        >
                                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-linear-to-br from-purple-100 to-pink-100 ring-2 ring-transparent group-hover:ring-purple-400 transition-all duration-300 shadow-sm group-hover:shadow-md">
                                                {merchant.profile_image_url ? (
                                                    <LazyImage
                                                        src={merchant.profile_image_url}
                                                        alt={merchant.business_name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-purple-500 to-pink-500 text-white font-bold text-lg md:text-xl">
                                                        {merchant.business_name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="mt-2 text-xs font-medium text-gray-700 group-hover:text-purple-600 transition-colors max-w-[64px] md:max-w-[80px] line-clamp-2 text-center leading-tight">
                                                {merchant.business_name}
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm">No partner shops available yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Section Header */}
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Recent searches by users</h2>
                                <p className="text-gray-500 text-sm md:text-base">Get the price in 15 seconds!</p>
                            </div>
                            <button className="text-purple-600 text-sm font-bold hover:underline hidden md:block">View All</button>
                        </div>

                        {/* Product Grid (Responsive Cols) */}


                        {/* Product Grid (Responsive Cols) */}
                        <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6 mb-12">
                            {isLoadingProducts && offset === 0 ? (
                                // Initial Skeleton Loading State
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                                        <div className="aspect-square mb-3 rounded-xl bg-gray-200"></div>
                                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                                        <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                            <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                                            <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                                        </div>
                                    </div>
                                ))
                            ) : recommendedProducts.length > 0 ? (
                                <>
                                    {recommendedProducts.map((item, index) => (
                                        <div
                                            key={`${item.p_hash}-${index}`} // Composite key to ensure uniqueness even if duplicates occur
                                            onClick={(e) => handleRecommendedProductClick(e, item)}
                                            className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group cursor-pointer"
                                        >
                                            <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100">
                                                <LazyImage
                                                    src={item.original_image_url}
                                                    alt={item.keywords || 'Cake Design'}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    eager={index < 4} // Eager load first few images
                                                />

                                                {/* Overlay Gradient on Hover */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        if (!isAuthenticated || user?.is_anonymous) {
                                                            toast('Please log in to save items', { icon: '💜' });
                                                            router.push('/login');
                                                            return;
                                                        }

                                                        // Use the custom design toggle since these are recent searches (custom designs)
                                                        const pHash = item.p_hash || item.id;
                                                        await toggleSaveDesign({
                                                            analysisPHash: pHash,
                                                            customizationSnapshot: item.analysis_json || {},
                                                            customizedImageUrl: item.original_image_url
                                                        });

                                                        const wasSaved = isDesignSaved(pHash);
                                                        toast.success(wasSaved ? 'Removed from saved' : 'Saved!');
                                                    }}
                                                    className={`save-heart-button absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-all z-10 ${isDesignSaved(item.p_hash || item.id)
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
                                                        }`}
                                                >
                                                    <Heart
                                                        size={16}
                                                        fill={isDesignSaved(item.p_hash || item.id) ? 'currentColor' : 'none'}
                                                        className={isDesignSaved(item.p_hash || item.id) ? 'text-white' : ''}
                                                    />
                                                </button>

                                                {/* Tag based on price or random for now since we don't have tags in DB yet */}
                                                {item.price < 1000 && (
                                                    <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm">
                                                        Affordable
                                                    </span>
                                                )}
                                            </div>
                                            <div className="px-1">
                                                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                                    {(() => {
                                                        const title = item.keywords ? item.keywords.split(',')[0] : 'Custom Cake';
                                                        return title.trim().toLowerCase().endsWith('cake') ? title : `${title} Cake`;
                                                    })()}
                                                </h3>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Cake size={12} /> {item.analysis_json?.cakeType || 'Custom Design'}
                                                </p>
                                                <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                                    <span className="font-black text-gray-900 text-base md:text-lg">₱{item.price.toLocaleString()}</span>
                                                    <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                                                        <Star size={12} fill="currentColor" /> 5.0
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Additional Skeleton Loading State when "Load More" is clicked */}
                                    {isLoadingMore && (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <div key={`loading-more-${i}`} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                                                <div className="aspect-square mb-3 rounded-xl bg-gray-200"></div>
                                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                                                <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                                                    <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </>
                            ) : (
                                // Fallback if no products found (show original hardcoded or empty message)
                                <div className="col-span-full text-center py-10 text-gray-500">
                                    No recommended cakes found at the moment.
                                </div>
                            )}
                        </div>

                        <div className="text-center pb-10">
                            {hasMore ? (
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="border border-gray-300 bg-white px-8 py-3 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoadingMore ? 'Loading...' : 'Load More'}
                                </button>
                            ) : (
                                <div className="text-gray-400 text-xs">End of results</div>
                            )}
                        </div>
                    </div>
                </div>
            </main >

            {/* --- FOOTER --- */}
            < footer className="bg-purple-50 text-gray-900 pt-16 pb-24 md:pb-8 border-t border-purple-100" >
                {/* Top Section: Features */}
                < div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12" >
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
                                <Camera size={24} />
                            </div>
                            <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Instantly get the price</h3>
                            <p className="text-gray-600 text-sm mb-4">Upload your cake design and we will instantly give you the price in 30 seconds.</p>
                            <button onClick={() => setIsUploaderOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                                Upload here
                            </button>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-600">
                                <Cake size={24} />
                            </div>
                            <h3 className="font-bold text-lg mb-2 text-pink-600 font-serif italic">Fresh cakes delivered to you</h3>
                            <p className="text-gray-600 text-sm mb-4">Homemade delicious cakes freshly baked just in time for your special day</p>
                            <button onClick={() => router.push('/about')} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                                About Us
                            </button>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
                                <Tag size={24} />
                            </div>
                            <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Affordable yummy cakes</h3>
                            <p className="text-gray-600 text-sm mb-4">All prices of our cake designs are always updated and affordable</p>
                            <button onClick={() => router.push('/how-to-order')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                                How to order
                            </button>
                        </div>

                        {/* Feature 4 */}
                        <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-600">
                                <CreditCard size={24} />
                            </div>
                            <h3 className="font-bold text-lg mb-2 text-pink-600 font-serif italic">Secure payment options</h3>
                            <p className="text-gray-600 text-sm mb-4">E-wallets, over-the-counter and bank payments for your convenience</p>
                            <button className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                                Payments
                            </button>
                        </div>
                    </div>
                </div >

                {/* Middle Section: Social & Ratings */}
                < div className="border-t border-purple-200 bg-purple-100/50" >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            {/* Social Icons */}
                            <div className="flex items-center gap-4">
                                <a href="https://web.facebook.com/geniephilippines" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition text-purple-600 shadow-sm">
                                    <Facebook size={20} />
                                </a>
                                <a href="https://www.instagram.com/genie.ph/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition text-purple-600 shadow-sm">
                                    <Instagram size={20} />
                                </a>
                                <a href="http://tiktok.com/genie.ph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-pink-600 hover:text-white transition text-pink-500 shadow-sm">
                                    {/* Custom TikTok Icon SVG */}
                                    <svg viewBox="0 0 24 24" fill="currentColor" height="20" width="20">
                                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                                    </svg>
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-red-600 hover:text-white transition text-red-500 shadow-sm">
                                    <Youtube size={20} />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-blue-600 hover:text-white transition text-blue-500 shadow-sm">
                                    <MessageCircle size={20} />
                                </a>
                            </div>

                            {/* Ratings */}
                            <div className="flex items-center gap-3 text-sm md:text-base bg-white px-4 py-2 rounded-full shadow-sm border border-purple-100">
                                <span className="font-bold text-2xl text-gray-800">4.8</span>
                                <div className="flex text-yellow-400">
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                </div>
                                <span className="hidden md:inline text-gray-300">|</span>
                                <span className="text-gray-600">Customers rate us 4.8/5 based on 40 reviews.</span>
                                <span className="hidden md:inline text-gray-300">|</span>
                                <span className="flex items-center gap-1 text-green-500 font-bold">
                                    Verified <Check size={14} />
                                </span>
                            </div>
                        </div>
                    </div>
                </div >

                {/* Bottom Section: Company Info */}
                < div className="border-t border-purple-200 pt-12" >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start gap-8">
                        {/* Brand Info */}
                        <div className="max-w-md">
                            <div className="flex items-center gap-2 mb-4">
                                <img src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20logo%20long2.webp" alt="Genie Logo" className="h-10 object-contain" />
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed mb-6">
                                We're an online marketplace and delivery service for decorated cakes. We have a wide range of available and customizable cake designs, all with updated and affordable prices so you can search and decide immediately on what to buy when you use our platform.
                            </p>

                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex items-center gap-3">
                                    <Mail size={16} className="text-purple-500" />
                                    <span>support@genie.ph</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone size={16} className="text-pink-500" />
                                    <span>+63 908 940 8747</span>
                                </div>
                            </div>
                        </div>

                        {/* Back to Top */}
                        <button
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 transition shadow-lg self-end md:self-auto"
                        >
                            <ChevronUp size={24} />
                        </button>
                    </div>
                </div >
            </footer >



            {/* --- MOBILE BOTTOM NAV --- */}
            < nav className="md:hidden fixed bottom-0 w-full bg-white/95 backdrop-blur-lg border-t border-gray-100 py-4 px-6 flex justify-between items-center text-gray-500 z-50 pb-safe" >
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
            </nav >

            <ImageUploader
                isOpen={isUploaderOpen}
                onClose={() => setIsUploaderOpen(false)}
                onImageSelect={(file) => {
                    handleAppImageUpload(file);
                    setIsUploaderOpen(false);
                }}
            />
        </div >
    );
};

export default LandingClient;
