import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { BackIcon, CartIcon, UserCircleIcon, LogOutIcon, MapPinIcon, PackageIcon } from '../../components/icons';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { AppState } from '../../hooks/useAppNavigation';

interface SearchingPageProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchQuery: string;
  error: string | null;
  isSearching: boolean;
  isLoading: boolean;
  onSearch: (query?: string) => void;
  onClose: () => void;
  originalImageData: { data: string; mimeType: string } | null;
  onUploadClick: () => void;
  // New props for header consistency
  itemCount: number;
  setAppState: (state: AppState) => void;
  isAuthenticated: boolean;
  user: any;
  onSignOut: () => void;
  isAccountMenuOpen: boolean;
  setIsAccountMenuOpen: Dispatch<SetStateAction<boolean>>;
  accountMenuRef: React.RefObject<HTMLDivElement>;
}

const SearchingPage: React.FC<SearchingPageProps> = ({
  searchInput,
  setSearchInput,
  searchQuery,
  error,
  isSearching,
  isLoading,
  onSearch,
  onClose,
  onUploadClick,
  itemCount,
  setAppState,
  isAuthenticated,
  user,
  onSignOut,
  isAccountMenuOpen,
  setIsAccountMenuOpen,
  accountMenuRef,
}) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    '🔴 Fetching image from source...',
    '🟣 Processing for AI analysis...',
    '🔵 Preparing customization...'
  ];

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

  return (
    <div className="w-full max-w-6xl mx-auto h-full flex flex-col">
      {/* Consistent Header */}
      <div className="w-full flex items-center gap-2 md:gap-4 max-w-2xl mx-auto mb-6">
        <button onClick={onClose} className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label="Go back">
          <BackIcon />
        </button>
        <div className="relative flex-grow">
          <SearchAutocomplete
            value={searchInput}
            onChange={setSearchInput}
            onSearch={onSearch}
            showUploadButton={false}
            placeholder="Search for other designs..."
            inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
          />
        </div>
        <button onClick={() => setAppState('cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label={`View cart with ${itemCount} items`}>
          <CartIcon />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
              {itemCount}
            </span>
          )}
        </button>
        {isAuthenticated && !user?.is_anonymous ? (
          <div className="relative" ref={accountMenuRef}>
            <button onClick={() => setIsAccountMenuOpen(prev => !prev)} className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label="Open account menu">
              <UserCircleIcon />
            </button>
            {isAccountMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-fade-in z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-800 truncate">{user?.email}</p>
                </div>
                <button onClick={() => { setAppState('addresses'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <MapPinIcon className="w-4 h-4" />
                  My Addresses
                </button>
                <button onClick={() => { setAppState('orders'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <PackageIcon className="w-4 h-4" />
                  My Orders
                </button>
                <button onClick={onSignOut} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <LogOutIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setAppState('auth')} className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-all shadow-sm flex-shrink-0">
            Login
          </button>
        )}
      </div>

      <p className="text-center text-slate-500 mb-4">
        Search results for: <span className="font-semibold text-slate-700">"{searchQuery}"</span>
      </p>
      {error && (
        <div className="text-center p-4 my-4 bg-red-50 rounded-lg max-w-md mx-auto">
          <p className="font-semibold text-red-600">Error</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
      {isSearching && (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <LoadingSpinner />
          <p className="mt-4 text-slate-500">Searching for cakes...</p>
        </div>
      )}
      <div className="relative flex-grow">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-lg p-4">
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
        <div id="google-search-container" className="flex-grow min-h-[400px]"></div>
      </div>
    </div>
  );
};

export default React.memo(SearchingPage);