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
    Twitter,
    Upload,
    UploadCloud,
    Calculator,
    Menu
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

const heroImages = [
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-hero-1.webp',
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-hero-2.webp',
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-hero-3.webp',
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-hero-4.webp',
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-hero-5.webp',
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/genie-hero-6.webp'
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
    const [rushImageIndexes, setRushImageIndexes] = useState<number[]>(quickLinks.map(() => 0));
    const [heroImageIndex, setHeroImageIndex] = useState(0);
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOccasionOpen, setIsOccasionOpen] = useState(false);


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


    useEffect(() => {
        const intervals = quickLinks.map((link, cardIndex) => {
            // Stagger each card's interval slightly so they don't all change at once
            return setInterval(() => {
                setRushImageIndexes(prev => {
                    const next = [...prev];
                    next[cardIndex] = (next[cardIndex] + 1) % link.imageUrls.length;
                    return next;
                });
            }, 4000 + cardIndex * 600);
        });

        const heroInterval = setInterval(() => {
            setHeroImageIndex(prevIndex => (prevIndex + 1) % heroImages.length);
        }, 1000);

        return () => {
            intervals.forEach(clearInterval);
            clearInterval(heroInterval);
        };
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
                    {/* Mobile Header — both layouts always in the DOM, cross-fading via opacity */}
                    <div className="md:hidden relative w-full mb-4" style={{ height: '88px' /* pt-6 (24px) + logo h-16 (64px) */ }}>

                        {/* Layer 1: Not-scrolled — [menu | logo | icons], fades OUT on scroll */}
                        <div
                            className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center pt-6 transition-opacity duration-300"
                            style={{ opacity: logoOpacity, pointerEvents: isFullyScrolled ? 'none' : 'auto' }}
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

                        {/* Layer 2: Scrolled — [search bar | cart], fades IN on scroll */}
                        <div
                            className="absolute inset-0 flex items-center gap-2 pt-6 transition-opacity duration-300"
                            style={{ opacity: searchBarOpacity, pointerEvents: isFullyScrolled ? 'auto' : 'none' }}
                        >
                            <div className="flex-1 min-w-0">
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

                    {/* Desktop Header: Menu + Logo left, Search center, Icons right */}
                    <div className="hidden md:flex w-full items-center gap-4 mb-4 pt-6">
                        {/* Left: Menu icon + Logo */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 text-slate-600 hover:text-purple-700 transition-colors"
                                aria-label="Open menu"
                            >
                                <Menu size={24} />
                            </button>
                            <Link href="/">
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={180}
                                    height={48}
                                    className="h-12 w-auto object-contain"
                                />
                            </Link>
                        </div>

                        {/* Center: Search Bar */}
                        <div className="flex-1 flex justify-center">
                            <div className="w-full max-w-md lg:max-w-lg">
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
                        </div>

                        {/* Right: Account + Cart */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => {
                                    if (isAuthenticated && !user?.is_anonymous) {
                                        router.push('/account');
                                    } else {
                                        router.push('/login');
                                    }
                                }}
                                className="p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label="Account"
                            >
                                <User size={24} />
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
                </div>
            </nav>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
                <h1 className="sr-only">Genie.ph | Best Custom Cakes in Cebu & Online Cake Delivery</h1>




                <div className="flex flex-col md:flex-row gap-4 md:gap-6">


                    {/* Main Feed */}
                    <div className="flex-1 min-w-0"> {/* min-w-0 prevents flex child from overflowing */}



                        {/* Hero Section */}
                        <div className="mb-2 md:mb-4 space-y-4">
                            {/* Mobile Hero */}
                            <div className="sm:hidden flex flex-col gap-3 text-center pt-2 pb-2">
                                {/* Rotating Image Banner with Text Overlay */}
                                <div className="relative w-full rounded-2xl overflow-hidden shadow-sm aspect-[3/2] bg-white flex flex-col justify-center">
                                    {heroImages.map((src, index) => (
                                        <div
                                            key={src}
                                            className={`absolute inset-0 transition-opacity duration-1000 ${index === heroImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                                        >
                                            <LazyImage
                                                src={src}
                                                alt={`Custom Cake Mobile ${index + 1}`}
                                                className="w-full h-full object-cover"
                                                priority={index === 0}
                                                fill
                                            />
                                        </div>
                                    ))}

                                    {/* Responsive Text Overlay */}
                                    <div className="absolute inset-y-0 left-0 w-3/4 max-w-[280px] bg-linear-to-r from-white via-white/80 to-transparent z-20 pointer-events-none" />

                                    <div className="relative z-30 px-5 text-left w-full sm:w-[85%]">
                                        <p className="text-[1.75rem] xs:text-[2rem] sm:text-[2.2rem] font-extrabold text-[#4a1d96] leading-[1.1] tracking-tight drop-shadow-sm">
                                            Upload any Cake Design,<br />Get the Price in Seconds
                                        </p>
                                        <p className="mt-2 text-[0.78rem] xs:text-[0.85rem] text-[#6d3fc7] font-medium leading-snug drop-shadow-sm">
                                            The fastest way to buy customized cakes.<br />Personalize your order in a few clicks.
                                        </p>
                                    </div>
                                </div>

                                {/* Buttons Below */}
                                <div className="flex flex-row items-center gap-2 xs:gap-3 w-full max-w-[360px] mx-auto">
                                    <button
                                        className="flex-1 flex items-center justify-center gap-1.5 w-full bg-[#9b80e3] hover:bg-[#8669cc] text-white py-3.5 px-2 rounded-[0.875rem] font-semibold transition-all shadow-md active:scale-[0.98] text-[14px] xs:text-[15px] whitespace-nowrap"
                                        onClick={() => setIsUploaderOpen(true)}
                                    >
                                        <Upload size={18} className="shrink-0" />
                                        <span>Upload<span className="hidden min-[350px]:inline"> a Design</span></span>
                                    </button>
                                    <Link
                                        href="/collections"
                                        className="flex-1 flex items-center justify-center gap-1.5 w-full bg-white hover:bg-purple-50 text-[#9b80e3] border border-[#d8cbf9] py-3.5 px-2 rounded-[0.875rem] font-semibold transition-all active:scale-[0.98] text-[14px] xs:text-[15px] whitespace-nowrap"
                                    >
                                        <Search size={18} className="shrink-0" />
                                        <span>Browse<span className="hidden min-[350px]:inline"> Designs</span></span>
                                    </Link>
                                </div>
                            </div>

                            {/* Desktop/Tablet Hero */}
                            <div className="hidden sm:flex relative overflow-hidden rounded-[2rem] bg-white h-72 lg:h-[26rem] items-center shadow-sm">
                                {/* Left Side: Text and Buttons */}
                                <div className="flex-1 px-8 lg:px-14 z-20 flex flex-col justify-center h-full max-w-[55%] relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent pointer-events-none -mr-32" />
                                    <div className="relative z-10">
                                        <p className="text-[2.5rem] lg:text-[3.5rem] font-extrabold text-[#4a1d96] leading-[1.1] tracking-tight drop-shadow-sm">
                                            Upload and Cake Design,<br />Get the Price in Seconds
                                        </p>
                                        <p className="mt-3 mb-8 text-[0.95rem] lg:text-[1.1rem] text-[#6d3fc7] font-medium leading-snug">
                                            The fastest way to buy customized cakes.<br />Personalize your order in a few clicks.
                                        </p>
                                        <div className="flex flex-row gap-3 lg:gap-4 items-center flex-nowrap shrink-0">
                                            <button
                                                className="flex items-center justify-center gap-2 bg-[#9b80e3] hover:bg-[#8669cc] text-white px-5 py-3 lg:px-7 lg:py-3.5 rounded-[0.875rem] font-semibold transition-all shadow-md active:scale-[0.98] text-sm lg:text-base whitespace-nowrap shrink-0"
                                                onClick={() => setIsUploaderOpen(true)}
                                            >
                                                <Upload size={18} className="shrink-0 lg:w-5 lg:h-5" />
                                                Upload a Design
                                            </button>
                                            <Link
                                                href="/collections"
                                                className="flex items-center justify-center bg-[#fcfcff] hover:bg-purple-50 text-[#9b80e3] border border-[#d8cbf9] px-5 py-3 lg:px-7 lg:py-3.5 rounded-[0.875rem] font-semibold transition-all active:scale-[0.98] text-sm lg:text-base whitespace-nowrap shrink-0"
                                            >
                                                Browse Designs
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {/* Background Rotating Image covering full area */}
                                <div className="absolute inset-0 z-0">
                                    <div className="relative w-full h-full">
                                        {/* Soft gradient fade on the left edge of the image to blend it with the white text area */}
                                        <div className="absolute inset-y-0 left-0 w-[50%] bg-gradient-to-r from-white via-white/80 to-transparent z-20 pointer-events-none" />

                                        {heroImages.map((src, index) => (
                                            <div
                                                key={src}
                                                className={`absolute inset-0 transition-opacity duration-1000 ${index === heroImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                                            >
                                                <LazyImage
                                                    src={src}
                                                    alt={`Featured Custom Cake ${index + 1}`}
                                                    className="w-full h-full object-cover object-[center_right]"
                                                    priority={index === 0}
                                                    fill
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- HOW IT WORKS SECTION --- */}
                        <div className="mt-2 md:mt-8 mb-3 w-screen relative left-[50%] right-[50%] -ml-[50vw] -mr-[50vw]">
                            <div className="absolute inset-0 z-0">
                                <LazyImage
                                    src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/how-it-works-bg.webp"
                                    alt="How it Works Background"
                                    className="w-full h-full object-cover opacity-90"
                                    fill
                                    priority
                                />
                                <div className="absolute inset-0 bg-white/20"></div>
                            </div>
                            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 md:pt-8 md:pb-[42px]">
                                <div className="text-center mb-4 md:mb-6">
                                    <p className="text-[12px] md:text-[14px] font-bold text-purple-800 uppercase tracking-widest mb-1 opacity-90">
                                        Skip the endless &quot;HM?&quot; and &quot;PM for price&quot;
                                    </p>
                                    <h2 className="text-[24px] md:text-3xl font-bold text-purple-950 drop-shadow-sm">How it Works</h2>
                                </div>
                                <div className="flex gap-2 md:grid md:grid-cols-4 md:gap-6 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0">
                                    {/* Card 1 */}
                                    <div className="bg-white/80 backdrop-blur-sm hover:bg-purple-50/90 transition-all rounded-[0.75rem] md:rounded-[1.25rem] p-3 sm:p-4 md:p-8 flex flex-col items-center text-center shadow-sm border border-white/50 hover:shadow-md min-w-[30vw] max-w-[110px] md:min-w-0 md:max-w-none shrink-0">
                                        <div className="mb-2 md:mb-4 text-purple-800">
                                            <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8 md:w-11 md:h-11" strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-[11px] sm:text-[14px] leading-[1.2] md:text-[21px] font-bold text-purple-950 mb-1 md:mb-2">1. Upload<br className="md:hidden" /> or Browse</h3>
                                        <p className="text-purple-800 text-[9px] sm:text-[12px] leading-tight md:text-[17px]">Any Cake Design<br className="md:hidden" /></p>
                                    </div>

                                    {/* Card 2 */}
                                    <div className="bg-white/80 backdrop-blur-sm hover:bg-purple-50/90 transition-all rounded-[0.75rem] md:rounded-[1.25rem] p-3 sm:p-4 md:p-8 flex flex-col items-center text-center shadow-sm border border-white/50 hover:shadow-md min-w-[30vw] max-w-[110px] md:min-w-0 md:max-w-none shrink-0">
                                        <div className="mb-2 md:mb-4 text-purple-800 flex items-center justify-center relative w-[28px] h-[24px] sm:w-[40px] sm:h-[36px] md:w-[56px] md:h-[46px]">
                                            <Tag className="absolute left-0 top-0 opacity-80 w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-8 md:h-8" strokeWidth={1.5} />
                                            <Calculator className="absolute right-0 bottom-0 bg-purple-50/60 rounded rotate-12 w-5 h-5 sm:w-7 sm:h-7 md:w-9 md:h-9 shadow-sm" strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-[11px] sm:text-[14px] leading-[1.2] md:text-[21px] font-bold text-purple-950 mb-1 md:mb-2">2. Get Instant<br className="md:hidden" /> Quote</h3>
                                        <p className="text-purple-800 text-[9px] sm:text-[12px] leading-tight md:text-[17px]">Prices in seconds<br className="md:hidden" /></p>
                                    </div>

                                    {/* Card 3 - NEW */}
                                    <div className="bg-white/80 backdrop-blur-sm hover:bg-purple-50/90 transition-all rounded-[0.75rem] md:rounded-[1.25rem] p-3 sm:p-4 md:p-8 flex flex-col items-center text-center shadow-sm border border-white/50 hover:shadow-md min-w-[30vw] max-w-[110px] md:min-w-0 md:max-w-none shrink-0">
                                        <div className="mb-2 md:mb-4 text-purple-800">
                                            <Cake className="w-6 h-6 sm:w-8 sm:h-8 md:w-11 md:h-11" strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-[11px] sm:text-[14px] leading-[1.2] md:text-[21px] font-bold text-purple-950 mb-1 md:mb-2">3. Customize<br className="md:hidden" /> Your Cake</h3>
                                        <p className="text-purple-800 text-[9px] sm:text-[12px] leading-tight md:text-[17px]">Size, color &amp; toppers<br className="md:hidden" /></p>
                                    </div>

                                    {/* Card 4 */}
                                    <div className="bg-white/80 backdrop-blur-sm hover:bg-purple-50/90 transition-all rounded-[0.75rem] md:rounded-[1.25rem] p-3 sm:p-4 md:p-8 flex flex-col items-center text-center shadow-sm border border-white/50 hover:shadow-md min-w-[30vw] max-w-[110px] md:min-w-0 md:max-w-none shrink-0">
                                        <div className="mb-2 md:mb-4 text-purple-800">
                                            <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 md:w-11 md:h-11" strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-[11px] sm:text-[14px] leading-[1.2] md:text-[21px] font-bold text-purple-950 mb-1 md:mb-2">4. Add to Cart<br className="md:hidden" /></h3>
                                        <p className="text-purple-800 text-[9px] sm:text-[12px] leading-tight md:text-[17px]">Convenient Payment Options<br className="md:hidden" /></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Categories removed — moved to side drawer */}

                        {/* --- CAKES AVAILABLE TODAY --- */}
                        <div className="mb-4">
                            <h2 className="text-[18px] md:text-[21px] font-bold text-gray-900 mb-3">Shop Cake Designs Available for Rush Orders</h2>
                            <div className="flex overflow-x-auto gap-3 pb-4 md:grid min-[490px]:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 md:gap-6 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                                {quickLinks.map((link, cardIndex) => {
                                    const activeIndex = rushImageIndexes[cardIndex] ?? 0;
                                    return (
                                        <Link
                                            key={link.name}
                                            href={`/search?q=${encodeURIComponent(link.searchTerm)}`}
                                            className="group relative overflow-hidden rounded-2xl aspect-square shadow-sm hover:shadow-lg transition-all duration-300 min-w-[30%] md:min-w-0 block"
                                        >
                                            {link.imageUrls.map((imgUrl, imgIndex) => (
                                                <div
                                                    key={imgUrl}
                                                    className={`absolute inset-0 transition-opacity duration-1500 ease-in-out ${imgIndex === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                                        }`}
                                                >
                                                    <LazyImage
                                                        src={imgUrl}
                                                        alt={link.name}
                                                        title={link.name}
                                                        className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500`}
                                                        priority={imgIndex === 0}
                                                        fill
                                                    />
                                                </div>
                                            ))}
                                            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end p-3 md:p-4 z-20">
                                                <span className="text-white font-bold text-xs md:text-base leading-tight">{link.name}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --- FEATURED COLLECTIONS SECTION --- */}
                        <FeaturedCollections categories={categories} />

                        {/* --- POPULAR DESIGNS SECTION --- */}
                        <div className="mt-6 md:mt-8">
                            <PopularDesigns designs={popularDesigns} />
                        </div>

                        {/* --- SHOP BY OCCASION (SEO Links) - REMOVED AS REQUESTED --- */}

                        {/* Server-rendered merchants and products sections */}
                        {children}

                        {/* --- BLOG SECTION: LATEST TRENDS --- */}
                        <div className="mt-6 md:mt-8">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[18px] md:text-[21px] font-bold text-gray-900 leading-tight">What are the latest custom cake trends in Cebu?</h2>
                                <Link href="/blog" className="group flex items-center gap-1 md:gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors text-[13px] md:text-base shrink-0">
                                    View all
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {[...getAllBlogPosts()]
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .slice(0, 3)
                                    .map((post) => {
                                        const imageUrl = post.image || post.content.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || post.content.match(/!\[.*?\]\((.*?)\)/i)?.[1];
                                        return (
                                            <Link
                                                key={post.slug}
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
                                        );
                                    })}
                            </div>
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

            {/* --- MOBILE SIDE MENU DRAWER --- */}
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
                        {/* X icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">

                    {/* Shop by Occasion — collapsible accordion */}
                    <div>
                        <button
                            onClick={() => setIsOccasionOpen(prev => !prev)}
                            className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px]"
                            aria-expanded={isOccasionOpen}
                        >
                            <span className="text-xl w-7 text-center leading-none">🎂</span>
                            <span className="flex-1 text-left">Shop by Occasion</span>
                            {/* Chevron icon rotates when open */}
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

                        {/* Collapsible list of occasions */}
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
                        { label: 'How to Order', href: '/how-to-order', emoji: '📋' },
                        { label: 'Payment Options', href: '/payment-options', emoji: '💳' },
                        { label: 'Delivery Rates', href: '/delivery-rates', emoji: '🚚' },
                        { label: 'Partner Bakeshops', href: '/merchants', emoji: '🏪' },
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
                    <p className="text-xs text-gray-400 text-center">© {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p>
                </div>
            </aside>
        </div >
    );
};

export default LandingClient;
