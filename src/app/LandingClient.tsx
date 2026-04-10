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
import { CakeGenieReview } from '@/lib/database.types';
import { getReviewDisplayName } from '@/lib/reviews';
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

interface LandingClientProps {
    children?: React.ReactNode;
    popularDesigns?: PopularDesign[];
    heroCollections?: {
        title: string;
        slug: string;
        count: number;
        sampleImage: string;
        caption: string;
    }[];
    blogPosts?: BlogHomepagePreview[];
    reviews?: CakeGenieReview[];
}

const HERO_CAKE_STYLES = ['Minimalist', 'Vintage', 'Doodle', 'Photo', 'Floral'] as const;
const HERO_RECIPIENTS = ['Mom', 'Dad', 'Bro', 'Sis', 'Bestie', 'Tita', 'Tito', 'Lolo', 'Lola'] as const;
const HERO_TYPED_SUBHEADLINE_A11Y_LABEL = 'Available right now: Minimalist, Vintage, Doodle, Photo, and Floral cakes for Mom, Dad, Bro, Sis, Bestie, Tita, Tito, Lolo, and Lola.';
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
const DEFAULT_HERO_COLLECTIONS = [
    {
        title: 'Minimalist Cakes',
        slug: 'minimalist-cake',
        count: 0,
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-minimalist-cake.webp',
        caption: 'Clean lines, pastel finishes, and understated message cakes.',
    },
    {
        title: 'Vintage Cakes',
        slug: 'vintage-cake',
        count: 0,
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-vintage-cake.webp',
        caption: 'Frilly piping, retro charm, and statement celebration cakes.',
    },
    {
        title: 'Doodle Cakes',
        slug: 'doodle-cake',
        count: 0,
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-doodle-cake.webp',
        caption: 'Playful hand-drawn details for expressive, modern birthdays.',
    },
    {
        title: 'Edible Photo Cakes',
        slug: 'edible-photo-cake-wrap',
        count: 0,
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-edible-photo-cake.webp',
        caption: 'Printed memories and personalized graphics wrapped into cake form.',
    },
    {
        title: 'Floral Cakes',
        slug: 'floral-cake',
        count: 0,
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-floral-cake.webp',
        caption: 'Soft blooms, romantic piping, and elegant garden-party finishes.',
    },
    {
        title: 'Bento Cakes',
        slug: 'bento-cake',
        count: 0,
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-bento-cake.webp',
        caption: 'Compact celebration cakes with playful piping and giftable charm.',
    },
] as const;
const DESKTOP_HERO_CARD_STYLES = [
    {
        tintClassName: 'from-fuchsia-200/70 via-white/10 to-transparent',
        placeholderClassName: 'from-[#f7d4ec] via-[#fef4fb] to-[#eadcff]',
        cardClassName: 'mt-0',
    },
    {
        tintClassName: 'from-amber-100/70 via-white/10 to-transparent',
        placeholderClassName: 'from-[#ffe5d1] via-[#fff3eb] to-[#ffd7dc]',
        cardClassName: 'mt-6',
    },
    {
        tintClassName: 'from-sky-200/70 via-white/10 to-transparent',
        placeholderClassName: 'from-[#d8efff] via-[#f2fbff] to-[#e3e8ff]',
        cardClassName: 'mt-2',
    },
    {
        tintClassName: 'from-violet-200/70 via-white/10 to-transparent',
        placeholderClassName: 'from-[#ead9ff] via-[#faf5ff] to-[#fde7f3]',
        cardClassName: 'mt-1',
    },
    {
        tintClassName: 'from-emerald-100/70 via-white/10 to-transparent',
        placeholderClassName: 'from-[#dff8e8] via-[#f7fff9] to-[#fef0f4]',
        cardClassName: 'mt-8',
    },
    {
        tintClassName: 'from-rose-200/70 via-white/10 to-transparent',
        placeholderClassName: 'from-[#ffe1e8] via-[#fff5f7] to-[#efe4ff]',
        cardClassName: 'mt-3',
    },
] as const;

const DESKTOP_HERO_MASONRY_COLUMNS = [
    { indexes: [0, 3], className: 'pt-0' },
    { indexes: [1, 4], className: 'pt-5 lg:pt-6' },
    { indexes: [2, 5], className: 'pt-2 lg:pt-3' },
] as const;

const TABLET_HERO_MASONRY_COLUMNS = [
    { indexes: [0, 3, 4], className: 'pt-0' },
    { indexes: [1, 2, 5], className: 'pt-5' },
] as const;

const subscribeToHydration = () => () => { };

const HeroTypingSubheadline: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [styleIndex, setStyleIndex] = useState(0);
    const [recipientIndex, setRecipientIndex] = useState(0);
    const [displayRecipient, setDisplayRecipient] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isStyleVisible, setIsStyleVisible] = useState(true);
    const [isStyleTransitioning, setIsStyleTransitioning] = useState(false);

    useEffect(() => {
        if (isStyleTransitioning) {
            return;
        }

        const currentRecipient = HERO_RECIPIENTS[recipientIndex];
        const typingDelay = isDeleting ? 28 : 48;
        let timeoutId: ReturnType<typeof setTimeout>;

        if (!isDeleting && displayRecipient === currentRecipient) {
            timeoutId = setTimeout(() => setIsDeleting(true), 500);
        } else if (isDeleting && displayRecipient.length === 0) {
            timeoutId = setTimeout(() => {
                setIsDeleting(false);
                if (recipientIndex === HERO_RECIPIENTS.length - 1) {
                    setIsStyleTransitioning(true);
                    setIsStyleVisible(false);
                } else {
                    setRecipientIndex((currentIndex) => currentIndex + 1);
                }
            }, 120);
        } else {
            timeoutId = setTimeout(() => {
                const nextLength = isDeleting ? displayRecipient.length - 1 : displayRecipient.length + 1;
                setDisplayRecipient(currentRecipient.slice(0, nextLength));
            }, typingDelay);
        }

        return () => clearTimeout(timeoutId);
    }, [displayRecipient, isDeleting, isStyleTransitioning, recipientIndex]);

    useEffect(() => {
        if (!isStyleTransitioning) {
            return;
        }

        const fadeOutTimer = setTimeout(() => {
            setStyleIndex((currentIndex) => (currentIndex + 1) % HERO_CAKE_STYLES.length);
            setRecipientIndex(0);
            setIsStyleVisible(true);
        }, 220);

        const fadeInTimer = setTimeout(() => {
            setIsStyleTransitioning(false);
        }, 440);

        return () => {
            clearTimeout(fadeOutTimer);
            clearTimeout(fadeInTimer);
        };
    }, [isStyleTransitioning]);

    return (
        <p className={className} aria-label={HERO_TYPED_SUBHEADLINE_A11Y_LABEL}>
            <span
                aria-hidden="true"
                className={`transition-opacity duration-200 ${isStyleVisible ? 'opacity-100' : 'opacity-0'}`}
            >
                {HERO_CAKE_STYLES[styleIndex]} Cake for{' '}
            </span>
            <span aria-hidden="true">{displayRecipient}</span>
            <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-purple-500 align-middle animate-pulse"
            />
        </p>
    );
};

const HeroTypingHeadlineLine: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [displayText, setDisplayText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const currentPhrase = HERO_HEADLINE_VARIANTS[phraseIndex];
        let timeoutId: ReturnType<typeof setTimeout>;

        if (!isDeleting && displayText === currentPhrase) {
            timeoutId = setTimeout(() => setIsDeleting(true), 900);
        } else if (isDeleting && displayText.length === 0) {
            timeoutId = setTimeout(() => {
                setIsDeleting(false);
                setPhraseIndex((currentIndex) => (currentIndex + 1) % HERO_HEADLINE_VARIANTS.length);
            }, 150);
        } else {
            timeoutId = setTimeout(() => {
                const nextLength = isDeleting ? displayText.length - 1 : displayText.length + 1;
                setDisplayText(currentPhrase.slice(0, nextLength));
            }, isDeleting ? 34 : 56);
        }

        return () => clearTimeout(timeoutId);
    }, [displayText, isDeleting, phraseIndex]);

    return (
        <span className={className} aria-label={HERO_HEADLINE_A11Y_LABEL}>
            <span aria-hidden="true">{displayText}</span>
            <span
                aria-hidden="true"
                className="ml-1 inline-block h-[0.92em] w-[3px] translate-y-[2px] bg-purple-500 align-middle animate-pulse"
            />
        </span>
    );
};

function DesktopHeroCollectionCard({
    title,
    slug,
    sampleImage,
    index,
}: {
    title: string;
    slug: string;
    sampleImage: string;
    index: number;
}) {
    const style = DESKTOP_HERO_CARD_STYLES[index % DESKTOP_HERO_CARD_STYLES.length];

    return (
        <Link
            href={`/collections/${slug}`}
            className="group relative block w-full self-start overflow-hidden rounded-[1.35rem] border border-white/75 bg-white/80 shadow-[0_18px_44px_-34px_rgba(88,28,135,0.72)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_-30px_rgba(88,28,135,0.78)]"
        >
            <div className="relative overflow-hidden">
                {sampleImage ? (
                    <img
                        src={sampleImage}
                        alt={`${title} collection`}
                        loading="lazy"
                        className="block w-full h-auto transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className={`aspect-[4/4.4] min-h-[168px] bg-gradient-to-br ${style.placeholderClassName}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className={`absolute inset-0 bg-gradient-to-br ${style.tintClassName} opacity-80 mix-blend-screen`} />

                <div className="absolute inset-x-0 bottom-0 p-3 lg:p-3.5">
                    <h3 className="max-w-[90%] text-[0.8rem] lg:text-[0.88rem] font-semibold leading-tight text-white">
                        {title}
                    </h3>
                </div>
            </div>
        </Link>
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

    const targetImageSrc = icingOn['Drip']
        ? selectedToppers.has('Sugar Flowers')
            ? icingOn['Board']
                ? 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake-drip-roses-base.webp'
                : 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake-drip-roses.webp'
            : 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/2-tier-ribbon-cake-drip.webp'
        : tier.src;
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

                                    // Step 6: Type message
                                    scheduleStep(() => {
                                        setHighlightedOption(null);
                                        setAnnotation(null);
                                        setShowTypingCursor(true);
                                        let charIndex = 0;
                                        typingIntervalRef.current = setInterval(() => {
                                            if (!isAutoPlayingRef.current) {
                                                if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
                                                return;
                                            }
                                            charIndex++;
                                            if (charIndex <= DEMO_MESSAGE.length) {
                                                setCakeMessage(DEMO_MESSAGE.slice(0, charIndex));
                                            } else {
                                                if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
                                                setShowTypingCursor(false);

                                                // Step 7: Show price badge
                                                scheduleStep(() => {
                                                    setShowPriceBadge(true);

                                                    // Step 8: Reset and loop
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
                                                }, 700);
                                            }
                                        }, 49);
                                    }, 1050);
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
                    <span className="text-xs font-semibold text-slate-700">Live Demo</span>
                </div>

                {/* Cake image */}
                <div className="relative rounded-3xl overflow-hidden shadow-xl bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100 aspect-[4/3]">
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
                            <span className="text-xs font-bold text-purple-600">{annotation}</span>
                        </div>
                    )}

                    {/* Message overlay */}
                    {cakeMessage && !showPriceBadge && (
                        <div className="absolute bottom-4 right-4 bg-white/85 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-md border border-purple-200 animate-annotation-fade-in whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 block mb-0.5">Cake message</span>
                            <span className="text-sm font-semibold text-slate-800">
                                {cakeMessage}
                                {showTypingCursor && <span className="text-purple-500 animate-pulse">|</span>}
                            </span>
                        </div>
                    )}

                    {/* Price badge overlay */}
                    {showPriceBadge && (
                        <div className="absolute inset-0 flex items-center justify-center animate-annotation-fade-in">
                            <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl px-6 py-4 shadow-2xl flex flex-col items-center gap-2">
                                <span className="text-3xl font-extrabold text-white tracking-tight">₱{totalPrice.toLocaleString()}</span>
                                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2">
                                    <ShoppingBag size={15} className="text-purple-600" />
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
                                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                                    selectedTier === i
                                        ? 'bg-purple-600 text-white shadow-md scale-[1.02]'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                } ${highlightedOption === t.label ? 'animate-option-glow' : ''}`}
                            >
                                {t.label}
                                <span className="block text-[10px] opacity-70">₱{t.price.toLocaleString()}</span>
                            </button>
                        ))}
                    </div>
                </div>


                {/* Icing Details */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3.5 shadow-sm border border-slate-100">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Icing Details</label>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1 px-1 -mx-1">
                        {icings.map((ic) => (
                            <button
                                key={ic.label}
                                onClick={() => handleIcingToggle(ic.label)}
                                className={`shrink-0 flex flex-col items-center gap-1 min-w-[46px] ${highlightedOption === ic.label ? 'animate-option-glow rounded-full' : ''}`}
                            >
                                <div className={`w-12 h-12 rounded-full border border-slate-200 overflow-hidden bg-white p-2 shadow-sm flex items-center justify-center transition-all duration-200 ${
                                    icingOn[ic.label]
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
                    </div>
                </div>

                {/* Toppers */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-slate-100">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Toppers</label>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 pt-0.5 px-1 -mx-1">
                        {toppers.map((tp) => (
                            <button
                                key={tp.label}
                                onClick={() => handleTopperToggle(tp.label)}
                                className={`shrink-0 flex flex-col items-center gap-0 p-1 rounded-lg transition-all duration-200 ${
                                    selectedToppers.has(tp.label)
                                        ? 'bg-purple-50 border-2 border-purple-400'
                                        : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                } ${highlightedOption === tp.label ? 'animate-option-glow' : ''}`}
                            >
                                <span className="text-base leading-tight">{tp.emoji}</span>
                                <span className="text-[8px] font-medium text-slate-600 mt-0.5">{tp.label}</span>
                                <span className="text-[8px] text-purple-500 font-semibold">+₱100</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cake Message */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3.5 shadow-sm border border-slate-100">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Cake Message</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider shrink-0">TOP</span>
                        <span className="text-sm text-slate-700 flex-1 truncate">
                            {cakeMessage || <span className="text-slate-400 italic">Your message here...</span>}
                            {showTypingCursor && <span className="text-purple-500 animate-pulse font-bold">|</span>}
                        </span>
                        <div className="w-3 h-3 rounded-full bg-pink-400 shrink-0 shadow-sm" />
                    </div>
                </div>

                {/* Price Bar */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-3.5 shadow-xl">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="relative h-8 overflow-hidden flex items-center">
                                <span
                                    key={totalPrice}
                                    className={`text-xl font-extrabold text-white inline-block ${
                                        priceDirection === 'up' ? 'animate-price-slide-in-up' :
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
                            className="flex bg-white text-purple-700 font-bold py-2 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-sm whitespace-nowrap items-center gap-1.5"
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
            <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
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
                        className="flex bg-white text-purple-700 font-bold py-2 px-4 rounded-xl shadow-lg text-sm whitespace-nowrap items-center gap-1.5"
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

const LandingClient: React.FC<LandingClientProps> = ({ children, popularDesigns = [], heroCollections = [], blogPosts = [], reviews = [] }) => {
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
    const desktopHeroCollections = useMemo(
        () => (heroCollections.length > 0 ? heroCollections : [...DEFAULT_HERO_COLLECTIONS]),
        [heroCollections]
    );


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
        <div id="top" className="font-sans bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100 min-h-screen pb-24 md:pb-0 text-gray-800 flex flex-col">
            {/* Capture discount code from URL without blocking prerender */}
            <Suspense fallback={null}>
                <DiscountCapture />
            </Suspense>

            {/* ========== STATIC TRUST BANNER ========== */}
            <div className="w-full bg-purple-600 py-[4.5px] flex justify-center items-center">
                <span className="inline-flex items-center text-white text-[10px] md:text-[11px] font-bold tracking-wider">
                    Place your order by 4PM for same-day delivery in Metro Cebu 💖
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
                {/* ===== HERO SECTION ===== */}
                <section aria-label="Hero" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-0 pb-4 md:pb-6 lg:pb-8">
                    <div className="flex flex-col md:flex-row gap-8 md:gap-12 lg:gap-16 items-start">
{/* Mobile Hero View */}
                        <div className="md:hidden w-full flex flex-col">
                            {/* Image container with message overlay on the left */}
                            <div className="relative w-full rounded-3xl overflow-hidden mb-4 shadow-lg">
                                <ImageWithSkeleton
                                    src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP"
                                    alt="Hero"
                                    className="w-full h-auto block object-cover object-center"
                                    skeletonClassName="rounded-3xl"
                                    priority
                                />
                                <div className="absolute inset-0 p-5 flex flex-col justify-center w-[65%] max-[520px]:w-[85%] gap-0.5">
                                    <h2 className="text-[38px] max-[520px]:text-[32px] max-[414px]:text-[28px] font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-2 max-[520px]:mb-1">
                                        Custom Cakes for{' '}
                                        <span className="text-purple-600 italic">Spontaneous Celebrations.</span>
                                    </h2>
                                    <HeroTypingSubheadline className="min-h-[1.125rem] max-w-[16rem] text-[14px] max-[414px]:text-[13px] font-medium text-purple-600 leading-relaxed" />
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
                                Upload any cake photo. Get the price instantly. Same-day delivery
                            </p>
                            <p className="max-[454px]:hidden text-xs text-gray-700 leading-relaxed font-medium text-center mt-2">
                                Upload any cake photo. Get the price instantly. Same-day delivery
                            </p>
                        </div>

                        {/* Desktop Hero View: top-aligned text plus staggered collection cards */}
                        <div className="hidden md:grid w-full grid-cols-[minmax(0,1.04fr)_minmax(280px,0.96fr)] items-start gap-5 min-[945px]:grid-cols-[minmax(0,0.82fr)_minmax(430px,1fr)] min-[945px]:gap-7 min-[1232px]:grid-cols-[minmax(0,0.78fr)_minmax(470px,1.06fr)] min-[1232px]:gap-8">
                            <div className="relative z-10 flex min-h-[540px] flex-col items-center justify-center pr-2 text-center min-[945px]:pr-4">
                                <h1 className="text-[11px] text-purple-600 font-bold tracking-[0.12em] uppercase">
                                    Best Online Cake Delivery for Rush Orders in Metro Cebu
                                </h1>
                                <h2 className="mt-3 text-[2.95rem] min-[945px]:text-5xl min-[1232px]:text-6xl font-extrabold text-gray-900 leading-[1.05] tracking-tight">
                                    <HeroTypingHeadlineLine className="block min-h-[1.1em] whitespace-nowrap text-center" />
                                    <span className="block whitespace-nowrap text-purple-600 italic">For Spontaneous</span>
                                    <span className="block whitespace-nowrap text-purple-600 italic">Celebrations</span>
                                </h2>
                                <div className="mt-6 w-full max-w-[20.5rem] min-[945px]:max-w-md">
                                    <ImageUploader
                                        isOpen
                                        variant="inline"
                                        compact
                                        compactAlignment="center"
                                        title="Upload any Cake Design Image"
                                        showBrowseButton={false}
                                        iconImageSrc="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/upload-cake-image.webp"
                                        iconImageAlt="Upload cake design"
                                        onClose={() => {}}
                                        onImageSelect={handleAppImageUpload}
                                    />
                                </div>
                                <p className="mt-5 max-w-lg text-sm leading-relaxed text-gray-700 min-[1232px]:text-base">
                                    Upload any cake photo. Get the price instantly. Same-day delivery
                                </p>
                            </div>

                            <div className="relative z-10 mt-4">
                                <div className="mx-auto grid w-full max-w-[24rem] grid-cols-2 gap-4 min-[945px]:hidden">
                                    {TABLET_HERO_MASONRY_COLUMNS.map((column) => (
                                        <div key={column.indexes.join('-')} className={`flex flex-col gap-4 ${column.className}`}>
                                            {column.indexes.map((collectionIndex) => {
                                                const collection = desktopHeroCollections[collectionIndex];

                                                if (!collection) {
                                                    return null;
                                                }

                                                return (
                                                    <DesktopHeroCollectionCard
                                                        key={collection.slug}
                                                        title={collection.title}
                                                        slug={collection.slug}
                                                        sampleImage={collection.sampleImage}
                                                        index={collectionIndex}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                                <div className="hidden min-[945px]:grid min-[945px]:grid-cols-3 min-[945px]:gap-3 min-[1232px]:gap-4">
                                    {DESKTOP_HERO_MASONRY_COLUMNS.map((column) => (
                                        <div key={column.indexes.join('-')} className={`flex flex-col gap-3 min-[1232px]:gap-4 ${column.className}`}>
                                            {column.indexes.map((collectionIndex) => {
                                                const collection = desktopHeroCollections[collectionIndex];

                                                if (!collection) {
                                                    return null;
                                                }

                                                return (
                                                    <DesktopHeroCollectionCard
                                                        key={collection.slug}
                                                        title={collection.title}
                                                        slug={collection.slug}
                                                        sampleImage={collection.sampleImage}
                                                        index={collectionIndex}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                {/* ===== REVIEWS MARQUEE ===== */}
                {reviewCards.length > 0 && (
                <section aria-label="Customer reviews" className="w-full overflow-hidden py-2 md:py-4">
                    <div className="mx-auto max-w-7xl px-4 pb-3 text-center sm:px-6 lg:px-8 md:pb-4">
                        <Link href="/reviews" className="text-[10px] text-gray-600 hover:text-purple-600 md:text-xs">
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

                {/* ===== INTERACTIVE CUSTOMIZER DEMO ===== */}
                <section aria-label="AI-powered instant pricing" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                    <h2 id="price-change-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-2 text-center">
                        See your price change <span className="text-purple-600">in real time.</span>
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
                            { label: 'Top Border', src: `${BASE}top_red.webp`, addonPrice: 0 },
                            { label: 'Base Border', src: `${BASE}baseborder_red.webp`, addonPrice: 0 },
                            { label: 'Top Icing', src: `${BASE}topicing_red.webp`, addonPrice: 0 },
                            { label: 'Body Icing', src: `${BASE}icing_red.webp`, addonPrice: 0 },
                            { label: 'Board', src: `${BASE}baseboardwhite.webp`, addonPrice: 100 },
                        ];
                        const TOPPERS = [
                            { label: 'Sugar Flowers', emoji: '🌸' },
                            { label: 'Number', emoji: '🔢' },
                            { label: 'Sprinkles', emoji: '✨' },
                            { label: 'Macaron', emoji: '🍪' },
                        ];
                        return <InteractiveCustomizer tiers={TIERS} flavors={FLAVORS} icings={ICINGS} toppers={TOPPERS} onTryItClick={() => setIsUploaderOpen(true)} />;
                    })()}
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
