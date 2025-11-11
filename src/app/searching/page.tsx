import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { BackIcon } from '../../components/icons';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

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
}) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    '🔴 Fetching image from source...',
    '🟣 Processing for AI analysis...',
    '🔵 Preparing customization...'
  ];

  useEffect(() => {
    // FIX: Changed NodeJS.Timeout to ReturnType<typeof setInterval> for browser compatibility.
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
      <div className="w-full flex items-center gap-2 md:gap-4 max-w-2xl mx-auto mb-6">
        <button
          onClick={onClose}
          className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <BackIcon />
        </button>
        <div className="relative flex-grow">
          <SearchAutocomplete
            value={searchInput}
            onChange={setSearchInput}
            onSearch={onSearch}
            onUploadClick={onUploadClick}
            placeholder="Search for cake designs..."
            inputClassName="w-full pl-5 pr-28 py-3 text-base border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
          />
        </div>
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