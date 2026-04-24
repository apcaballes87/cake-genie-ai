'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

import Link from 'next/link';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import LazyImage from '@/components/LazyImage';
import { ImageWithSkeleton } from '@/components/ImageWithSkeleton';
import { showError, showLoading, showInfo } from '@/lib/utils/toast';
import MobileBottomNav from '@/components/MobileBottomNav';
import SameDayCutoffBanner from '@/components/SameDayCutoffBanner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { CakeGenieReview } from '@/lib/database.types';
import { getReviewDisplayName } from '@/lib/reviews';
import { BlogHomepagePreview } from '@/services/supabaseService';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { batchSaveToLocalStorage } from '@/contexts/CartContext';
import { COMMON_ASSETS } from '@/constants';
import { trackImageUpload } from '@/lib/analytics';
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
    Truck,
    Zap,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    X,
    Clock,
    Calendar
} from 'lucide-react';

const ImageUploader = dynamic(
    () => import('@/components/ImageUploader').then((mod) => mod.ImageUploader),
    { ssr: false }
);

interface LandingClientProps {
    children?: React.ReactNode;
    blogPosts?: BlogHomepagePreview[];
    reviews?: CakeGenieReview[];
}

const HERO_HEADLINE_VARIANTS = [
    'Custom Cakes',
    'Minimalist Cakes',
    'Vintage Cakes',
    'Floral Cakes',
    'Photo Cakes',
    'Bento Cakes',
    'Doodle Cakes',
] as const;
const HERO_HEADLINE_A11Y_LABEL = 'Custom Cakes, Minimalist Cakes, Vintage Cakes, Floral Cakes, Photo Cakes, Bento Cakes, and Doodle Cakes.';
const HERO_PRODUCTS = [
    {
        title: 'Minimalist Cakes',
        price: 999,
        size: '6" Round 3" Height',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-minimalist-cake.webp',
        headlineVariant: 1,
    },
    {
        title: 'Vintage Cakes',
        price: 1199,
        size: '6" Round 4" Height',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-vintage-cake.webp',
        headlineVariant: 2,
    },
    {
        title: 'Doodle Cakes',
        price: 999,
        size: '6" Round 3" Height',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-doodle-cake.webp',
        headlineVariant: 6,
    },
    {
        title: 'Edible Photo Cakes',
        price: 1099,
        size: '6" Round 3" Height',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-edible-photo-cake.webp',
        headlineVariant: 4,
    },
    {
        title: 'Floral Cakes',
        price: 1199,
        size: '6" Round 4" Height',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-floral-cake.webp',
        headlineVariant: 3,
    },
    {
        title: 'Bento Cakes',
        price: 499,
        size: '4" Round 2" Height',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-bento-cake.webp',
        headlineVariant: 5,
    },
] as const;

const getHeroAvailabilityConfig = (title: string, isDesktop: boolean = false) => {
    const isRush = ['Bento Cakes', 'Minimalist Cakes', 'Doodle Cakes'].includes(title);
    if (isRush) {
        return {
            text: 'Rush Order! Ready in 60 mins',
            Icon: Zap,
            bannerClass: isDesktop ? 'bg-green-100/80 text-green-900' : 'bg-green-100 text-green-800',
            iconClass: isDesktop ? 'text-green-900' : 'text-green-800',
            invertedCornerClass: isDesktop ? 'bg-green-100/80' : 'bg-green-100'
        };
    }
    return {
        text: 'Same-Day Order! Ready in 3 hours',
        Icon: Clock,
        bannerClass: isDesktop ? 'bg-blue-100/80 text-blue-900' : 'bg-blue-100 text-blue-800',
        iconClass: isDesktop ? 'text-blue-900' : 'text-blue-800',
        invertedCornerClass: isDesktop ? 'bg-blue-100/80' : 'bg-blue-100'
    };
};

const subscribeToHydration = () => () => { };

type HeroUploadState = 'idle' | 'analyzing' | 'done' | 'error';

type HeroAnalysisSummary = {
    price: number | null;
    size: string | null;
    availability: 'rush' | 'same-day' | 'normal' | null;
    slug: string | null;
};

const HeroTypingHeadlineLine: React.FC<{ className?: string; controlledPhraseIndex?: number }> = ({ className = '', controlledPhraseIndex }) => {
    const [phraseIndex, setPhraseIndex] = useState(controlledPhraseIndex ?? 0);
    const [displayText, setDisplayText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const prevControlledRef = useRef(controlledPhraseIndex);
    const pendingIndexRef = useRef<number | null>(null);

    // When the controlled index changes externally, queue deletion + re-type
    useEffect(() => {
        if (controlledPhraseIndex !== undefined && controlledPhraseIndex !== prevControlledRef.current) {
            prevControlledRef.current = controlledPhraseIndex;
            pendingIndexRef.current = controlledPhraseIndex;
            const timeoutId = setTimeout(() => setIsDeleting(true), 0);
            return () => clearTimeout(timeoutId);
        }
    }, [controlledPhraseIndex]);

    useEffect(() => {
        const currentPhrase = HERO_HEADLINE_VARIANTS[phraseIndex];
        let timeoutId: ReturnType<typeof setTimeout>;

        if (!isDeleting && displayText === currentPhrase) {
            // Controlled mode with no pending change — stay on current phrase
            if (controlledPhraseIndex !== undefined && pendingIndexRef.current === null) return;
            timeoutId = setTimeout(() => setIsDeleting(true), 900);
        } else if (isDeleting && displayText.length === 0) {
            timeoutId = setTimeout(() => {
                setIsDeleting(false);
                if (pendingIndexRef.current !== null) {
                    // Switch to the requested phrase
                    setPhraseIndex(pendingIndexRef.current);
                    pendingIndexRef.current = null;
                } else if (controlledPhraseIndex === undefined) {
                    // Free-running auto-cycle
                    setPhraseIndex((currentIndex) => (currentIndex + 1) % HERO_HEADLINE_VARIANTS.length);
                }
            }, 150);
        } else {
            timeoutId = setTimeout(() => {
                const nextLength = isDeleting ? displayText.length - 1 : displayText.length + 1;
                setDisplayText(currentPhrase.slice(0, nextLength));
            }, isDeleting ? 34 : 56);
        }

        return () => clearTimeout(timeoutId);
    }, [displayText, isDeleting, phraseIndex, controlledPhraseIndex]);

    return (
        <span className={className} aria-label={HERO_HEADLINE_A11Y_LABEL}>
            <span aria-hidden="true" className="italic">{displayText}</span>
            <span
                aria-hidden="true"
                className="ml-1 inline-block h-[0.92em] w-[3px] translate-y-[2px] bg-purple-500 align-middle animate-pulse"
            />
        </span>
    );
};

function HeroProductPeekCarousel({
    heroProductIndex,
    onSelectProduct,
    onInteraction,
    cardSpacingClassName = 'mx-1',
    cardFlexStyle = '0 0 min(calc(50% - 8px), 232px)',
}: {
    heroProductIndex: number;
    onSelectProduct: (index: number) => void;
    onInteraction?: () => void;
    cardSpacingClassName?: string;
    cardFlexStyle?: string;
}) {
    const wheelGestures = useMemo(() => [WheelGesturesPlugin()], []);
    const [emblaRef, emblaApi] = useEmblaCarousel(
        {
            align: 'center',
            dragFree: false,
            duration: 28,
            loop: true,
            skipSnaps: false,
        },
        wheelGestures
    );

    useEffect(() => {
        if (!emblaApi || emblaApi.selectedScrollSnap() === heroProductIndex) return;
        emblaApi.scrollTo(heroProductIndex);
    }, [emblaApi, heroProductIndex]);

    useEffect(() => {
        if (!emblaApi) return;

        const syncSelectedProduct = () => {
            onSelectProduct(emblaApi.selectedScrollSnap());
        };

        syncSelectedProduct();
        emblaApi.on('select', syncSelectedProduct);
        emblaApi.on('reInit', syncSelectedProduct);

        // Listen for actual user interaction
        const handlePointerDown = () => onInteraction?.();
        const handleScroll = () => {
            // Only trigger if it's not a programmatic scroll
            if (emblaApi.internalEngine().scrollBody.velocity() !== 0) {
                onInteraction?.();
            }
        };

        emblaApi.on('pointerDown', handlePointerDown);
        emblaApi.on('scroll', handleScroll);

        return () => {
            emblaApi.off('select', syncSelectedProduct);
            emblaApi.off('reInit', syncSelectedProduct);
            emblaApi.off('pointerDown', handlePointerDown);
            emblaApi.off('scroll', handleScroll);
        };
    }, [emblaApi, onSelectProduct, onInteraction]);

    const handleProductClick = (index: number) => {
        onInteraction?.();
        onSelectProduct(index);
        emblaApi?.scrollTo(index);
    };

    return (
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-transparent">
            <div ref={emblaRef} className="h-full overflow-hidden cursor-grab active:cursor-grabbing">
                <div className="flex h-full touch-pan-y">
                    {HERO_PRODUCTS.map((product, productIndex) => {
                        const isCenter = productIndex === heroProductIndex;

                        return (
                            <button
                                key={product.title}
                                type="button"
                                onClick={() => handleProductClick(productIndex)}
                                aria-label={isCenter ? `${product.title} example` : `View ${product.title}`}
                                className={`relative ${cardSpacingClassName} h-full min-w-0 overflow-hidden rounded-[1.35rem] bg-transparent transition-shadow duration-500 ease-out ${isCenter ? 'shadow-[0_18px_45px_-28px_rgba(15,23,42,0.75)]' : ''
                                    }`}
                                style={{ flex: cardFlexStyle }}
                            >
                                <img
                                    src={product.image}
                                    alt={isCenter ? `${product.title} example` : ''}
                                    aria-hidden={!isCenter}
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                    loading={productIndex === 0 ? 'eager' : 'lazy'}
                                />
                                {isCenter && (
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-1.5">
                {HERO_PRODUCTS.map((_, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => handleProductClick(i)}
                        aria-label={`View ${HERO_PRODUCTS[i].title}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === heroProductIndex ? 'w-5 bg-white shadow-sm' : 'w-1.5 bg-white/55 hover:bg-white/80'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}

function HeroProductPreviewStack({
    heroProductIndex,
    heroUploadState,
    heroUploadedImageSrc,
    heroProgressAnimate,
    heroAnalysis,
    heroUploadError,
    onPrev,
    onNext,
    onSelectProduct,
    onInteraction,
    onOpenUploader,
    onResetUpload,
    onResultAction,
}: {
    heroProductIndex: number;
    heroUploadState: HeroUploadState;
    heroUploadedImageSrc: string | null;
    heroProgressAnimate: boolean;
    heroAnalysis: HeroAnalysisSummary;
    heroUploadError: string | null;
    onPrev: () => void;
    onNext: () => void;
    onSelectProduct: (index: number) => void;
    onInteraction: () => void;
    onOpenUploader: () => void;
    onResetUpload: () => void;
    onResultAction: () => void;
}) {
    if (heroUploadState === 'idle') {
        return (
            <>
                <div className="relative -mx-4 md:mx-auto md:w-full md:max-w-[480px] min-[505px]:[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] min-[505px]:[-webkit-mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
                    <div className="overflow-hidden bg-transparent">
                        <HeroProductPeekCarousel 
                            heroProductIndex={heroProductIndex} 
                            onSelectProduct={onSelectProduct} 
                            onInteraction={onInteraction}
                        />
                    </div>
                    <button
                        onClick={onPrev}
                        aria-label="Previous cake design"
                        className="absolute left-2 top-[45%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-lg transition-all active:scale-95"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={onNext}
                        aria-label="Next cake design"
                        className="absolute right-2 top-[45%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-lg transition-all active:scale-95"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>


                {/* Primary CTA - Mobile */}
                <div className="mx-auto w-full max-w-[480px] mt-2 mb-1">
                    <button
                        onClick={onOpenUploader}
                        className="genie-btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 px-3 font-bold active:scale-[0.98] shadow-md shadow-purple-50/50"
                    >
                        <ImagePlus size={20} className="shrink-0" />
                        <span className="whitespace-nowrap text-[12px] min-[360px]:text-[13px] min-[390px]:text-sm">Upload Your Design - Get Instant Pricing</span>
                    </button>
                </div>

            </>
        );
    }

    return (
        <>
            <div className="relative mx-auto w-full max-w-[480px]">
                <div className="overflow-hidden bg-transparent">
                    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl">
                        {heroUploadedImageSrc && (
                            <img
                                src={heroUploadedImageSrc}
                                alt="Your uploaded cake design"
                                className="h-full w-full object-cover animate-in fade-in duration-500"
                            />
                        )}
                        {heroUploadState === 'analyzing' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent px-5 pb-5">
                                <div className="w-full space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" />
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-white">Analyzing your cake design...</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-500"
                                            style={{
                                                width: heroProgressAnimate ? '100%' : '0%',
                                                transition: heroProgressAnimate ? 'width 11s linear' : 'none',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {heroUploadState === 'done' && (
                            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-green-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                Analysis complete
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={onResetUpload}
                    aria-label="Back to cake designs"
                    className="absolute -right-3 -top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow transition-all hover:text-neutral-900"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-xl">
                {heroUploadState === 'analyzing' ? (
                    <div className="relative flex items-center justify-center gap-2 bg-neutral-100 px-4 py-2 rounded-t-[23px]">
                        <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
                        <span className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Calculating availability...</span>
                        
                        {/* Inverted Corner Left */}
                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-neutral-100" />
                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                        </div>
                        {/* Inverted Corner Right */}
                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-full bg-neutral-100" />
                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                        </div>
                    </div>
                ) : heroUploadState === 'error' ? (
                    <div className="relative bg-red-50 px-4 py-2 text-center text-[9px] font-bold uppercase tracking-wide text-red-700 rounded-t-[23px]">
                        {heroUploadError ?? 'AI analysis is temporarily unavailable.'}
                        
                        {/* Inverted Corner Left */}
                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-red-50" />
                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                        </div>
                        {/* Inverted Corner Right */}
                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-full bg-red-50" />
                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                        </div>
                    </div>
                ) : heroAnalysis.availability === 'rush' ? (
                    <div className="relative flex items-center justify-center gap-2 bg-green-100 px-4 py-2 text-center rounded-t-[23px]">
                        <Zap className="h-3 w-3 text-green-800" />
                        <span className="text-[9px] font-bold text-green-800 uppercase tracking-wide">Rush Order! Ready in 60 mins</span>
                        
                        {/* Inverted Corner Left */}
                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-green-100" />
                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                        </div>
                        {/* Inverted Corner Right */}
                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-full bg-green-100" />
                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                        </div>
                    </div>
                ) : heroAnalysis.availability === 'same-day' ? (
                    <div className="relative bg-blue-100 px-4 py-2 text-center text-[9px] font-bold text-blue-800 rounded-t-[23px]">
                        Same-Day Order! Ready in 3 hours
                        
                        {/* Inverted Corner Left */}
                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-blue-100" />
                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                        </div>
                        {/* Inverted Corner Right */}
                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-full bg-blue-100" />
                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                        </div>
                    </div>
                ) : (
                    <div className="relative bg-blue-100 px-4 py-2 text-center text-[9px] font-bold text-blue-800 rounded-t-[23px]">
                        Freshly Baked. Ready for Delivery Tomorrow
                        
                        {/* Inverted Corner Left */}
                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-blue-100" />
                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                        </div>
                        {/* Inverted Corner Right */}
                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-full bg-blue-100" />
                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                        </div>
                    </div>
                )}

                <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 flex-col">
                        {heroUploadState === 'analyzing' ? (
                            <>
                                <div className="h-7 w-24 rounded-lg bg-neutral-100 animate-pulse" />
                                <div className="mt-1.5 h-3 w-32 rounded bg-neutral-100 animate-pulse" />
                            </>
                        ) : (
                            <>
                                <p className="text-2xl font-black leading-none tracking-tight text-neutral-900 animate-in fade-in slide-in-from-bottom-1 duration-300">
                                    {heroUploadState === 'error' ? 'Unavailable' : heroAnalysis.price != null ? `₱${heroAnalysis.price.toLocaleString()}` : '-'}
                                </p>
                                <p className="mt-1 text-[11px] font-bold uppercase tracking-tight text-neutral-500 animate-in fade-in duration-300">
                                    {heroUploadState === 'error' ? 'Please try again later' : heroAnalysis.size ?? 'Starting price'}
                                </p>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                onResetUpload();
                                onOpenUploader();
                            }}
                            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 active:scale-[0.98] shadow-sm"
                            aria-label="Upload another cake image"
                        >
                            <ImagePlus size={18} />
                        </button>
                        <button
                            disabled={heroUploadState === 'analyzing' || (heroUploadState !== 'error' && !heroAnalysis.slug)}
                            onClick={onResultAction}
                            className="shrink-0 whitespace-nowrap rounded-2xl bg-neutral-200 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black border border-neutral-300 hover:bg-neutral-300 transition-colors active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
                        >
                            {heroUploadState === 'analyzing' ? 'Analyzing...' : heroUploadState === 'error' ? 'Upload another' : 'Order This Cake'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function DemoCakeAddOnOverlays({ showDrip, showBoard, showFlowers }: { showDrip: boolean; showBoard: boolean; showFlowers: boolean }) {
    if (!showDrip && !showBoard && !showFlowers) return null;

    const flower = (
        <div className="relative h-full w-full">
            <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-rose-200 shadow-sm" />
            <span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-pink-300 shadow-sm" />
            <span className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-fuchsia-200 shadow-sm" />
            <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-rose-300 shadow-sm" />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-100 shadow-sm" />
        </div>
    );

    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {showBoard && (
                <div className="absolute bottom-[9%] left-[17%] right-[17%] h-[11%] rounded-[999px] border border-rose-100/90 bg-white/65 shadow-[0_20px_36px_-24px_rgba(15,23,42,0.85)] backdrop-blur-[1px]" />
            )}

            {showDrip && (
                <div className="absolute left-[24%] right-[24%] top-[20%] h-[10%] rounded-b-[2rem] rounded-t-md bg-rose-300/70 shadow-[0_14px_28px_-18px_rgba(190,24,93,0.95)]">
                    <span className="absolute left-[12%] top-[72%] h-7 w-2.5 rounded-full bg-rose-300/75" />
                    <span className="absolute left-[35%] top-[58%] h-5 w-2 rounded-full bg-rose-300/75" />
                    <span className="absolute right-[16%] top-[68%] h-8 w-2.5 rounded-full bg-rose-300/75" />
                </div>
            )}

            {showFlowers && (
                <>
                    <div className="absolute left-[23%] top-[18%] h-8 w-8 rotate-[-18deg] drop-shadow-sm">{flower}</div>
                    <div className="absolute right-[24%] top-[20%] h-8 w-8 rotate-[14deg] drop-shadow-sm">{flower}</div>
                    <div className="absolute bottom-[22%] right-[28%] h-7 w-7 rotate-[28deg] drop-shadow-sm">{flower}</div>
                </>
            )}
        </div>
    );
}

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
    onTryItClick: () => void;
}

const DEMO_MESSAGE = "Happy Birthday, Sarah! 🎉";

const InteractiveCustomizer: React.FC<InteractiveCustomizerProps> = ({ tiers, flavors, icings, toppers, onTryItClick }) => {
    const [selectedTier, setSelectedTier] = useState(2); // Start with Bento
    const [selectedFlavor, setSelectedFlavor] = useState(0);
    const [icingOn, setIcingOn] = useState<Record<string, boolean>>({ 'Body Icing': false, 'Drip': false, 'Base Border': false, 'Top Border': false, 'Top Icing': false, 'Board': false });
    const [selectedToppers, setSelectedToppers] = useState<Set<string>>(new Set());
    const [cakeMessage, setCakeMessage] = useState('');
    const [showTypingCursor, setShowTypingCursor] = useState(false);
    const [showPriceBadge, setShowPriceBadge] = useState(false);
    const [highlightedOption, setHighlightedOption] = useState<string | null>('Bento');
    const [annotation, setAnnotation] = useState<string | null>('Bento — ₱399');
    const [annotationKey, setAnnotationKey] = useState(0);

    // Trigger annotation animation on mount
    useEffect(() => {
        setAnnotationKey(1);
    }, []);
    const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);

    const isAutoPlayingRef = useRef(true);
    const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevPriceRef = useRef(0);
    const demoRef = useRef<HTMLDivElement>(null);
    const [isDemoVisible, setIsDemoVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const priceHeading = document.getElementById('price-change-heading');
            const rushHeading = document.getElementById('rush-orders-heading');

            if (!priceHeading || !rushHeading) return;

            const screenHeight = window.innerHeight;
            const priceRect = priceHeading.getBoundingClientRect();
            const rushRect = rushHeading.getBoundingClientRect();

            const priceTriggerPoint = screenHeight * 0.5;
            const rushTriggerPoint = screenHeight * 0.75;

            const priceAtThreshold = priceRect.top <= priceTriggerPoint && priceRect.bottom > 0;
            const rushAtThreshold = rushRect.top <= rushTriggerPoint && rushRect.bottom > 0;

            setIsDemoVisible(priceAtThreshold && !rushAtThreshold);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const tier = tiers[selectedTier];
    const icingAddon = icings.reduce((sum, i) => sum + (icingOn[i.label] ? i.addonPrice : 0), 0);
    const topperAddon = selectedToppers.size * 100;
    const totalPrice = tier.price + icingAddon + topperAddon;

    const hasDrip = icingOn['Drip'];
    const hasBoard = icingOn['Board'];
    const hasSugarFlowers = selectedToppers.has('Sugar Flowers');
    const twoTierDripVariantSrc = tier.label === '2 Tier' && hasDrip
        ? hasSugarFlowers && hasBoard
            ? 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake-drip-roses-base.webp'
            : hasSugarFlowers
                ? 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake-drip-roses.webp'
                : 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake-drip.webp'
        : null;
    const targetImageSrc = twoTierDripVariantSrc ?? tier.src;
    const isUsingTwoTierDripVariant = Boolean(twoTierDripVariantSrc);
    const showDemoDripOverlay = hasDrip && !isUsingTwoTierDripVariant;
    const showDemoBoardOverlay = hasBoard && !(isUsingTwoTierDripVariant && hasSugarFlowers && hasBoard);
    const showDemoFlowersOverlay = hasSugarFlowers && !(isUsingTwoTierDripVariant && hasSugarFlowers);
    const [displayedImageSrc, setDisplayedImageSrc] = useState(targetImageSrc);
    const [imgVisible, setImgVisible] = useState(true);
    const imgFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (targetImageSrc === displayedImageSrc) return;
        if (imgFadeTimerRef.current) clearTimeout(imgFadeTimerRef.current);
        setImgVisible(false);
        imgFadeTimerRef.current = setTimeout(() => {
            setDisplayedImageSrc(targetImageSrc);
            setImgVisible(true);
        }, 250);
        return () => { if (imgFadeTimerRef.current) clearTimeout(imgFadeTimerRef.current); };
    }, [targetImageSrc]);

    // Track price direction for animation
    useEffect(() => {
        if (prevPriceRef.current !== 0 && prevPriceRef.current !== totalPrice) {
            setPriceDirection(totalPrice > prevPriceRef.current ? 'up' : 'down');
            const timer = setTimeout(() => setPriceDirection(null), 500);
            prevPriceRef.current = totalPrice;
            return () => clearTimeout(timer);
        }
        prevPriceRef.current = totalPrice;
    }, [totalPrice]);

    const stopAutoPlay = useCallback(() => {
        isAutoPlayingRef.current = false;
        if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setHighlightedOption(null);
        setAnnotation(null);
        setShowTypingCursor(false);
        setShowPriceBadge(false);
    }, []);

    // Auto-play demo sequence
    useEffect(() => {
        const scheduleStep = (fn: () => void, delay: number) => {
            autoPlayTimerRef.current = setTimeout(() => {
                if (!isAutoPlayingRef.current) return;
                fn();
            }, delay);
        };

        const runDemo = () => {
            if (!isAutoPlayingRef.current) return;

            // Step 1: Show Bento (already selected on start, just annotate)
            scheduleStep(() => {
                setHighlightedOption('Bento');
                setAnnotation('Bento — ₱399');
                setAnnotationKey(prev => prev + 1);

                // Step 2: Switch to 1 Tier
                scheduleStep(() => {
                    setSelectedTier(0);
                    setHighlightedOption('1 Tier');
                    setAnnotation('1 Tier — ₱1,500');

                    // Step 3: Switch to 2 Tier
                    scheduleStep(() => {
                        setSelectedTier(1);
                        setHighlightedOption('2 Tier');
                        setAnnotation('2 Tier — ₱2,500');
                        setAnnotationKey(prev => prev + 1);

                        // Step 4: Toggle Drip
                        scheduleStep(() => {
                            setHighlightedOption('Drip');
                            setAnnotation('Drip Icing — +₱100');
                            setAnnotationKey(prev => prev + 1);
                            setIcingOn(prev => ({ ...prev, 'Drip': true }));

                            // Step 5: Add Sugar Flowers
                            scheduleStep(() => {
                                setHighlightedOption('Sugar Flowers');
                                setAnnotation('Sugar Flowers — +₱100');
                                setAnnotationKey(prev => prev + 1);
                                setSelectedToppers(new Set(['Sugar Flowers']));

                                // Step 5.5: Toggle Board
                                scheduleStep(() => {
                                    setHighlightedOption('Board');
                                    setAnnotation('Red Gumpaste Cover — +₱100');
                                    setAnnotationKey(prev => prev + 1);
                                    setIcingOn(prev => ({ ...prev, 'Board': true }));

                                    // Step 6: Show price badge
                                    scheduleStep(() => {
                                        setHighlightedOption(null);
                                        setAnnotation(null);
                                        setShowPriceBadge(true);

                                        // Step 7: Reset and loop
                                        scheduleStep(() => {
                                            setShowPriceBadge(false);
                                            setSelectedTier(2); // Reset to Bento
                                            setSelectedFlavor(0);
                                            setIcingOn({ 'Body Icing': false, 'Drip': false, 'Base Border': false, 'Top Border': false, 'Top Icing': false, 'Board': false });
                                            setSelectedToppers(new Set());
                                            setCakeMessage('');
                                            setAnnotation(null);
                                            setHighlightedOption(null);

                                            scheduleStep(() => runDemo(), 1400);
                                        }, 2100);
                                    }, 1400);
                                }, 1400);
                            }, 1400);
                        }, 1400);
                    }, 1400);
                }, 1400);
            }, 700);
        };

        runDemo();

        return () => {
            if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        };
    }, []);

    const handleTierClick = (i: number) => { stopAutoPlay(); setSelectedTier(i); };
    const handleFlavorClick = (i: number) => { stopAutoPlay(); setSelectedFlavor(i); };
    const handleIcingToggle = (label: string) => {
        stopAutoPlay();
        setIcingOn(prev => ({ ...prev, [label]: !prev[label] }));
    };
    const handleTopperToggle = (label: string) => {
        stopAutoPlay();
        setSelectedToppers(prev => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label); else next.add(label);
            return next;
        });
    };

    return (
        <div ref={demoRef}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                {/* Left: Cake Preview */}
                <div className="lg:col-span-3 relative">
                    {/* Live Demo badge */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-semibold text-slate-700">Live Demo</span>
                    </div>

                    {/* Cake image */}
                    <div className={`relative w-full aspect-4/3 overflow-hidden bg-linear-to-br from-slate-100 to-slate-50 transition-all duration-300 group-hover:scale-[1.02] shadow-sm rounded-3xl`}>
                        <img
                            src={displayedImageSrc}
                            alt={`${tier.label} cake preview`}
                            className="w-full h-full object-cover"
                            style={{ opacity: imgVisible ? 1 : 0, transition: 'opacity 0.25s ease-in-out' }}
                        />


                        {/* Floating annotation during auto-play */}
                        {annotation && (
                            <div
                                key={annotationKey}
                                className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg animate-annotation-fade-in"
                            >
                                <span className="text-[10px] font-bold text-purple-400">{annotation}</span>
                            </div>
                        )}



                        {/* Price badge overlay */}
                        {showPriceBadge && (
                            <div className="absolute inset-0 flex items-center justify-center animate-annotation-fade-in">
                                <div className="bg-purple-400 rounded-2xl px-6 py-4 shadow-2xl flex flex-col items-center gap-2">
                                    <span className="text-3xl font-extrabold text-white tracking-tight">₱{totalPrice.toLocaleString()}</span>
                                    <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2">
                                        <ShoppingBag size={15} className="text-purple-400" />
                                        <span className="text-sm font-bold text-purple-700">Add to Cart</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Right: Options Panel */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                    {/* Cake Type */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3.5 shadow-sm border border-slate-100">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Cake Type</label>
                        <div className="flex gap-2">
                            {tiers.map((t, i) => (
                                <button
                                    key={t.label}
                                    onClick={() => handleTierClick(i)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${selectedTier === i
                                            ? 'bg-purple-400 text-white shadow-md scale-[1.02]'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        } ${highlightedOption === t.label ? 'animate-option-glow' : ''}`}
                                >
                                    {t.label}
                                    <span className="block text-[10px] opacity-70">₱{t.price.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>
                    </div>


                    {/* Icing Details & Toppers */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3.5 shadow-sm border border-slate-100">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Icing Details &amp; Toppers</label>
                        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1 px-1 -mx-1">
                            {icings.map((ic) => (
                                <button
                                    key={ic.label}
                                    onClick={() => handleIcingToggle(ic.label)}
                                    className={`shrink-0 flex flex-col items-center gap-1 min-w-[46px] ${highlightedOption === ic.label ? 'animate-option-glow rounded-full' : ''}`}
                                >
                                    <div className={`w-12 h-12 rounded-full border border-slate-200 overflow-hidden bg-white p-2 shadow-sm flex items-center justify-center transition-all duration-200 ${icingOn[ic.label]
                                            ? 'ring-2 ring-purple-500 bg-purple-50'
                                            : 'hover:border-purple-300'
                                        } ${highlightedOption === ic.label ? 'ring-2 ring-purple-400' : ''}`}>
                                        <img src={ic.src} alt={ic.label} className="w-full h-full object-contain" />
                                    </div>
                                    <span className="text-[9px] text-center text-slate-600 font-medium leading-tight max-w-[52px] line-clamp-2 mt-0.5">{ic.label}</span>
                                    {ic.addonPrice > 0 && (
                                        <span className="text-[8px] text-purple-500 font-semibold">+₱{ic.addonPrice}</span>
                                    )}
                                </button>
                            ))}

                            {/* Divider */}
                            <div className="shrink-0 w-px bg-slate-200 self-stretch mx-1" />

                            {toppers.map((tp) => (
                                <button
                                    key={tp.label}
                                    onClick={() => handleTopperToggle(tp.label)}
                                    className={`shrink-0 flex flex-col items-center gap-1 min-w-[46px] p-1 rounded-lg transition-all duration-200 ${selectedToppers.has(tp.label)
                                            ? 'bg-purple-50 border-2 border-purple-400'
                                            : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                        } ${highlightedOption === tp.label ? 'animate-option-glow' : ''}`}
                                >
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl leading-none">
                                        {tp.emoji}
                                    </div>
                                    <span className="text-[9px] text-center text-slate-600 font-medium leading-tight max-w-[52px] line-clamp-2 mt-0.5">{tp.label}</span>
                                    <span className="text-[8px] text-purple-500 font-semibold">+₱100</span>
                                </button>
                            ))}
                        </div>
                    </div>



                    {/* Price Bar */}
                    <div className="bg-purple-400 rounded-2xl p-3.5 shadow-xl">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="relative h-8 overflow-hidden flex items-center">
                                    <span
                                        key={totalPrice}
                                        className={`text-xl font-extrabold text-white inline-block ${priceDirection === 'up' ? 'animate-price-slide-in-up' :
                                                priceDirection === 'down' ? 'animate-price-slide-in-down' : ''
                                            }`}
                                    >
                                        ₱{totalPrice.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    <span className="text-[11px] text-white/80 font-medium">Same-day delivery</span>
                                </div>
                            </div>
                            <button
                                onClick={onTryItClick}
                                    className="genie-btn-secondary font-bold py-2 px-4 rounded-xl text-sm whitespace-nowrap hover:scale-[1.02]"
                            >
                                Try It Yourself
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky mobile price bar — visible only while demo section is on screen */}
            <div className={`lg:hidden fixed bottom-20 left-0 right-0 z-50 px-4 transition-all duration-500 ${isDemoVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className="bg-purple-400 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
                    <div>
                        <span className="text-xl font-extrabold text-white">₱{totalPrice.toLocaleString()}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedTier === 1 ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
                            <span className="text-[11px] text-white/80 font-medium">
                                {selectedTier === 1 ? '1-day lead time' : 'Same-day delivery'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onTryItClick}
                        className="genie-btn-secondary font-bold py-2 px-4 rounded-xl text-sm whitespace-nowrap"
                    >
                        Try It Yourself
                        <ArrowRight size={14} />
                    </button>
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

const LandingClient: React.FC<LandingClientProps> = ({ children, blogPosts = [], reviews = [] }) => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('home');
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOccasionOpen, setIsOccasionOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [reviewZoomSrc, setReviewZoomSrc] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const heroMobilePreviewRef = useRef<HTMLElement>(null);
    const uploadToastId = useRef<string | null>(null);
    const isMounted = React.useSyncExternalStore(subscribeToHydration, () => true, () => false);

    const [heroProductIndex, setHeroProductIndex] = useState(0);
    const [hasInteractedWithHero, setHasInteractedWithHero] = useState(false);

    // ── Hero upload analysis state ─────────────────────────────────────────
    const [heroUploadState, setHeroUploadState] = useState<HeroUploadState>('idle');
    const [heroUploadedImageSrc, setHeroUploadedImageSrc] = useState<string | null>(null);
    const [heroProgressAnimate, setHeroProgressAnimate] = useState(false);
    const [heroAnalysis, setHeroAnalysis] = useState<HeroAnalysisSummary>({ price: null, size: null, availability: null, slug: null });
    const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
    // ───────────────────────────────────────────────────────────────────────

    const handleHeroPrev = useCallback(() => {
        setHeroProductIndex((prev) => (prev - 1 + HERO_PRODUCTS.length) % HERO_PRODUCTS.length);
        setHasInteractedWithHero(true);
    }, []);

    const handleHeroNext = useCallback(() => {
        setHeroProductIndex((prev) => (prev + 1) % HERO_PRODUCTS.length);
        setHasInteractedWithHero(true);
    }, []);

    const resetHeroUploadPreview = useCallback(() => {
        setHeroUploadState('idle');
        setHeroUploadedImageSrc(null);
        setHeroUploadError(null);
    }, []);

    const handleHeroResultAction = useCallback(() => {
        if (heroUploadState === 'error') {
            resetHeroUploadPreview();
            setIsUploaderOpen(true);
            return;
        }

        if (heroAnalysis.slug) {
            router.push(`/customizing/${heroAnalysis.slug}`);
        }
    }, [heroAnalysis.slug, heroUploadState, resetHeroUploadPreview, router]);

    // Trigger progress-bar CSS transition one tick after analysis starts
    useEffect(() => {
        const t = setTimeout(
            () => setHeroProgressAnimate(heroUploadState === 'analyzing'),
            heroUploadState === 'analyzing' ? 50 : 0
        );
        return () => clearTimeout(t);
    }, [heroUploadState]);

    useEffect(() => {
        const handleOpenUploadModal = () => {
            setIsUploaderOpen(true);
        };

        window.addEventListener('genie:open-upload-modal', handleOpenUploadModal);
        return () => window.removeEventListener('genie:open-upload-modal', handleOpenUploadModal);
    }, []);

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
            const filename = `customizations/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;

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
            resetHeroUploadPreview();
            setIsUploading(true);
            uploadToastId.current = showLoading('Uploading your design...');
            trackImageUpload('landing');

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

        void processUpload();
    }, [isUploading, resetHeroUploadPreview, router]);

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
            if (!r.comment) continue;
            const orderItem = r.order_item ?? null;
            const photos = r.photos?.length
                ? r.photos
                : orderItem?.customized_image_url
                    ? [orderItem.customized_image_url]
                    : [];
            const name = getReviewDisplayName(r);
            cards.push({
                id: r.review_id,
                photo: photos.length > 0 ? photos[0] : null,
                rating: r.rating,
                name,
                text: r.comment,
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
        <div id="top" className="font-sans genie-page-bg min-h-screen pb-24 md:pb-0 text-gray-800 flex flex-col">
            {/* Capture discount code from URL without blocking prerender */}
            <Suspense fallback={null}>
                <DiscountCapture />
            </Suspense>

            {/* ========== SAME-DAY CUTOFF COUNTDOWN BANNER ========== */}
            <div className="w-full bg-purple-400 py-[4.5px] flex justify-center items-center">
                <SameDayCutoffBanner />
            </div>

            {/* ========== HEADER ========== */}
            <nav className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    {/* Mobile Header */}
                    <div className="md:hidden relative w-full mb-4" style={{ height: '64px' }}>
                        <div
                            className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center pt-[22px] transition-opacity duration-300"
                            style={{ opacity: showCompactHeader ? 0 : 1, pointerEvents: showCompactHeader ? 'none' : 'auto' }}
                        >
                            <div className="flex items-center">
                                <button
                                    onClick={() => setIsMenuOpen(true)}
                                    className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                    aria-label="Open menu"
                                >
                                    <Menu size={24} />
                                </button>
                            </div>

                            <Link href="/">
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={117}
                                    height={41}
                                    className="h-[41px] w-auto object-contain"
                                />
                            </Link>

                            <div className="flex items-center gap-1 justify-end">
                                <button
                                    onClick={() => window.scrollTo({ top: scrollThreshold + 10, behavior: 'smooth' })}
                                    className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                    aria-label="Search"
                                >
                                    <Search size={24} />
                                </button>
                                <button
                                    onClick={() => router.push('/cart')}
                                    className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                    aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                                >
                                    <ShoppingBag size={24} />
                                    {isMounted && itemCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">
                                            {itemCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div
                            className="absolute inset-0 flex items-center gap-2 pt-[22px] transition-opacity duration-300"
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
                                    inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                                />
                            ) : <div className="flex-1 min-w-0" aria-hidden="true" />}
                            <button
                                onClick={() => router.push('/cart')}
                                className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                            >
                                <ShoppingBag size={24} />
                                {isMounted && itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">
                                        {itemCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Desktop Header: Menu + Logo + Search (left) | Nav + Icons (right) */}
                    <div className="hidden md:flex w-full items-center gap-6 py-[11px]">
                        {/* Left: Menu + Logo + Search Bar */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label="Open menu"
                            >
                                <Menu size={24} />
                            </button>
                            <Link href="/" className="shrink-0">
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={135}
                                    height={43}
                                    className="h-[36px] w-auto object-contain"
                                />
                            </Link>
                            <SearchAutocomplete
                                onSearch={handleSearch}
                                onUploadClick={() => setIsUploaderOpen(true)}
                                placeholder="Search cakes..."
                                value={searchQuery}
                                onChange={setSearchQuery}
                                className="flex-1 max-w-sm ml-4 lg:max-w-lg xl:max-w-2xl"
                                inputClassName="w-full pl-5 pr-12 py-2.5 text-sm bg-white border-purple-100 border rounded-full shadow-sm focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>

                        {/* Right: Nav Links + Account + Cart */}
                        <div className="flex items-center gap-5 lg:gap-6 shrink-0">
                            <Link href="/collections" className="text-sm font-medium genie-link whitespace-nowrap">
                                Browse Cakes
                            </Link>
                            <Link href="/shop" className="text-sm font-medium genie-link whitespace-nowrap">
                                Our Bakers
                            </Link>
                            {/* <Link href="/blog" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                                Blog
                            </Link> */}
                            <Link href="/compare" className="text-sm font-medium genie-link whitespace-nowrap">
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
                                className="p-1.5 genie-icon-button rounded-full shrink-0"
                                aria-label="Account"
                            >
                                <User size={22} />
                            </button>
                            <button
                                onClick={() => router.push('/cart')}
                                className="relative p-1.5 genie-icon-button rounded-full shrink-0"
                                aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                            >
                                <ShoppingBag size={22} />
                                {isMounted && itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">
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
                {/* ===== HERO SECTION ===== */}
                <section aria-label="Hero" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-0 pb-2 md:pb-1 lg:pb-1">
                    <div className="flex flex-col md:flex-row gap-8 md:gap-12 lg:gap-16 items-start">
                        {/* Mobile Hero View */}
                        {/* Mobile Hero View - Simplified */}
                        <div className="md:hidden w-full flex flex-col">
                            <h1 className="mb-4 text-center text-[10px] min-[360px]:text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-600 whitespace-nowrap">
                                Best Online Cake Delivery for Rush Orders in Cebu
                            </h1>
                            <div className="mb-6 text-center">
                                <h2 className="text-[50px] max-[390px]:text-[43px] font-extrabold leading-[1.0] tracking-tight text-gray-900">
                                    <HeroTypingHeadlineLine 
                                        className="block min-h-[1em] whitespace-nowrap text-center text-purple-400" 
                                        controlledPhraseIndex={hasInteractedWithHero ? HERO_PRODUCTS[heroProductIndex].headlineVariant : 0} 
                                    />
                                    <span className="block whitespace-nowrap text-black italic">For Today&apos;s</span>
                                    <span className="block whitespace-nowrap text-black italic">Celebrations</span>
                                </h2>
                            </div>
                            <div className="mb-6 flex flex-nowrap items-center justify-center gap-x-1 min-[390px]:gap-x-1.5 text-[8px] min-[390px]:text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                                <div className="flex items-center gap-1">
                                    <ImagePlus size={12} className="text-neutral-400" />
                                    <span className="whitespace-nowrap">Any Cake Image</span>
                                </div>
                                <span className="text-neutral-300">•</span>
                                <div className="flex items-center gap-1">
                                    <Zap size={12} className="text-neutral-400" />
                                    <span className="whitespace-nowrap">Instant Pricing</span>
                                </div>
                                <span className="text-neutral-300">•</span>
                                <div className="flex items-center gap-1">
                                    <Truck size={12} className="text-neutral-400" />
                                    <span className="whitespace-nowrap">Same-day Delivery</span>
                                </div>
                            </div>


                        </div>


                        {/* Desktop Hero View: 2-column layout */}
                        <div className="hidden md:flex md:flex-col w-full pt-5 pb-2.5">
                            {/* 1:1 grid ratio */}
                            <div className="grid grid-cols-2 gap-12 items-center">
                                {/* Left Column (1/2): Headlines and CTA */}
                                <div className="col-span-1 flex flex-col items-center text-center">
                                    <h1 className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.092em] text-neutral-600">
                                        Best Online Cake Delivery for Rush Orders in Cebu
                                    </h1>
                                    <h2 className="mt-2 text-[3.79rem] min-[945px]:text-[3.85rem] lg:text-[4.62rem] min-[1232px]:text-[5.7rem] font-extrabold text-gray-900 leading-[1.0] tracking-tight">
                                        <HeroTypingHeadlineLine 
                                            className="block min-h-[1em] whitespace-nowrap text-center text-purple-400" 
                                            controlledPhraseIndex={hasInteractedWithHero ? HERO_PRODUCTS[heroProductIndex].headlineVariant : 0} 
                                        />
                                        <span className="block whitespace-nowrap text-black italic">For Today&apos;s</span>
                                        <span className="block whitespace-nowrap text-black italic">Celebrations</span>
                                    </h2>
                                    <div className="mt-8 flex items-center justify-center gap-2 text-[11px] lg:text-[12px] font-bold uppercase tracking-wider text-neutral-500">
                                        <div className="flex items-center gap-1.5">
                                            <ImagePlus size={14} className="text-neutral-400" />
                                            <span className="whitespace-nowrap">Any Cake Image</span>
                                        </div>
                                        <span className="text-neutral-300">•</span>
                                        <div className="flex items-center gap-1.5">
                                            <Zap size={14} className="text-neutral-400" />
                                            <span className="whitespace-nowrap">Instant Pricing</span>
                                        </div>
                                        <span className="text-neutral-300">•</span>
                                        <div className="flex items-center gap-1.5">
                                            <Truck size={14} className="text-neutral-400" />
                                            <span className="whitespace-nowrap">Same-day Delivery</span>
                                        </div>
                                    </div>
                                    {heroUploadState === 'idle' && (
                                        <div className="mt-6 w-full max-w-[440px]">
                                            <button
                                                onClick={() => setIsUploaderOpen(true)}
                                                className="genie-btn-primary flex w-full items-center justify-center gap-3 rounded-2xl py-[15px] px-6 md:px-8 text-[17px] lg:text-lg font-bold active:scale-[0.99] shadow-lg shadow-purple-100/50"
                                            >
                                                <ImagePlus size={22} className="shrink-0" />
                                                <span className="whitespace-nowrap">Upload Your Design - Get Instant Pricing</span>
                                            </button>
                                        </div>
                                    )}

                                </div>


                                {/* Right Column (1/2): Featured Product Carousel / Upload Analysis */}
                                <div className="col-span-1 relative flex flex-col items-center w-full gap-4">

                                    {heroUploadState === 'idle' ? (
                                        /* ── Carousel mode ── */
                                        <>
                                            {/* Image Card with Prev / Next arrows */}
                                            <div className="relative w-full max-w-[600px]">
                                                <div className="overflow-hidden bg-transparent transition-all duration-300 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
                                                    <HeroProductPeekCarousel 
                                                        heroProductIndex={heroProductIndex} 
                                                        onSelectProduct={setHeroProductIndex} 
                                                        onInteraction={() => setHasInteractedWithHero(true)}
                                                        cardSpacingClassName="mx-2"
                                                        cardFlexStyle="0 0 min(calc(50% - 16px), 279px)"
                                                    />
                                                </div>
                                                {/* Left arrow */}
                                                <button onClick={handleHeroPrev} aria-label="Previous cake design" className="absolute left-0 top-[45%] -translate-y-1/2 -translate-x-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-lg text-neutral-600 transition-all hover:border-purple-300 hover:text-purple-700 hover:shadow-xl active:scale-95">
                                                    <ChevronLeft size={18} />
                                                </button>
                                                {/* Right arrow */}
                                                <button onClick={handleHeroNext} aria-label="Next cake design" className="absolute right-0 top-[45%] -translate-y-1/2 translate-x-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-lg text-neutral-600 transition-all hover:border-purple-300 hover:text-purple-700 hover:shadow-xl active:scale-95">
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>

                                        </>
                                    ) : (
                                        /* ── Upload analysis mode ── */
                                        <>
                                            {/* Uploaded image + loading bar overlay */}
                                            <div className="relative w-full max-w-[480px]">
                                                <div className="overflow-hidden bg-transparent">
                                                    <div className="relative w-full aspect-[3/2] overflow-hidden rounded-3xl">
                                                        {heroUploadedImageSrc && (
                                                            <img
                                                                src={heroUploadedImageSrc}
                                                                alt="Your uploaded cake design"
                                                                className="w-full h-full object-cover animate-in fade-in duration-500"
                                                            />
                                                        )}
                                                        {/* Overlay: visible during analysis */}
                                                        {heroUploadState === 'analyzing' && (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent pb-5 px-5">
                                                                <div className="w-full space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
                                                                        <span className="text-white text-[11px] font-bold uppercase tracking-widest">Analyzing your cake design…</span>
                                                                    </div>
                                                                    {/* 11-second fill bar */}
                                                                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full"
                                                                            style={{
                                                                                width: heroProgressAnimate ? '100%' : '0%',
                                                                                transition: heroProgressAnimate
                                                                                    ? 'width 11s linear'
                                                                                    : 'none',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Done tick overlay */}
                                                        {heroUploadState === 'done' && (
                                                            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/90 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                Analysis complete
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Reset button */}
                                                <button
                                                    onClick={() => {
                                                        setHeroUploadState('idle');
                                                        setHeroUploadedImageSrc(null);
                                                        setHeroUploadError(null);
                                                    }}
                                                    aria-label="Back to cake designs"
                                                    className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-neutral-200 shadow text-neutral-500 hover:text-neutral-900 transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                            {/* Product Info & Action Card — analysis result */}
                                            <div className="w-full max-w-[480px] bg-white rounded-3xl shadow-xl border border-neutral-100 relative">
                                                {/* Availability bar with Inverted Corners */}
                                                {heroUploadState === 'analyzing' ? (
                                                    <div className="bg-neutral-100 py-2 px-4 flex items-center justify-center gap-2 rounded-t-3xl">
                                                        <Loader2 className="w-3 h-3 text-neutral-500 animate-spin" />
                                                        <span className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Calculating availability...</span>

                                                        {/* Inverted Corner Left */}
                                                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-full h-full bg-neutral-100" />
                                                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                                                        </div>
                                                        {/* Inverted Corner Right */}
                                                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-full h-full bg-neutral-100" />
                                                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                                                        </div>
                                                    </div>
                                                ) : heroUploadState === 'error' ? (
                                                    <div className="bg-red-50 py-2 px-4 flex items-center justify-center rounded-t-3xl">
                                                        <span className="text-red-700 text-[10px] font-black uppercase tracking-wider">{heroUploadError ?? 'AI analysis is temporarily unavailable.'}</span>

                                                        {/* Inverted Corner Left */}
                                                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-full h-full bg-red-50" />
                                                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                                                        </div>
                                                        {/* Inverted Corner Right */}
                                                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-full h-full bg-red-50" />
                                                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                                                        </div>
                                                    </div>
                                                ) : heroAnalysis.availability === 'rush' ? (
                                                    <div className="bg-green-100/80 py-2 px-4 flex items-center justify-center gap-2 rounded-t-3xl">
                                                        <Zap className="w-3 h-3 text-green-900" />
                                                        <span className="text-green-900 text-[10px] font-black uppercase tracking-wider">Rush Order! Ready in 60 mins</span>

                                                        {/* Inverted Corner Left */}
                                                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-full h-full bg-green-100/80" />
                                                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                                                        </div>
                                                        {/* Inverted Corner Right */}
                                                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-full h-full bg-green-100/80" />
                                                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                                                        </div>
                                                    </div>
                                                ) : heroAnalysis.availability === 'same-day' ? (
                                                    <div className="bg-blue-100/80 py-2 px-4 flex items-center justify-center gap-2 rounded-t-3xl">
                                                        <Clock className="w-3 h-3 text-blue-900" />
                                                        <span className="text-blue-900 text-[10px] font-black uppercase tracking-wider">Same-Day Order! Ready in 3 hours</span>

                                                        {/* Inverted Corner Left */}
                                                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-full h-full bg-blue-100/80" />
                                                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                                                        </div>
                                                        {/* Inverted Corner Right */}
                                                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-full h-full bg-blue-100/80" />
                                                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-blue-100/80 py-2 px-4 flex items-center justify-center gap-2 rounded-t-3xl">
                                                        <Calendar className="w-3 h-3 text-blue-900" />
                                                        <span className="text-blue-900 text-[10px] font-black uppercase tracking-wider">Freshly Baked. Ready for Delivery Tomorrow</span>

                                                        {/* Inverted Corner Left */}
                                                        <div className="absolute top-full left-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-full h-full bg-blue-100/80" />
                                                            <div className="absolute top-0 left-0 w-full h-full bg-white rounded-tl-[24px]" />
                                                        </div>
                                                        {/* Inverted Corner Right */}
                                                        <div className="absolute top-full right-0 w-6 h-6 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-full h-full bg-blue-100/80" />
                                                            <div className="absolute top-0 right-0 w-full h-full bg-white rounded-tr-[24px]" />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Price & action row */}
                                                <div className="py-3 px-5 flex items-center justify-between gap-3">
                                                    <div className="flex flex-col">
                                                        {heroUploadState === 'analyzing' ? (
                                                            <>
                                                                <div className="h-7 w-24 rounded-lg bg-neutral-100 animate-pulse" />
                                                                <div className="mt-1.5 h-3 w-32 rounded bg-neutral-100 animate-pulse" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-2xl font-black text-neutral-900 tracking-tight leading-none animate-in fade-in slide-in-from-bottom-1 duration-300">
                                                                    {heroUploadState === 'error' ? 'Unavailable' : heroAnalysis.price != null ? `₱${heroAnalysis.price.toLocaleString()}` : '—'}
                                                                </p>
                                                                <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-tight mt-1 animate-in fade-in duration-300">
                                                                    {heroUploadState === 'error' ? 'Please try again later' : heroAnalysis.size ?? 'Starting price'}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                resetHeroUploadPreview();
                                                                setIsUploaderOpen(true);
                                                            }}
                                                            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 active:scale-[0.98] shadow-sm"
                                                            aria-label="Upload another cake image"
                                                        >
                                                            <ImagePlus size={20} />
                                                        </button>
                                                        <button
                                                            disabled={heroUploadState === 'analyzing' || (heroUploadState !== 'error' && !heroAnalysis.slug)}
                                                            onClick={() => {
                                                                if (heroUploadState === 'error') {
                                                                    resetHeroUploadPreview();
                                                                    setIsUploaderOpen(true);
                                                                    return;
                                                                }
                                                                if (heroAnalysis.slug) {
                                                                    router.push(`/customizing/${heroAnalysis.slug}`);
                                                                }
                                                            }}
                                                            className="shrink-0 bg-neutral-200 text-black border border-neutral-300 hover:bg-neutral-300 transition-colors px-6 py-3.5 disabled:opacity-40 disabled:cursor-wait rounded-2xl font-bold text-[10px] lg:text-xs active:scale-[0.98] uppercase tracking-wider whitespace-nowrap"
                                                        >
                                                            {heroUploadState === 'analyzing' ? 'Analyzing…' : heroUploadState === 'error' ? 'Upload another' : 'Order This Cake'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>{/* /.grid */}
                        </div>{/* /.flex-col outer */}
                    </div>
                </section>

                <section ref={heroMobilePreviewRef} aria-label="Featured cake preview" className="md:hidden w-full scroll-mt-28 px-4 pb-8">
                    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
                        <HeroProductPreviewStack
                            heroProductIndex={heroProductIndex}
                            heroUploadState={heroUploadState}
                            heroUploadedImageSrc={heroUploadedImageSrc}
                            heroProgressAnimate={heroProgressAnimate}
                            heroAnalysis={heroAnalysis}
                            heroUploadError={heroUploadError}
                            onPrev={handleHeroPrev}
                            onNext={handleHeroNext}
                            onSelectProduct={setHeroProductIndex}
                            onInteraction={() => setHasInteractedWithHero(true)}
                            onOpenUploader={() => setIsUploaderOpen(true)}
                            onResetUpload={resetHeroUploadPreview}
                            onResultAction={handleHeroResultAction}
                        />

                    </div>
                </section>


                {/* ===== REVIEWS MARQUEE ===== */}
                {reviewCards.length > 0 && (
                    <section aria-label="Customer reviews" className="w-full overflow-hidden py-2 md:py-4">
                        <div className="mx-auto max-w-7xl px-4 pt-[8px] md:pt-[32px] pb-1 text-center sm:px-6 lg:px-8">
                            <Link href="/reviews" className="text-[13px] md:text-[14px] text-gray-600 hover:text-purple-500">
                                4.8 <span className="text-yellow-500">★★★★★</span> based on 40 reviews. | <span className="text-green-600 font-bold">Verified ✓</span>
                            </Link>
                        </div>
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
                                                        <span key={star} className={`text-[10px] ${star <= card.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-medium text-slate-600 truncate ml-2">{card.name}</span>
                                            </div>
                                            {/* Row 2: Image thumbnail (left) + Review snippet (right) */}
                                            <div className="flex gap-2">
                                                {card.photo && (
                                                    <div className="relative w-10 h-10 md:w-[47px] md:h-[47px] shrink-0 overflow-hidden rounded-md border border-slate-200">
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

                {/* ===== INTERACTIVE CUSTOMIZER DEMO ===== */}

                <section aria-label="AI-powered instant pricing" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                    <h2 id="price-change-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-2 text-center">
                        See your price change <span className="text-purple-400">in real time.</span>
                    </h2>
                    <p className="text-base text-slate-500 mb-8 max-w-2xl mx-auto text-center">
                        Upload any cake design. Customize it. See your price instantly. Same-day delivery.
                    </p>

                    {(() => {
                        const TIERS = [
                            { label: '1 Tier', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/1-tier-ribbon-cake.webp', price: 1500, size: '8" Round 4 in height' },
                            { label: '2 Tier', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake.webp', price: 2500, size: '6"9" 4 in height per tier' },
                            { label: 'Bento', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento-ribbon-cake.png.webp', price: 399, size: '4" Round 2 in height' },
                        ];
                        const FLAVORS = [
                            { label: 'Vanilla', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakevanilla.webp' },
                            { label: 'Chocolate', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakechocolate.webp' },
                            { label: 'Ube', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cakeube.webp' },
                        ];
                        const BASE = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';
                        const ICINGS = [
                            { label: 'Drip', src: `${BASE}drip_black.webp`, addonPrice: 100 },
                            { label: 'Body Icing', src: `${BASE}icing_red.webp`, addonPrice: 0 },
                            { label: 'Board', src: `${BASE}baseboardwhite.webp`, addonPrice: 100 },
                        ];
                        const TOPPERS = [
                            { label: 'Sugar Flowers', emoji: '🌸' },
                            { label: 'Sprinkles', emoji: '✨' },
                            { label: 'Macaron', emoji: '🍪' },
                        ];
                        return <InteractiveCustomizer tiers={TIERS} flavors={FLAVORS} icings={ICINGS} toppers={TOPPERS} onTryItClick={() => setIsUploaderOpen(true)} />;
                    })()}
                </section>

                {/* ===== BLOG SECTION - Hidden as requested ===== */}
                {/* 
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                    <section aria-label="Blog" className="py-8 md:py-12">
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h2 className="text-3xl sm:text-4xl font-black bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Stories, Blogs and News</h2>
                            <Link href="/blog" className="group flex items-center gap-1 md:gap-2 text-purple-400 font-semibold hover:text-purple-700 transition-colors text-[13px] md:text-base shrink-0">
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
                */}



                {/* ===== RECENT SEARCHES + WHAT IS GENIE.PH (Server-rendered children) ===== */}
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </div>
            </main>

            {/* ========== MOBILE BOTTOM NAV ========== */}
            <MobileBottomNav onUploadClick={() => setIsUploaderOpen(true)} />

            {isUploaderOpen ? (
                <ImageUploader
                    isOpen={isUploaderOpen}
                    title="Upload Your Design - Get Instant Pricing"
                    iconImageSrc="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/upload-cake-image.webp"
                    iconImageAlt="Upload cake design"
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
                    <p className="text-[10px] text-gray-400 text-center">&copy; {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p>
                </div>
            </aside>
        </div>
    );
};

export default LandingClient;
