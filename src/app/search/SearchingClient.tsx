'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackIcon, UserCircleIcon, LogOutIcon, MapPinIcon, PackageIcon } from '@/components/icons';
import { useSmartBack } from '@/hooks/useSmartBack';
import { ShoppingBag, Filter, ArrowUpDown, Check, X, Store } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { ProductCard } from '@/components/ProductCard';
import Masonry from 'react-masonry-css';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useSearchEngine } from '@/hooks/useSearchEngine';
import { useRecordNavigation } from '@/hooks/useSmartBack';
import { useNavigation } from '@/contexts/NavigationContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/utils/toast';
import { AppState } from '@/hooks/useAppNavigation';
import { LandingFooter } from '@/components/landing/LandingFooter';

const SearchResultsSkeleton = ({ count = 8, showHeader = true }: { count?: number; showHeader?: boolean }) => (
    <div className="mb-6">
        {showHeader && (
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                    Cake Designs with Price
                </h2>
                <span className="h-4 w-24 rounded-full bg-slate-200 animate-pulse" aria-hidden="true" />
            </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    aria-hidden="true"
                >
                    <div className="aspect-[4/5] bg-slate-200 animate-pulse" />
                    <div className="space-y-2 p-3">
                        <div className="h-4 w-4/5 rounded bg-slate-200 animate-pulse" />
                        <div className="h-3 w-2/5 rounded bg-slate-200 animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const SearchingClient: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    // Smart back navigation
    const { goBack } = useSmartBack('search');

    // Contexts
    const { user, isAuthenticated, signOut } = useAuth();
    const { itemCount } = useCart();
    const {
        handleImageUpload: hookImageUpload,
        clearImages,
        originalImageData,
        setError: setImageError
    } = useImageManagement();
    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization
    } = useCakeCustomization();

    // Local state for header
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const [isFetchingWebImage, setIsFetchingWebImage] = useState(false);

    // Internal FTS results state
    const [internalResults, setInternalResults] = useState<any[]>([]);
    const [internalTotal, setInternalTotal] = useState(0);
    const [isInternalLoading, setIsInternalLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Filter and Sort state
    const [sortBy, setSortBy] = useState<'relevant' | 'price_asc' | 'price_desc'>('relevant');
    const [maxPrice, setMaxPrice] = useState<number | null>(null);

    // Loading animation state
    const [loadingStep, setLoadingStep] = useState(0);
    const loadingMessages = [
        '🔴 Fetching image from source...',
        '🟣 Processing for AI analysis...',
        '🔵 Preparing customization...'
    ];

    // Record navigation when entering search page
    // Only record if there's no prior navigation source (direct visit)
    const { navigationState } = useNavigation();
    const recordNavigation = useRecordNavigation();
    useEffect(() => {
        // Only record as 'direct' if there's no prior source
        if (!navigationState.entrySource) {
            recordNavigation('search', 'direct');
        }
    }, [recordNavigation, navigationState.entrySource]);

    // Adapter for AppState
    const setAppState = useCallback((state: AppState) => {
        switch (state) {
            case 'landing': router.push('/'); break;
            case 'customizing':
                recordNavigation('customizing', 'search');
                router.push('/customizing');
                break;
            case 'cart': router.push('/cart'); break;
            case 'auth': router.push('/login'); break;
            case 'addresses': router.push('/account/addresses'); break;
            case 'orders': router.push('/account/orders'); break;
            case 'searching':
                // Already here, maybe update URL if query changed?
                // useSearchEngine handles internal state
                break;
            default: router.push('/');
        }
    }, [router, recordNavigation]);

    const handleAppImageUpload = useCallback(async (file: File, imageUrl?: string) => {
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        // Navigate immediately
        recordNavigation('customizing', 'search');
        router.push('/customizing?from=search');

        return new Promise<void>((resolve, reject) => {
            hookImageUpload(
                file,
                (result) => {
                    setPendingAnalysisData(result);
                    setIsAnalyzing(false);
                    resolve();
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
                    reject(error);
                },
                { imageUrl }
            );
        });
    }, [clearImages, clearCustomization, setIsAnalyzing, setAnalysisError, initializeDefaultState, router, hookImageUpload, setPendingAnalysisData]);

    // Search Engine Hook
    const {
        isSearching,
        searchQuery,
        searchInput,
        setSearchInput,
        handleSearch,
    } = useSearchEngine({
        appState: 'searching',
        setAppState,
        handleImageUpload: handleAppImageUpload,
        setImageError, // mapping to context setError
        originalImageData,
        setIsFetchingWebImage
    });

    // Trigger initial search from URL
    // We only want this to run when the URL parameter (initialQuery) changes,
    // NOT when our internal state (searchQuery) changes, to avoid race conditions.
    useEffect(() => {
        if (initialQuery && initialQuery !== searchQuery) {
            setSearchInput(initialQuery);
            handleSearch(initialQuery);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialQuery]);

    // Fetch internal FTS results when searchQuery or maxPrice changes
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length === 0) {
            setInternalResults([]);
            setInternalTotal(0);
            return;
        }

        const controller = new AbortController();
        setIsInternalLoading(true);

        const priceParam = maxPrice ? `&maxPrice=${maxPrice}` : '';
        fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=12${priceParam}`, {
            signal: controller.signal
        })
            .then(res => res.json())
            .then(json => {
                setInternalResults(json.data || []);
                setInternalTotal(json.total || 0);
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error('FTS search error:', err);
                    setInternalResults([]);
                    setInternalTotal(0);
                }
            })
            .finally(() => setIsInternalLoading(false));

        return () => controller.abort();
    }, [searchQuery, maxPrice]);

    // Apply client-side sorting
    const processedResults = React.useMemo(() => {
        let results = [...internalResults];
        if (sortBy === 'price_asc') {
            return results.sort((a, b) => (a.price || 0) - (b.price || 0));
        }
        if (sortBy === 'price_desc') {
            return results.sort((a, b) => (b.price || 0) - (a.price || 0));
        }
        return results;
    }, [internalResults, sortBy]);

    // Masonry breakpoints for internal results grid
    const masonryBreakpoints = {
        default: 6,
        1536: 6,
        1280: 5,
        1024: 4,
        768: 3,
        640: 2,
    };

    // Load more internal FTS results
    const handleLoadMore = useCallback(() => {
        if (!searchQuery || isLoadingMore) return;
        setIsLoadingMore(true);

        const priceParam = maxPrice ? `&maxPrice=${maxPrice}` : '';
        fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=12&offset=${internalResults.length}${priceParam}`)
            .then(res => res.json())
            .then(json => {
                const newResults = json.data || [];
                setInternalResults(prev => {
                    const existingSlugs = new Set(prev.map((p: any) => p.slug));
                    const unique = newResults.filter((p: any) => !existingSlugs.has(p.slug));
                    return [...prev, ...unique];
                });
            })
            .catch(err => console.error('Load more error:', err))
            .finally(() => setIsLoadingMore(false));
    }, [searchQuery, internalResults.length, isLoadingMore, maxPrice]);

    // Loading animation effect
    const isLoading = isFetchingWebImage; // Map to local loading state
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (isLoading) {
            setLoadingStep(0);
            interval = setInterval(() => {
                setLoadingStep(prev => {
                    if (prev >= loadingMessages.length - 1) {
                        clearInterval(interval);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading, loadingMessages.length]);

    // Hide CSE modals globally when loading (CSE injects modals into body, not our container)
    // Hide CSE modals globally when loading (CSE injects modals into body, not our container)
    useEffect(() => {
        if (isLoading) {
            const styleId = 'cse-modal-hide-style';

            const injectStyles = () => {
                let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = styleId;
                    document.head.appendChild(styleTag);
                }
                styleTag.textContent = `
                    .gsc-modal-background-image,
                    .gsc-modal-background-image-visible,
                    .gsc-lightbox,
                    .gs-image-popup-box,
                    .gs-image-box-popup,
                    .gs-imageResult-popup,
                    .gsc-lightbox-main,
                    .gsc-popup,
                    div[class*="popup"],
                    div[class*="modal"],
                    [class*="gsc-"][class*="modal"],
                    [class*="gsc-"][class*="lightbox"] {
                        filter: blur(12px) !important;
                        opacity: 0.6 !important;
                        z-index: 1 !important; /* Ensure it stays behind our overlay */
                        pointer-events: none !important;
                        transform: scale(0.98) !important;
                        transition: all 0.3s ease !important;
                        background: transparent !important; /* Try to make background transparent so blur shows through */
                        box-shadow: none !important;
                    }
                    /* Target images inside popups specifically */
                    .gsc-modal-background-image img,
                    .gsc-modal-background-image-visible img,
                    .gsc-lightbox img,
                    .gs-image-popup-box img,
                    .gs-image-box-popup img,
                    .gs-imageResult-popup img,
                    div[class*="popup"] img {
                        filter: blur(12px) !important;
                        opacity: 0.6 !important;
                    }
                    /* Hide specifically the black background or overlay from Google */
                    .gsc-modal-background-image-visible {
                        background-color: rgba(0, 0, 0, 0.5) !important; 
                    }
                `;
            };

            injectStyles();

            // Use a MutationObserver to ensure our styles stick if Google tries to remove/overwrite them
            const observer = new MutationObserver(() => {
                const styleTag = document.getElementById(styleId);
                if (!styleTag) {
                    injectStyles();
                }
            });

            observer.observe(document.head, { childList: true });

            return () => {
                observer.disconnect();
                const styleTag = document.getElementById(styleId);
                if (styleTag && styleTag.parentNode) {
                    // Optional: We can keep it or remove it. Better to remove to clean up.
                    styleTag.parentNode.removeChild(styleTag);
                }
            };
        }
    }, [isLoading]);

    // Close account menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
                setIsAccountMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        await signOut();
        setIsAccountMenuOpen(false);
        router.push('/');
    };

    // Error from context or hook
    // useSearchEngine doesn't return 'error' directly, it uses setImageError which updates context?
    // Wait, useSearchEngine takes setImageError as prop.
    // But where does it store the error?
    // It calls setImageError.
    // In React App.tsx, it passed `imageManagementError` as `error` prop to SearchingPage.
    // So I should use `imageManagementError` from context.
    const { error: imageManagementError } = useImageManagement();

    // Hydration fix: only show cart count after mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen">
            <div className="w-full max-w-7xl mx-auto h-full flex flex-col px-4 pb-24 md:pb-0 overflow-hidden">
                {/* Consistent Header */}
                <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
                    <button onClick={goBack} className="p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label="Go back">
                        <BackIcon />
                    </button>
                    <div className="relative grow">
                        <SearchAutocomplete
                            value={searchInput}
                            onChange={setSearchInput}
                            onSearch={handleSearch}
                            showUploadButton={false}
                            placeholder="Search for other designs..."
                            inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                        />
                    </div>
                    <button onClick={() => router.push('/cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label={`View cart with ${mounted ? itemCount : 0} items`}>
                        <ShoppingBag size={24} />
                        {mounted && itemCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                                {itemCount}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex flex-col items-center mb-6">
                    <p className="text-center text-slate-500 mb-4">
                        Search results for: <span className="font-semibold text-slate-700">"{searchQuery}"</span>
                    </p>

                    {/* Minimalist Filter & Sort Bar */}
                    {searchQuery && (
                        <div className="w-full overflow-x-auto no-scrollbar pb-2">
                            <div className="flex items-center justify-center gap-2 min-w-max px-2">
                                {[1000, 2000, 3000].map((price) => (
                                    <button
                                        key={price}
                                        onClick={() => setMaxPrice(maxPrice === price ? null : price)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                            maxPrice === price
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                        }`}
                                    >
                                        {maxPrice === price ? <Check size={12} /> : null}
                                        Under ₱{price}
                                    </button>
                                ))}

                                <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                <button
                                    onClick={() => setSortBy(sortBy === 'price_asc' ? 'relevant' : 'price_asc')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                        sortBy === 'price_asc'
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                    }`}
                                >
                                    <ArrowUpDown size={12} />
                                    Price: Low
                                </button>
                                <button
                                    onClick={() => setSortBy(sortBy === 'price_desc' ? 'relevant' : 'price_desc')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                        sortBy === 'price_desc'
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                    }`}
                                >
                                    <ArrowUpDown size={12} className="rotate-180" />
                                    Price: High
                                </button>

                                {(maxPrice || sortBy !== 'relevant') && (
                                    <button
                                        onClick={() => {
                                            setMaxPrice(null);
                                            setSortBy('relevant');
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Clear filters"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {imageManagementError && (
                    <div className="text-center p-4 my-4 bg-red-50 rounded-lg max-w-md mx-auto">
                        <p className="font-semibold text-red-600">Error</p>
                        <p className="text-sm text-red-500">{imageManagementError}</p>
                    </div>
                )}
                <div className="relative grow">
                    {isSearching && !isLoading && !isInternalLoading && internalResults.length === 0 && (
                        <SearchResultsSkeleton />
                    )}
                    {isLoading && (
                        <div className="fixed inset-0 bg-white/50 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 text-center w-full max-w-xs">
                                <LoadingSpinner />
                                <p className="mt-4 text-slate-700 font-semibold text-lg">Working on it...</p>
                                <div className="mt-4 text-left text-sm text-slate-600 space-y-2">
                                    {loadingMessages.map((msg, index) => (
                                        <div key={index} className={`transition-opacity duration-500 flex items-center gap-2 ${index <= loadingStep ? 'opacity-100' : 'opacity-30'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${index < loadingStep ? 'bg-green-500' : 'bg-slate-300 animate-pulse'}`}></div>
                                            <span>{msg}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-4 text-xs text-slate-500">Estimated time: 5-10 seconds</p>
                            </div>
                        </div>
                    )}
                    {searchQuery && !isLoading && (internalResults.length > 0 || isInternalLoading) && (
                        <div className="mb-6" id="internal-designs-section">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                    Cake Designs with Price
                                    {!isInternalLoading && internalTotal > 0 && (
                                        <span className="text-xs font-normal text-slate-400">
                                            ({internalTotal} found)
                                        </span>
                                    )}
                                </h2>
                            </div>
                            {isInternalLoading && processedResults.length === 0 && (
                                <SearchResultsSkeleton count={12} showHeader={false} />
                            )}
                            {processedResults.length > 0 && (
                                <Masonry
                                    breakpointCols={masonryBreakpoints}
                                    className="flex -ml-3 w-auto"
                                    columnClassName="pl-3 bg-clip-padding"
                                >
                                    {processedResults.map((product, index) => (
                                        <div key={product.slug || product.p_hash} className="mb-3">
                                            <ProductCard
                                                p_hash={product.p_hash}
                                                original_image_url={product.original_image_url}
                                                studio_edited_image_url={product.studio_edited_image_url}
                                                price={product.price}
                                                keywords={product.keywords}
                                                slug={product.slug}
                                                availability={product.availability}
                                                analysis_json={product.analysis_json}
                                                priority={index < 4}
                                                image_width={product.image_width}
                                                image_height={product.image_height}
                                                listName="search_results"
                                            />
                                        </div>
                                    ))}
                                </Masonry>
                            )}
                            {internalResults.length > 0 && internalResults.length < internalTotal && (
                                <div className="flex justify-center mt-6 mb-2">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={isLoadingMore}
                                        className="px-6 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full border border-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isLoadingMore ? (
                                            <>
                                                <LoadingSpinner />
                                                Loading...
                                            </>
                                        ) : (
                                            <>Load more designs</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {searchQuery && !isLoading && (
                        <div className="mt-8 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px grow bg-slate-200"></div>
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2 shrink-0">
                                    <Store className="w-4 h-4 opacity-50" />
                                    Inspiration from the Web
                                </h2>
                                <div className="h-px grow bg-slate-200"></div>
                            </div>
                        </div>
                    )}

                    <div id="google-search-container" className="grow min-h-[400px]"></div>
                </div>
            </div>
            <div className="mt-8 md:mt-12">
                <LandingFooter />
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default SearchingClient;
