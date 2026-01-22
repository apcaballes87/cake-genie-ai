'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackIcon, UserCircleIcon, LogOutIcon, MapPinIcon, PackageIcon } from '@/components/icons';
import { ShoppingBag } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useSearchEngine } from '@/hooks/useSearchEngine';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/utils/toast';
import { AppState } from '@/hooks/useAppNavigation';

const SearchingClient: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

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

    // Loading animation state
    const [loadingStep, setLoadingStep] = useState(0);
    const loadingMessages = [
        '🔴 Fetching image from source...',
        '🟣 Processing for AI analysis...',
        '🔵 Preparing customization...'
    ];

    // Adapter for AppState
    const setAppState = useCallback((state: AppState) => {
        switch (state) {
            case 'landing': router.push('/'); break;
            case 'customizing': router.push('/customizing'); break;
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
    }, [router]);

    const handleAppImageUpload = useCallback(async (file: File, imageUrl?: string) => {
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        // Navigate immediately
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
                    const errorMessage = error.message;
                    setAnalysisError(errorMessage);
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
    useEffect(() => {
        if (initialQuery && initialQuery !== searchQuery) {
            setSearchInput(initialQuery);
            handleSearch(initialQuery);
        }
    }, [initialQuery, handleSearch, setSearchInput]);

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
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col min-h-screen px-4 pb-24 md:pb-0">
            {/* Consistent Header */}
            <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
                <button onClick={() => router.back()} className="p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label="Go back">
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

            <p className="text-center text-slate-500 mb-4">
                Search results for: <span className="font-semibold text-slate-700">"{searchQuery}"</span>
            </p>
            {imageManagementError && (
                <div className="text-center p-4 my-4 bg-red-50 rounded-lg max-w-md mx-auto">
                    <p className="font-semibold text-red-600">Error</p>
                    <p className="text-sm text-red-500">{imageManagementError}</p>
                </div>
            )}
            {isSearching && (
                <div className="flex flex-col items-center justify-center min-h-[300px]">
                    <LoadingSpinner />
                    <p className="mt-4 text-slate-500">Searching for cakes...</p>
                </div>
            )}
            <div className="relative grow">
                {isLoading && (
                    <div className="fixed inset-0 bg-white/50 backdrop-blur-md flex flex-col items-center justify-center z-[9999] p-4">
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
                <div id="google-search-container" className="grow min-h-[400px]"></div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default SearchingClient;
