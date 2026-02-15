'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { PopularDesigns } from '@/components/landing';
import { FeaturedCollections, FeaturedCollectionItem } from '@/components/landing/FeaturedCollections';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import LazyImage from '@/components/LazyImage';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { ImageUploader } from '@/components/ImageUploader';
import { showError, showSuccess, showLoading } from '@/lib/utils/toast';
import { toast } from 'react-hot-toast';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { LANDING_PAGE_IMAGES, COMMON_ASSETS } from '@/constants';
import { getAllBlogPosts } from '@/data/blogPosts';
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
    },
    {
        name: 'Birthday Printouts',
        imageUrls: LANDING_PAGE_IMAGES.birthdayPrintouts,
        searchTerm: 'birthday printouts'
    }
];

const occasionLinks = [
    { label: 'Birthday Cakes', slug: 'birthday' },
    { label: 'Wedding Cakes', slug: 'wedding' },
    { label: 'Graduation Cakes', slug: 'graduation' },
    { label: 'Anniversary Cakes', slug: 'anniversary' },
    { label: 'Christening Cakes', slug: 'christening' },
];

interface LandingClientProps {
    children?: React.ReactNode;
    popularDesigns?: any[];
    categories?: FeaturedCollectionItem[];
}

const LandingClient: React.FC<LandingClientProps> = ({ children, popularDesigns = [], categories = [] }) => {
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

    // Note: Merchants and products are now rendered via server components passed as children


    // Brand Colors
    const brandGradient = "bg-gradient-to-r from-purple-500 to-pink-500";
    const textGradient = "bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600";

    const categoriesList = [
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
                let errorMessage = error.message;
                if (error.message.startsWith('AI_REJECTION:')) {
                    errorMessage = error.message.replace('AI_REJECTION: ', '');
                }
                // Keep the prefix for state logic, but show clean message to user
                setAnalysisError(error.message);
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
                        <Link
                            href="/"
                            className={`absolute left-0 transition-all duration-500 ease-out ${isFullyScrolled ? 'pointer-events-none' : 'pointer-events-auto'} md:static md:pointer-events-auto md:opacity-100! md:transform-none! md:mr-8`}
                            style={{
                                opacity: logoOpacity,
                                transform: `scale(${0.9 + logoOpacity * 0.1})`,
                                transformOrigin: 'left center'
                            }}
                        >
                            <img
                                src={COMMON_ASSETS.logo}
                                alt="Genie Logo"
                                width={180}
                                height={64}
                                className="h-16 md:h-12 w-auto object-contain"
                            />
                        </Link>

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
                <h1 className="sr-only">Genie.ph | Best Custom Cakes in Cebu & Online Cake Delivery</h1>




                <div className="flex flex-col md:flex-row gap-8">

                    {/* Sidebar (Desktop Only) */}
                    <aside className="hidden md:block w-64 shrink-0">
                        <div className="sticky top-24 space-y-8">
                            {/* Categories Sidebar */}
                            <div>
                                <h3 className="font-bold text-gray-900 mb-4 text-lg">Shop by Occasion</h3>
                                <div className="space-y-1">
                                    {categoriesList.map((cat) => (
                                        <Link
                                            key={cat.id}
                                            href={`/search?q=${encodeURIComponent(cat.name)}`}
                                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all block ${selectedCategory === cat.id
                                                ? 'bg-purple-50 text-purple-700 font-bold shadow-sm'
                                                : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                {cat.name}
                                                {selectedCategory === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>}
                                            </div>
                                        </Link>
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
                                                    priority={true}
                                                    fill
                                                />
                                            ) : (
                                                <>
                                                    {/* Content */}
                                                    <div className="relative z-10 w-2/3 md:w-1/2 flex flex-col items-start justify-center h-full">
                                                        <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold backdrop-blur-md mb-4 inline-block border border-white/10 shadow-sm">
                                                            {promo.tag}
                                                        </span>
                                                        <h2 className="text-[clamp(1.25rem,5.5vw,1.875rem)] md:text-2xl lg:text-3xl font-black leading-tight mb-4 md:mb-6 drop-shadow-sm line-clamp-3">{promo.title}</h2>
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
                        <h2 className="text-xl font-bold text-gray-900 mb-4 md:hidden">Shop by Occasion</h2>
                        <div className="md:hidden flex gap-2 mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
                            {categoriesList.map((cat) => (
                                <Link
                                    key={cat.id}
                                    href={`/search?q=${encodeURIComponent(cat.name)}`}
                                    className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all inline-block ${selectedCategory === cat.id
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-white border border-gray-100 text-gray-500 hover:border-purple-200 hover:text-purple-600'
                                        }`}
                                >
                                    {cat.name}
                                </Link>
                            ))}
                        </div>

                        {/* --- CAKES AVAILABLE TODAY --- */}
                        <div className="mb-8">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Shop Cakes Available Today</h2>
                            <div className="flex overflow-x-auto gap-3 pb-4 md:grid md:grid-cols-4 md:gap-6 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                                {quickLinks.map((link) => {
                                    const currentImageUrl = link.imageUrls[imageIndex % link.imageUrls.length];
                                    return (
                                        <Link
                                            key={link.name}
                                            href={`/search?q=${encodeURIComponent(link.searchTerm)}`}
                                            className="group relative overflow-hidden rounded-2xl aspect-square shadow-sm hover:shadow-lg transition-all duration-300 min-w-[30%] md:min-w-0 block"
                                        >
                                            <LazyImage
                                                src={currentImageUrl}
                                                alt={link.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                priority={true}
                                                fill
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end p-3 md:p-4">
                                                <span className="text-white font-bold text-xs md:text-base leading-tight">{link.name}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --- FEATURED COLLECTIONS SECTION --- */}
                        <FeaturedCollections categories={categories} />

                        {/* --- SHOP BY OCCASION (SEO Links) - REMOVED AS REQUESTED --- */}

                        {/* Server-rendered merchants and products sections */}
                        {children}

                        {/* --- BLOG SECTION: LATEST TRENDS --- */}
                        <div className="mt-10">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-900">What are the latest custom cake trends in Cebu?</h2>
                                <Link href="/blog" className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors">
                                    View all
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {getAllBlogPosts().map((post) => (
                                    <Link
                                        key={post.slug}
                                        href={`/blog/${post.slug}`}
                                        className="block bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-purple-100 hover:shadow-md hover:border-purple-200 transition-all group"
                                    >
                                        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors leading-snug">
                                            {post.title}
                                        </h3>
                                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                                            {post.excerpt}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* --- POPULAR DESIGNS SECTION --- */}
                        <div className="mt-16">
                            <PopularDesigns designs={popularDesigns} />
                        </div>
                    </div>
                </div>
            </main>

            {/* --- FOOTER --- */}
            <Footer />



            {/* --- MOBILE BOTTOM NAV --- */}
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
