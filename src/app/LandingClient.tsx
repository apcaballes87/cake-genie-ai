'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';

import Link from 'next/link';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import LazyImage from '@/components/LazyImage';
import { showError, showLoading, showInfo } from '@/lib/utils/toast';
import MobileBottomNav from '@/components/MobileBottomNav';
import SameDayCutoffBanner from '@/components/SameDayCutoffBanner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { BlogHomepagePreview } from '@/services/supabaseService';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { batchSaveToLocalStorage } from '@/contexts/CartContext';
import { COMMON_ASSETS, HOMEPAGE_ASSETS } from '@/constants';
import { trackImageUpload } from '@/lib/analytics';
import {
    DEFAULT_LANDING_HERO_CONTENT,
    type LandingHeroContent,
    type LandingHeroProduct,
} from '@/components/landing/landingHeroContent';
import { HeroTransitionSection } from '@/components/landing';
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

// Embla-powered hero carousel is loaded only when useShouldMountCarousel
// flips true (mobile + first interaction or 1.5s idle). Splitting it out of
// the main bundle keeps embla-carousel-react and embla-carousel-wheel-gestures
// off the initial JS critical path. ssr:false because embla measures layout
// during init, which only makes sense in the browser.
const HeroProductPeekCarouselEmbla = dynamic(
    () => import('./HeroProductPeekCarouselEmbla'),
    { ssr: false }
);

interface LandingClientProps {
    children?: React.ReactNode;
    blogPosts?: BlogHomepagePreview[];
    heroContent?: LandingHeroContent;
    reviewSummary?: {
        total: number;
        averageRating: number;
    };
}

const LANDING_PRIMARY_CTA_RADIUS = 'rounded-[1.35rem]';

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

const HeroTypingHeadlineLine: React.FC<{
    className?: string;
    controlledPhraseIndex?: number;
    phrases?: readonly string[];
    a11yLabel?: string;
    onPhraseSettled?: (phraseIndex: number) => void;
}> = ({
    className = '',
    controlledPhraseIndex,
    phrases = DEFAULT_LANDING_HERO_CONTENT.headlineVariants,
    a11yLabel,
    onPhraseSettled,
}) => {
    const targetPhraseIndex = controlledPhraseIndex ?? 0;
    const [phraseIndex, setPhraseIndex] = useState(targetPhraseIndex);
    const [displayText, setDisplayText] = useState(phrases[targetPhraseIndex] ?? phrases[0] ?? '');
    const [animationState, setAnimationState] = useState<'idle' | 'deleting' | 'typing'>('idle');
    const pendingIndexRef = useRef<number | null>(null);
    const longestPhrase = phrases.reduce((longest, phrase) => (
        phrase.length > longest.length ? phrase : longest
    ), phrases[0] ?? '');
    const currentPhrase = phrases[phraseIndex] ?? phrases[0] ?? '';
    const activePhraseClassName = currentPhrase === 'Minimalist Cakes'
        ? 'italic inline-block [font-size:0.9em]'
        : 'italic';
    const placeholderPhraseClassName = longestPhrase === 'Minimalist Cakes'
        ? 'italic inline-block [font-size:0.9em]'
        : 'italic';

    useEffect(() => {
        if (targetPhraseIndex === phraseIndex) {
            if (animationState === 'idle' && displayText !== currentPhrase) {
                setDisplayText(currentPhrase);
            }
            return;
        }

        pendingIndexRef.current = targetPhraseIndex;
        setAnimationState((currentState) => (currentState === 'idle' ? 'deleting' : currentState));
    }, [animationState, currentPhrase, displayText, phraseIndex, targetPhraseIndex]);

    useEffect(() => {
        if (animationState === 'idle') return;

        let timeoutId: ReturnType<typeof setTimeout>;

        if (animationState === 'deleting') {
            if (displayText.length === 0) {
                const nextIndex = pendingIndexRef.current ?? phraseIndex;
                pendingIndexRef.current = null;
                setPhraseIndex(nextIndex);
                setAnimationState('typing');
            } else {
                timeoutId = setTimeout(() => {
                    setDisplayText((currentText) => currentText.slice(0, -1));
                }, 30);
            }
        } else if (displayText === currentPhrase) {
            setAnimationState('idle');
            onPhraseSettled?.(phraseIndex);
        } else {
            timeoutId = setTimeout(() => {
                setDisplayText(currentPhrase.slice(0, displayText.length + 1));
            }, 52);
        }

        return () => clearTimeout(timeoutId);
    }, [animationState, currentPhrase, displayText, onPhraseSettled, phraseIndex]);

    return (
        <span className={className} aria-label={a11yLabel ?? phrases.join(', ')}>
            <span className="relative inline-grid">
                <span aria-hidden="true" className="invisible whitespace-nowrap">
                    <span className={placeholderPhraseClassName}>{longestPhrase}</span>
                    <span className="ml-1 inline-block h-[0.92em] w-[3px] align-middle" />
                </span>
                <span aria-hidden="true" className="absolute inset-0 inline-flex items-start justify-center whitespace-nowrap">
                    <span className={activePhraseClassName}>{displayText}</span>
                    {animationState !== 'idle' && (
                        <span
                            aria-hidden="true"
                            className="ml-1 inline-block h-[0.92em] w-[3px] translate-y-[2px] bg-purple-500 align-middle animate-pulse"
                        />
                    )}
                </span>
            </span>
        </span>
    );
};

function HeroProductImage({
    src,
    alt,
    priority = false,
    fill = true,
    imageClassName = '',
    sizes,
    ...props
}: {
    src: string;
    alt: string;
    priority?: boolean;
    fill?: boolean;
    imageClassName?: string;
    sizes: string;
    draggable?: boolean;
    'aria-hidden'?: boolean;
}) {
    return (
        <LazyImage
            src={src}
            alt={alt}
            fill={fill}
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'low'}
            decoding="async"
            unoptimized
            sizes={sizes}
            imageClassName={imageClassName}
            {...props}
        />
    );
}

const HeroMasonryGrid: React.FC<{ 
    products: readonly LandingHeroProduct[],
    onSelectProduct?: (index: number) => void,
    onInteraction?: (index: number) => void
}> = ({ products, onSelectProduct, onInteraction }) => {
    const handleInteraction = (index: number) => {
        onSelectProduct?.(index);
        onInteraction?.(index);
    };

    return (
        <div className="grid w-full grid-cols-3 gap-2.5 min-[450px]:gap-3.5 lg:gap-4 animate-in fade-in zoom-in-95 duration-1000 ease-out">
            <div className="flex flex-col gap-2.5 min-[450px]:gap-3.5 lg:gap-4">
                <div 
                    className="group relative aspect-5/6 cursor-pointer overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl min-[450px]:rounded-2xl"
                    onMouseEnter={() => handleInteraction(0)}
                    onClick={() => handleInteraction(0)}
                >
                    <HeroProductImage
                        src={products[0]?.image || ''}
                        alt={products[0]?.title || 'Custom cake design'}
                        priority={true}
                        sizes="(max-width: 767px) 33vw, (max-width: 1279px) 18vw, 220px"
                        imageClassName="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>
                <div 
                    className="group relative aspect-5/6 cursor-pointer overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl min-[450px]:rounded-2xl"
                    onMouseEnter={() => handleInteraction(1)}
                    onClick={() => handleInteraction(1)}
                >
                    <HeroProductImage
                        src={products[1]?.image || ''}
                        alt={products[1]?.title || 'Custom cake design'}
                        priority={true}
                        sizes="(max-width: 767px) 33vw, (max-width: 1279px) 18vw, 220px"
                        imageClassName="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>
            </div>
            <div className="flex flex-col gap-2.5 pt-7 min-[450px]:gap-3.5 min-[450px]:pt-12 lg:gap-4 lg:pt-14">
                <div 
                    className="group relative aspect-5/6 cursor-pointer overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl min-[450px]:rounded-2xl"
                    onMouseEnter={() => handleInteraction(2)}
                    onClick={() => handleInteraction(2)}
                >
                    <HeroProductImage
                        src={products[2]?.image || ''}
                        alt={products[2]?.title || 'Custom cake design'}
                        priority={true}
                        sizes="(max-width: 767px) 33vw, (max-width: 1279px) 18vw, 220px"
                        imageClassName="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>
                <div 
                    className="group relative aspect-5/6 cursor-pointer overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl min-[450px]:rounded-2xl"
                    onMouseEnter={() => handleInteraction(3)}
                    onClick={() => handleInteraction(3)}
                >
                    <HeroProductImage
                        src={products[3]?.image || ''}
                        alt={products[3]?.title || 'Custom cake design'}
                        priority={true}
                        sizes="(max-width: 767px) 33vw, (max-width: 1279px) 18vw, 220px"
                        imageClassName="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>
            </div>
            <div className="flex flex-col gap-2.5 pt-3.5 min-[450px]:gap-3.5 min-[450px]:pt-6 lg:gap-4 lg:pt-8">
                <div 
                    className="group relative aspect-5/6 cursor-pointer overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl min-[450px]:rounded-2xl"
                    onMouseEnter={() => handleInteraction(4)}
                    onClick={() => handleInteraction(4)}
                >
                    <HeroProductImage
                        src={products[4]?.image || ''}
                        alt={products[4]?.title || 'Custom cake design'}
                        priority={true}
                        sizes="(max-width: 767px) 33vw, (max-width: 1279px) 18vw, 220px"
                        imageClassName="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>
                <div 
                    className="group relative aspect-5/6 cursor-pointer overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-500 hover:shadow-xl min-[450px]:rounded-2xl"
                    onMouseEnter={() => handleInteraction(5)}
                    onClick={() => handleInteraction(5)}
                >
                    <HeroProductImage
                        src={products[5]?.image || ''}
                        alt={products[5]?.title || 'Custom cake design'}
                        priority={true}
                        sizes="(max-width: 767px) 33vw, (max-width: 1279px) 18vw, 220px"
                        imageClassName="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>
            </div>
        </div>
    );
};

/**
 * Returns true once we want to actually mount the Embla carousel:
 *   1. Viewport is <768px (mobile only — desktop uses HeroMasonryGrid).
 *   2. AND user has shown engagement (pointerdown, scroll, touchstart) OR
 *      a 1500ms idle fallback.
 *
 * Why: useEmblaCarousel synchronously calls getBoundingClientRect on every
 * slide during init, causing a ~400ms forced reflow. That used to land in
 * the LCP critical path, costing render delay even on desktop (where the
 * carousel is hidden via CSS but still mounted in the React tree).
 *
 * After this hook, the embla code path runs only on mobile, and only AFTER
 * the LCP image has painted, so the cost is shifted out of the critical path.
 */
function useShouldMountCarousel(): boolean {
    const [shouldMount, setShouldMount] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
        if (!isMobile()) {
            // Desktop: never mount embla. Watch for resize in case of rotation.
            const onResize = () => {
                if (isMobile()) setShouldMount(true);
            };
            window.addEventListener('resize', onResize, { passive: true });
            return () => window.removeEventListener('resize', onResize);
        }

        // Mobile: wait for engagement OR a 1.5s idle fallback so the carousel
        // is ready by the time the user looks at it, but not before LCP.
        const activate = () => setShouldMount(true);
        const events: Array<keyof WindowEventMap> = [
            'pointerdown',
            'scroll',
            'touchstart',
        ];
        events.forEach((evt) =>
            window.addEventListener(evt, activate, { once: true, passive: true })
        );
        const idleTimer = window.setTimeout(activate, 1500);

        return () => {
            events.forEach((evt) => window.removeEventListener(evt, activate));
            window.clearTimeout(idleTimer);
        };
    }, []);

    return shouldMount;
}

/**
 * Static placeholder shown in place of HeroProductPeekCarousel until embla
 * mounts. Renders just the centered card (no scrolling, no slide list, no
 * dot indicators) so the layout is stable but no layout-measuring JS runs.
 *
 * IMPORTANT: this must be visually compatible with the first paint of the
 * carousel so the LCP element doesn't shift when embla replaces it.
 */
function HeroProductPeekCarouselPlaceholder({
    products,
    heroProductIndex,
    cardSpacingClassName = 'mx-1',
    cardFlexStyle = '0 0 min(calc(50% - 8px), 232px)',
    aspectClassName = 'aspect-[3/2]',
}: {
    products: readonly LandingHeroProduct[];
    heroProductIndex: number;
    cardSpacingClassName?: string;
    cardFlexStyle?: string;
    aspectClassName?: string;
}) {
    return (
        <div className={`relative w-full overflow-hidden bg-transparent ${aspectClassName}`}>
            <div className="h-full overflow-hidden">
                <div className="flex h-full justify-center touch-pan-y">
                    {products.map((product, productIndex) => {
                        const isCenter = productIndex === heroProductIndex;
                        // Skip non-center cards entirely to avoid extra DOM.
                        // Embla will render the full slide list once mounted.
                        if (!isCenter) return null;
                        return (
                            <div
                                key={product.title}
                                className={`relative ${cardSpacingClassName} h-full min-w-0 overflow-hidden rounded-[1.35rem] bg-slate-100 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.75)]`}
                                style={{ flex: cardFlexStyle }}
                                aria-label={`${product.title} example`}
                            >
                                <HeroProductImage
                                    src={product.image}
                                    alt={`${product.title} example`}
                                    priority={true}
                                    sizes="(max-width: 767px) 50vw, (max-width: 1279px) 40vw, 380px"
                                    imageClassName="object-cover scale-[1.1]"
                                    draggable={false}
                                />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/25 to-transparent" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function HeroProductPeekCarousel({
    products,
    heroProductIndex,
    onSelectProduct,
    onInteraction,
    cardSpacingClassName = 'mx-1',
    cardFlexStyle = '0 0 min(calc(50% - 8px), 232px)',
    aspectClassName = 'aspect-[3/2]',
}: {
    products: readonly LandingHeroProduct[];
    heroProductIndex: number;
    onSelectProduct: (index: number) => void;
    onInteraction?: (index: number) => void;
    cardSpacingClassName?: string;
    cardFlexStyle?: string;
    aspectClassName?: string;
}) {
    const shouldMount = useShouldMountCarousel();

    // Until we decide to mount embla, render a static placeholder. This keeps
    // useEmblaCarousel's getBoundingClientRect off the LCP critical path on
    // mobile, and prevents it running at all on desktop where this section is
    // hidden via CSS (md:hidden) but otherwise still mounted in React.
    if (!shouldMount) {
        return (
            <HeroProductPeekCarouselPlaceholder
                products={products}
                heroProductIndex={heroProductIndex}
                cardSpacingClassName={cardSpacingClassName}
                cardFlexStyle={cardFlexStyle}
                aspectClassName={aspectClassName}
            />
        );
    }

    return (
        <HeroProductPeekCarouselEmbla
            products={products}
            heroProductIndex={heroProductIndex}
            onSelectProduct={onSelectProduct}
            onInteraction={onInteraction}
            cardSpacingClassName={cardSpacingClassName}
            cardFlexStyle={cardFlexStyle}
            aspectClassName={aspectClassName}
        />
    );
}

/**
 * Embla-powered carousel implementation. Extracted so we can gate its mount
 * behind useShouldMountCarousel() — see HeroProductPeekCarousel above.
 *
 * useEmblaCarousel calls getBoundingClientRect on each slide during init,
 * which is a ~400ms forced reflow on mobile. We don't want that running
 * during initial paint.
 *
 * NOTE: This was the original inline implementation. It's been moved to
 * ./HeroProductPeekCarouselEmbla.tsx and is now loaded via next/dynamic at
 * the top of this file. Leaving this stub comment to signpost the move.
 */

function HeroReviewSummary({
    compact = false,
    reviewSummary,
}: {
    compact?: boolean;
    reviewSummary?: {
        total: number;
        averageRating: number;
    };
}) {
    const averageLabel = reviewSummary && reviewSummary.averageRating > 0
        ? reviewSummary.averageRating.toFixed(1)
        : 'Verified';
    const countLabel = reviewSummary && reviewSummary.total > 0
        ? `based on ${reviewSummary.total} Happy Customer${reviewSummary.total === 1 ? '' : 's'}.`
        : 'real customer feedback and order photos.'

    return (
        <Link
            href="/reviews"
            className={`inline-flex items-center justify-center gap-1.5 text-gray-600 hover:text-purple-500 ${compact ? 'text-[11px]' : 'text-[13px] md:text-[14px]'}`}
        >
            <span>{averageLabel}</span>
            <span className="text-yellow-500">★★★★★</span>
            <span>{countLabel}</span>
            <span>|</span>
            <span className="font-bold text-green-600">Verified ✓</span>
        </Link>
    );
}

function HeroFeatureHighlights({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
    return (
        <div
            className={`${compact
                ? 'flex flex-nowrap items-center justify-center gap-x-1 min-[390px]:gap-x-1.5 text-[8px] min-[390px]:text-[10px]'
                : 'flex items-center justify-center gap-2 text-[11px] lg:text-[12px]'
                } font-bold uppercase tracking-wide text-neutral-500 ${className}`}
        >
            <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-1.5'}>
                <ImagePlus size={compact ? 12 : 14} className="text-neutral-400" />
                <span className="whitespace-nowrap">Any Cake Image</span>
            </div>
            <span className="text-neutral-300">•</span>
            <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-1.5'}>
                <Zap size={compact ? 12 : 14} className="text-neutral-400" />
                <span className="whitespace-nowrap">Instant AI Pricing</span>
            </div>
            <span className="text-neutral-300">•</span>
            <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-1.5'}>
                <Truck size={compact ? 12 : 14} className="text-neutral-400" />
                <span className="whitespace-nowrap">Same-day Delivery</span>
            </div>
        </div>
    );
}

function HeroProductPreviewStack({
    products,
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
    products: readonly LandingHeroProduct[];
    heroProductIndex: number;
    heroUploadState: HeroUploadState;
    heroUploadedImageSrc: string | null;
    heroProgressAnimate: boolean;
    heroAnalysis: HeroAnalysisSummary;
    heroUploadError: string | null;
    onPrev: () => void;
    onNext: () => void;
    onSelectProduct: (index: number) => void;
    onInteraction: (index: number) => void;
    onOpenUploader: () => void;
    onResetUpload: () => void;
    onResultAction: () => void;
}) {
    if (heroUploadState === 'idle') {
        return (
            <>
                {/* Primary CTA - Mobile */}
                <div className="mx-auto w-full max-w-[480px] mt-2 mb-1">
                    <button
                        onClick={onOpenUploader}
                        className={`genie-btn-primary flex w-full items-center justify-center gap-2 ${LANDING_PRIMARY_CTA_RADIUS} py-4 px-3 font-bold active:scale-[0.98] shadow-md shadow-purple-50/50`}
                    >
                        <ImagePlus size={20} className="shrink-0" />
                        <span className="whitespace-nowrap text-[12px] min-[360px]:text-[13px] min-[390px]:text-sm">Upload Your Design - Get Instant Pricing</span>
                    </button>
                    <div className="mt-2.5 text-center text-[13px] text-slate-500 font-medium">
                        Don't have a photo?{' '}
                        <Link href="/collections" className="text-purple-600 font-bold hover:underline hover:text-purple-700 transition-colors">Browse from 10,000+ cake designs</Link>
                    </div>
                </div>
                <div className="relative -mx-4 md:mx-auto md:w-full md:max-w-[480px] min-[505px]:mask-[linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] min-[505px]:[-webkit-mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
                    <div className="overflow-hidden bg-transparent">
                        <HeroProductPeekCarousel 
                            products={products}
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
            </>
        );
    }

    return (
        <>
            <div className="relative mx-auto w-full max-w-[480px]">
                <div className="overflow-hidden bg-transparent">
                    <div className="relative aspect-3/2 w-full overflow-hidden rounded-3xl">
                        {heroUploadedImageSrc && (
                            <img
                                src={heroUploadedImageSrc}
                                alt="Your uploaded cake design"
                                className="h-full w-full object-cover animate-in fade-in duration-500"
                            />
                        )}
                        {heroUploadState === 'analyzing' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-end bg-linear-to-t from-black/70 via-black/10 to-transparent px-5 pb-5">
                                <div className="w-full space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" />
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-white">Analyzing your cake design...</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                                        <div
                                            className="h-full rounded-full bg-linear-to-r from-purple-400 to-purple-500"
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
                            className="shrink-0 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-neutral-200 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black border border-neutral-300 hover:bg-neutral-300 transition-colors active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
                        >
                            <ImagePlus size={14} className="shrink-0" />
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
                <div className="absolute left-[24%] right-[24%] top-[20%] h-[10%] rounded-b-4xl rounded-t-md bg-rose-300/70 shadow-[0_14px_28px_-18px_rgba(190,24,93,0.95)]">
                    <span className="absolute left-[12%] top-[72%] h-7 w-2.5 rounded-full bg-rose-300/75" />
                    <span className="absolute left-[35%] top-[58%] h-5 w-2 rounded-full bg-rose-300/75" />
                    <span className="absolute right-[16%] top-[68%] h-8 w-2.5 rounded-full bg-rose-300/75" />
                </div>
            )}

            {showFlowers && (
                <>
                    <div className="absolute left-[23%] top-[18%] h-8 w-8 rotate-[-18deg] drop-shadow-sm">{flower}</div>
                    <div className="absolute right-[24%] top-[20%] h-8 w-8 rotate-14 drop-shadow-sm">{flower}</div>
                    <div className="absolute bottom-[22%] right-[28%] h-7 w-7 rotate-28 drop-shadow-sm">{flower}</div>
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
                    setAnnotation('1 Tier — ₱1,499');

                    // Step 3: Switch to 2 Tier
                    scheduleStep(() => {
                        setSelectedTier(1);
                        setHighlightedOption('2 Tier');
                        setAnnotation('2 Tier — ₱2,499');
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-8">
                {/* Left: Cake Preview */}
                <div className="relative">
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
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
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
                <div className="flex flex-col gap-3">
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
                                        <img
                                            src={ic.src}
                                            alt={ic.label}
                                            className="w-full h-full object-contain"
                                            loading="lazy"
                                            decoding="async"
                                            fetchPriority="low"
                                        />
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

const LandingClient: React.FC<LandingClientProps> = ({
    children,
    blogPosts = [],
    heroContent: propHeroContent,
    reviewSummary,
}) => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('home');
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOccasionOpen, setIsOccasionOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const heroMobilePreviewRef = useRef<HTMLElement>(null);
    const uploadToastId = useRef<string | null>(null);
    const isMounted = React.useSyncExternalStore(subscribeToHydration, () => true, () => false);

    const heroContent = useMemo(() => {
        if (propHeroContent) return propHeroContent;
        return DEFAULT_LANDING_HERO_CONTENT;
    }, [propHeroContent]);

    const [heroProductIndex, setHeroProductIndex] = useState(0);
    const [heroHeadlineVariant, setHeroHeadlineVariant] = useState(0);
    const heroHeadlineResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Hero upload analysis state ─────────────────────────────────────────
    const [heroUploadState, setHeroUploadState] = useState<HeroUploadState>('idle');
    const [heroUploadedImageSrc, setHeroUploadedImageSrc] = useState<string | null>(null);
    const [heroProgressAnimate, setHeroProgressAnimate] = useState(false);
    const [heroAnalysis, setHeroAnalysis] = useState<HeroAnalysisSummary>({ price: null, size: null, availability: null, slug: null });
    const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
    // ───────────────────────────────────────────────────────────────────────
    const heroProducts = heroContent.products;
    const heroProductCount = heroProducts.length;


    useEffect(() => {
        if (heroProductIndex >= heroProductCount) {
            setHeroProductIndex(0);
        }
    }, [heroProductCount, heroProductIndex]);

    useEffect(() => {
        return () => {
            if (heroHeadlineResetTimeoutRef.current) {
                clearTimeout(heroHeadlineResetTimeoutRef.current);
            }
        };
    }, []);

    const activateHeroHeadlineVariant = useCallback((productIndex: number) => {
        const nextVariant = heroProducts[productIndex]?.headlineVariant ?? 0;
        setHeroHeadlineVariant(nextVariant);

        if (heroHeadlineResetTimeoutRef.current) {
            clearTimeout(heroHeadlineResetTimeoutRef.current);
            heroHeadlineResetTimeoutRef.current = null;
        }
    }, [heroProducts]);

    const handleHeroHeadlineSettled = useCallback((phraseIndex: number) => {
        if (heroHeadlineResetTimeoutRef.current) {
            clearTimeout(heroHeadlineResetTimeoutRef.current);
            heroHeadlineResetTimeoutRef.current = null;
        }

        if (phraseIndex !== 0) {
            heroHeadlineResetTimeoutRef.current = setTimeout(() => {
                setHeroHeadlineVariant(0);
                heroHeadlineResetTimeoutRef.current = null;
            }, 5000);
        }
    }, []);

    const handleHeroPrev = useCallback(() => {
        if (!heroProductCount) return;
        setHeroProductIndex((prev) => {
            const nextIndex = (prev - 1 + heroProductCount) % heroProductCount;
            activateHeroHeadlineVariant(nextIndex);
            return nextIndex;
        });
    }, [activateHeroHeadlineVariant, heroProductCount]);

    const handleHeroNext = useCallback(() => {
        if (!heroProductCount) return;
        setHeroProductIndex((prev) => {
            const nextIndex = (prev + 1) % heroProductCount;
            activateHeroHeadlineVariant(nextIndex);
            return nextIndex;
        });
    }, [activateHeroHeadlineVariant, heroProductCount]);

    const handleHeroInteraction = useCallback((productIndex: number) => {
        activateHeroHeadlineVariant(productIndex);
    }, [activateHeroHeadlineVariant]);

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

    // Record 'home' so that pages deeper in the funnel (search, customizing)
    // have a valid previousPage to return to via useSmartBack.
    useEffect(() => {
        recordNavigation('home', null);
    // Run once on mount only — recordNavigation is stable (useCallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    useEffect(() => {
        const updateScrollState = () => {
            setIsScrolled(window.scrollY > 12);
        };

        updateScrollState();
        window.addEventListener('scroll', updateScrollState, { passive: true });
        return () => window.removeEventListener('scroll', updateScrollState);
    }, []);

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
            <nav className={`sticky top-0 z-80 w-full border-b transition-all duration-200 ${isScrolled ? 'border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg' : 'border-transparent bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center justify-between py-[11px] md:py-[14px] relative">
                        {/* Left Side: Menu & Desktop Logo */}
                        <div className="flex items-center gap-2 md:gap-4 shrink-0">
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors"
                                aria-label="Open menu"
                            >
                                <Menu size={24} />
                            </button>

                            {/* Desktop Logo - visible when not scrolled */}
                            <Link
                                href="/"
                                className={`hidden md:block shrink-0 transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute -translate-x-4' : 'opacity-100 translate-x-0'}`}
                            >
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={135}
                                    height={43}
                                    className="h-[41px] w-auto object-contain"
                                />
                            </Link>
                        </div>

                        {/* Mobile Centered Logo - only visible when not scrolled */}
                        <div className={`md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}>
                            <Link href="/" className="flex items-center">
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={105}
                                    height={32}
                                    className="h-[32px] w-auto object-contain"
                                />
                            </Link>
                        </div>

                        {/* Search Bar - transition between states */}
                        <div className={`flex-1 mx-2 md:mx-4 transition-all duration-300 ${isScrolled ? 'opacity-100 translate-x-0' : 'hidden md:block md:opacity-100 md:translate-x-0 opacity-0 translate-x-4 pointer-events-none md:pointer-events-auto'}`}>
                            <SearchAutocomplete
                                onSearch={handleSearch}
                                onUploadClick={() => setIsUploaderOpen(true)}
                                placeholder="Search for other designs..."
                                value={searchQuery}
                                onChange={setSearchQuery}
                                showUploadButton={false}
                                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>

                        {/* Right Side: Actions & Cart */}
                        <div className="flex items-center gap-1 md:gap-2 shrink-0">
                            {/* Mobile Search Icon - visible only when NOT scrolled */}
                            {!isScrolled && (
                                <button
                                    onClick={() => {
                                        window.scrollTo({ top: 50, behavior: 'smooth' });
                                    }}
                                    className="md:hidden p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors"
                                    aria-label="Search"
                                >
                                    <Search size={24} />
                                </button>
                            )}

                            {/* Account Button - desktop only, hidden when scrolled */}
                            <button
                                onClick={() => {
                                    if (isAuthenticated && !user?.is_anonymous) {
                                        router.push('/account');
                                    } else {
                                        router.push('/login');
                                    }
                                }}
                                className={`hidden md:flex p-1.5 genie-icon-button rounded-full transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute translate-x-4' : 'opacity-100 translate-x-0'}`}
                                aria-label="Account"
                            >
                                <User size={22} />
                            </button>

                            {/* Cart Button */}
                            <button
                                onClick={() => router.push('/cart')}
                                className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                            >
                                <ShoppingBag size={24} />
                                {isMounted && itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white text-[10px] font-bold">
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
                <section aria-label="Hero" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-0 md:pt-[10px] pb-2 md:pb-1 lg:pb-1">
                    <div className="flex flex-col md:flex-row gap-8 md:gap-12 lg:gap-16 items-start">
                        {/* Mobile Hero View */}
                        {/* Mobile Hero View - Simplified */}
                        <div className="md:hidden w-full flex flex-col mt-2">
                            <div className="mb-3 text-center">
                                <HeroReviewSummary compact reviewSummary={reviewSummary} />
                            </div>
                            <p className="mb-4 text-center text-[10px] min-[360px]:text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-600 whitespace-nowrap">
                                {heroContent.eyebrow}
                            </p>
                            <div className="mb-3 text-center">
                                <div className="text-[50px] max-[390px]:text-[43px] font-extrabold leading-none tracking-tight text-gray-900">
                                    <HeroTypingHeadlineLine 
                                        className="block min-h-[1em] whitespace-nowrap text-center text-purple-400" 
                                        controlledPhraseIndex={heroHeadlineVariant}
                                        phrases={heroContent.headlineVariants}
                                        a11yLabel={heroContent.headlineA11yLabel}
                                        onPhraseSettled={handleHeroHeadlineSettled}
                                    />
                                    <span className="block whitespace-nowrap text-black italic">{heroContent.lineTwo}</span>
                                    <span className="block whitespace-nowrap text-black italic">{heroContent.lineThree}</span>
                                </div>
                                {heroUploadState === 'idle' && (
                                    <HeroFeatureHighlights compact className="mx-auto mt-3 w-full max-w-[480px] px-2" />
                                )}
                            </div>
                        </div>


                        {/* Desktop Hero View: 2-column layout */}
                        <div className="hidden md:flex md:flex-col w-full max-w-[1180px] mx-auto pt-3 pb-2.5">
                            <div className="grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 xl:gap-12">
                                <div className="col-span-1 mt-2 flex flex-col items-center text-center md:pr-2">
                                    <div className="w-full md:-translate-y-8">
                                        <div className="mb-3 text-center">
                                            <HeroReviewSummary reviewSummary={reviewSummary} />
                                        </div>
                                        <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.092em] text-neutral-600">
                                            {heroContent.eyebrow}
                                        </p>
                                        <h1 className="mt-2 text-[3.79rem] min-[945px]:text-[3.85rem] lg:text-[4.62rem] min-[1232px]:text-[5.7rem] font-extrabold text-gray-900 leading-none tracking-tight">
                                            <HeroTypingHeadlineLine 
                                                className="block min-h-[1em] whitespace-nowrap text-center text-purple-400" 
                                                controlledPhraseIndex={heroHeadlineVariant}
                                                phrases={heroContent.headlineVariants}
                                                a11yLabel={heroContent.headlineA11yLabel}
                                                onPhraseSettled={handleHeroHeadlineSettled}
                                            />
                                            <span className="block whitespace-nowrap text-black italic">{heroContent.lineTwo}</span>
                                            <span className="block whitespace-nowrap text-black italic">{heroContent.lineThree}</span>
                                        </h1>
                                        {heroUploadState === 'idle' && (
                                            <HeroFeatureHighlights className="mt-6" />
                                        )}
                                    </div>
                                    {heroUploadState === 'idle' && (
                                        <div className="mt-3 flex w-full max-w-[440px] flex-col items-center">
                                            <button
                                                onClick={() => setIsUploaderOpen(true)}
                                                className={`genie-btn-primary flex w-full items-center justify-center gap-3 ${LANDING_PRIMARY_CTA_RADIUS} py-[15px] px-6 md:px-8 text-[17px] lg:text-lg font-bold active:scale-[0.99] shadow-lg shadow-purple-100/50`}
                                            >
                                                <ImagePlus size={22} className="shrink-0" />
                                                <span className="whitespace-nowrap">Upload Your Design - Get Instant Pricing</span>
                                            </button>
                                            <div className="mt-3.5 text-center text-[14px] text-slate-500 font-medium">
                                                Don't have a photo?{' '}
                                                <Link href="/collections" className="text-purple-600 font-bold hover:underline hover:text-purple-700 transition-colors">Browse from 10,000+ cake designs</Link>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-1 flex flex-col items-center justify-center">
                                    {heroUploadState === 'idle' ? (
                                        <>
                                            <div className="w-full max-w-[680px] xl:max-w-[720px]">
                                                <HeroMasonryGrid
                                                    products={heroProducts}
                                                    onSelectProduct={setHeroProductIndex}
                                                    onInteraction={handleHeroInteraction}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="relative w-full max-w-[560px]">
                                                <div className="overflow-hidden bg-transparent">
                                                    <div className="relative w-full aspect-3/2 overflow-hidden rounded-3xl">
                                                        {heroUploadedImageSrc && (
                                                            <img
                                                                src={heroUploadedImageSrc}
                                                                alt="Your uploaded cake design"
                                                                className="w-full h-full object-cover animate-in fade-in duration-500"
                                                            />
                                                        )}
                                                        {/* Overlay: visible during analysis */}
                                                        {heroUploadState === 'analyzing' && (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-end bg-linear-to-t from-black/70 via-black/10 to-transparent pb-5 px-5">
                                                                <div className="w-full space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
                                                                        <span className="text-white text-[11px] font-bold uppercase tracking-widest">Analyzing your cake design…</span>
                                                                    </div>
                                                                    {/* 11-second fill bar */}
                                                                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-linear-to-r from-purple-400 to-purple-500 rounded-full"
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

                                            <div className="relative w-full max-w-[560px] rounded-3xl border border-neutral-100 bg-white shadow-xl">
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
                                                            className="shrink-0 flex items-center justify-center gap-1.5 bg-neutral-200 text-black border border-neutral-300 hover:bg-neutral-300 transition-colors px-6 py-3.5 disabled:opacity-40 disabled:cursor-wait rounded-2xl font-bold text-[10px] lg:text-xs active:scale-[0.98] uppercase tracking-wider whitespace-nowrap"
                                                        >
                                                            <ImagePlus size={12} className="shrink-0" />
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
                            products={heroProducts}
                            heroProductIndex={heroProductIndex}
                            heroUploadState={heroUploadState}
                            heroUploadedImageSrc={heroUploadedImageSrc}
                            heroProgressAnimate={heroProgressAnimate}
                            heroAnalysis={heroAnalysis}
                            heroUploadError={heroUploadError}
                            onPrev={handleHeroPrev}
                            onNext={handleHeroNext}
                            onSelectProduct={setHeroProductIndex}
                            onInteraction={handleHeroInteraction}
                            onOpenUploader={() => setIsUploaderOpen(true)}
                            onResetUpload={resetHeroUploadPreview}
                            onResultAction={handleHeroResultAction}
                        />

                    </div>
                </section>

                <HeroTransitionSection />

                {/* ===== INTERACTIVE CUSTOMIZER DEMO ===== */}

                <section aria-label="AI-powered instant pricing" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:pt-6 md:pb-12">
                    <h2 id="price-change-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-2 text-center">
                        Get your <span className="text-purple-400">Personalized Cake</span> today
                    </h2>
                    <p className="text-base text-slate-500 mb-8 max-w-2xl mx-auto text-center">
                        Upload any cake design. Customize it. See your price instantly. Same-day delivery.
                    </p>

                    {(() => {
                        const TIERS = [
                            { label: '1 Tier', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/1-tier-ribbon-cake.webp', price: 1499, size: '8" Round 4 in height' },
                            { label: '2 Tier', src: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake.webp', price: 2499, size: '6"9" 4 in height per tier' },
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
                        return (
                            <div className="mx-auto w-full max-w-[1180px]">
                                <InteractiveCustomizer
                                    tiers={TIERS}
                                    flavors={FLAVORS}
                                    icings={ICINGS}
                                    toppers={TOPPERS}
                                    onTryItClick={() => setIsUploaderOpen(true)}
                                />
                            </div>
                        );
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



                {/* ===== SAME-DAY FREE DELIVERY SECTION ===== */}
                <section aria-label="Same-day free delivery" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-16">
                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 lg:gap-16">

                        {/* Left Column: Copy + CTA (order-2 on mobile, md:order-1 on desktop) */}
                        <div className="w-full md:w-1/2 flex flex-col items-center text-center order-2 md:order-1">
                            {/* Eyebrow */}
                            <p className="text-[11px] font-bold uppercase tracking-widest text-purple-500 mb-3">
                                🚀 Same-Day Delivery
                            </p>

                            {/* Headline */}
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-4">
                                Your Cake.{' '}
                                <span className="text-purple-400">Safely Delivered Today.</span>
                            </h2>

                            {/* Subheadline */}
                            <p className="text-base md:text-lg text-slate-500 leading-relaxed mb-8 max-w-xl">
                                Order before 4 PM for same day delivery. <span className="font-semibold text-purple-600 uppercase tracking-wide text-sm md:text-base">FREE DELIVERY within Cebu City</span>.
                                {' '}Minimal fees for Mandaue, Mactan &amp; Talisay City.
                            </p>

                            {/* CTA Button */}
                            <div className="w-full max-w-lg">
                                <button
                                    id="delivery-section-upload-cta"
                                    onClick={() => setIsUploaderOpen(true)}
                                    aria-label="Upload a cake design image to check if it qualifies for same-day or rush delivery"
                                    className={`genie-btn-primary flex w-full items-center justify-center gap-2.5 ${LANDING_PRIMARY_CTA_RADIUS} py-4 px-7 text-[15px] font-bold shadow-lg shadow-purple-100/60 active:scale-[0.98] transition-transform`}
                                >
                                    <ImagePlus size={18} className="shrink-0" />
                                    <span className="whitespace-nowrap">Upload design - Check same-day availability</span>
                                </button>
                                <p className="mt-3 text-[11px] text-slate-400 font-medium">
                                    Upload now and we&apos;ll instantly tell you if it&apos;s available for today.
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Delivery photo (order-1 on mobile, md:order-2 on desktop) */}
                        <div className="w-full md:w-1/2 shrink-0 order-1 md:order-2">
                            <div className="relative rounded-3xl overflow-hidden shadow-2xl group">
                                <img
                                    src={HOMEPAGE_ASSETS.delivery}
                                    alt="Genie.ph same-day cake delivery in Cebu"
                                    className="w-full h-full object-cover aspect-4/3 transition-transform duration-700 group-hover:scale-105"
                                    loading="lazy"
                                    decoding="async"
                                    fetchPriority="low"
                                />
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-linear-to-tr from-black/20 via-transparent to-transparent pointer-events-none" />
                                {/* Badge */}
                                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-green-500 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                                    <Truck size={12} className="shrink-0" />
                                    <span>Free in Cebu City</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

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
                    <p className="text-[10px] text-gray-400 text-center" suppressHydrationWarning>&copy; {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p>
                </div>
            </aside>

        </div>
    );
};

export default LandingClient;
